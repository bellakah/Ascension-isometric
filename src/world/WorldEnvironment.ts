import * as THREE from 'three';
import { entityCollisionRadius } from './WorldCollision';
import { TerrainSurface } from './TerrainSurface';
import { sampleTerrainHeight, type TerrainRegion } from './TerrainMath';
import type { WorldDocument } from './WorldDocument';

export type EditorWorldLayer = 'terrain' | 'objects' | 'water' | 'spawn' | 'collision' | 'grid';

export class WorldEnvironment {
  private readonly group = new THREE.Group();
  private readonly overlayGroup = new THREE.Group();
  private readonly terrain: TerrainSurface;
  private grid: THREE.GridHelper | null = null;
  private water: THREE.Mesh | null = null;
  private spawnMarker: THREE.Group | null = null;
  private readonly blockersGroup = new THREE.Group();
  private readonly collisionGroup = new THREE.Group();
  private brushRing: THREE.Mesh | null = null;
  private blockerPreview: THREE.Mesh | null = null;
  private currentDocument: WorldDocument;
  private readonly visibility: Record<EditorWorldLayer, boolean> = { terrain: true, objects: true, water: true, spawn: true, collision: false, grid: true };

  constructor(private readonly scene: THREE.Scene, document: WorldDocument, private readonly showEditorHelpers: boolean) {
    this.currentDocument = document;
    this.group.name = 'World Environment'; this.group.userData.editorHelper = true;
    this.overlayGroup.name = 'World Editor Overlays'; this.overlayGroup.userData.editorHelper = true;
    this.blockersGroup.userData.editorHelper = true; this.collisionGroup.userData.editorHelper = true;
    this.terrain = new TerrainSurface(document); this.group.add(this.terrain.mesh); this.overlayGroup.add(this.blockersGroup, this.collisionGroup); this.scene.add(this.group, this.overlayGroup); this.update(document);
  }

  update(document: WorldDocument): void {
    this.currentDocument = document; this.scene.background = new THREE.Color(document.environment.backgroundColor); this.terrain.update(document);
    this.rebuildLights(); this.rebuildGrid(); this.rebuildWater(); this.rebuildSpawn(); this.rebuildBlockers(); this.refreshCollisionFootprints(document); this.applyVisibility();
  }

  refreshTerrain(document: WorldDocument, region?: TerrainRegion): void {
    this.currentDocument = document; this.terrain.update(document, region); this.rebuildSpawn(); this.rebuildBlockers(); this.refreshCollisionFootprints(document); this.applyVisibility();
  }

  setTerrainMaskPreview(document: WorldDocument, layerId: string | null): void { this.currentDocument = document; this.terrain.setMaskPreview(document, layerId); }

  refreshCollisionFootprints(document: WorldDocument): void {
    this.currentDocument = document;
    for (const child of [...this.collisionGroup.children]) { this.collisionGroup.remove(child); if (child instanceof THREE.Mesh) this.disposeMesh(child); }
    if (!this.showEditorHelpers) return;
    for (const entity of document.entities) {
      const radius = entityCollisionRadius(entity); if (radius <= 0) continue;
      const ring = new THREE.Mesh(new THREE.RingGeometry(Math.max(0.02, radius - 0.035), radius, 36), new THREE.MeshBasicMaterial({ color: 0xf7a64a, transparent: true, opacity: 0.78, side: THREE.DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(entity.position.x, this.terrainHeight(entity.position.x, entity.position.z) + 0.055, entity.position.z); ring.userData.editorHelper = true; this.collisionGroup.add(ring);
    }
    this.applyVisibility();
  }

  terrainHeight(x: number, z: number): number { return sampleTerrainHeight(this.currentDocument, x, z); }
  surfaceAt(camera: THREE.Camera, canvas: HTMLCanvasElement, clientX: number, clientY: number): THREE.Vector3 | null { return this.terrain.surfaceAt(camera, canvas, clientX, clientY); }
  setLayerVisible(layer: EditorWorldLayer, visible: boolean): void { this.visibility[layer] = visible; this.applyVisibility(); }
  getLayerVisible(layer: EditorWorldLayer): boolean { return this.visibility[layer]; }

  setBrushPreview(point: THREE.Vector3 | null, radius: number, color = 0x66c6ff): void {
    if (!this.showEditorHelpers || !point) { if (this.brushRing) this.brushRing.visible = false; return; }
    if (!this.brushRing) {
      this.brushRing = new THREE.Mesh(new THREE.RingGeometry(0.94, 1, 64), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
      this.brushRing.rotation.x = -Math.PI / 2; this.brushRing.userData.editorHelper = true; this.overlayGroup.add(this.brushRing);
    }
    (this.brushRing.material as THREE.MeshBasicMaterial).color.setHex(color); this.brushRing.position.set(point.x, point.y + 0.035, point.z); this.brushRing.scale.set(radius, radius, radius); this.brushRing.visible = true;
  }

  setBlockerPreview(start: THREE.Vector3 | null, end: THREE.Vector3 | null): void {
    if (this.blockerPreview) { this.overlayGroup.remove(this.blockerPreview); this.disposeMesh(this.blockerPreview); this.blockerPreview = null; }
    if (!this.showEditorHelpers || !start || !end) return;
    this.blockerPreview = this.createBlockerMesh(start.x, start.z, end.x, end.z, 0x73d7ff, 0.65); this.overlayGroup.add(this.blockerPreview); this.applyVisibility();
  }

  dispose(): void {
    this.scene.remove(this.group, this.overlayGroup); this.terrain.dispose();
    this.group.traverse((object) => { if (object instanceof THREE.Mesh && object !== this.terrain.mesh) this.disposeMesh(object); });
    this.overlayGroup.traverse((object) => { if (object instanceof THREE.Mesh) this.disposeMesh(object); }); this.group.clear(); this.overlayGroup.clear();
  }

  private rebuildLights(): void {
    for (const child of [...this.group.children]) if (child.userData.environmentLight) this.group.remove(child);
    const hemisphere = new THREE.HemisphereLight(0xdceeff, 0x526149, 1.8); hemisphere.userData.environmentLight = true;
    const sun = new THREE.DirectionalLight(0xfff1d2, 3.1); sun.userData.environmentLight = true; sun.position.set(14, 24, 10); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    const extent = Math.min(80, Math.max(20, this.currentDocument.environment.groundSize * 0.35)); sun.shadow.camera.left = -extent; sun.shadow.camera.right = extent; sun.shadow.camera.top = extent; sun.shadow.camera.bottom = -extent; this.group.add(hemisphere, sun);
  }

  private rebuildGrid(): void {
    if (this.grid) this.group.remove(this.grid); if (!this.showEditorHelpers) { this.grid = null; return; }
    const size = this.currentDocument.environment.groundSize; const divisions = Math.max(10, Math.min(200, Math.round(size)));
    this.grid = new THREE.GridHelper(size, divisions, 0x5e7763, 0x6d886d); this.grid.position.y = 0.012; this.grid.userData.editorHelper = true; this.group.add(this.grid);
  }

  private rebuildWater(): void {
    if (this.water) { this.group.remove(this.water); this.disposeMesh(this.water); this.water = null; }
    const water = this.currentDocument.water; if (!water.enabled) return;
    this.water = new THREE.Mesh(new THREE.PlaneGeometry(this.currentDocument.environment.groundSize, this.currentDocument.environment.groundSize), new THREE.MeshStandardMaterial({ color: water.color, transparent: true, opacity: water.opacity, roughness: 0.28, metalness: 0.05, depthWrite: false }));
    this.water.rotation.x = -Math.PI / 2; this.water.position.y = water.level; this.water.name = 'Water'; this.water.userData.editorHelper = true; this.group.add(this.water);
  }

  private rebuildSpawn(): void {
    if (this.spawnMarker) { this.overlayGroup.remove(this.spawnMarker); this.spawnMarker.traverse((object) => { if (object instanceof THREE.Mesh) this.disposeMesh(object); }); this.spawnMarker = null; }
    if (!this.showEditorHelpers) return;
    const group = new THREE.Group(); const ring = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.85, 40), new THREE.MeshBasicMaterial({ color: 0x57d7ff, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false })); ring.rotation.x = -Math.PI / 2;
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.55, 8), new THREE.MeshBasicMaterial({ color: 0x57d7ff })); arrow.position.y = 0.5; group.add(ring, arrow); group.name = 'Player Spawn'; group.userData.editorHelper = true;
    const spawn = this.currentDocument.spawn; group.position.set(spawn.x, this.terrainHeight(spawn.x, spawn.z) + 0.04, spawn.z); this.spawnMarker = group; this.overlayGroup.add(group);
  }

  private rebuildBlockers(): void {
    for (const child of [...this.blockersGroup.children]) { this.blockersGroup.remove(child); if (child instanceof THREE.Mesh) this.disposeMesh(child); }
    if (!this.showEditorHelpers) return; for (const blocker of this.currentDocument.blockers) this.blockersGroup.add(this.createBlockerMesh(blocker.x1, blocker.z1, blocker.x2, blocker.z2, 0xf05b63, 0.35));
  }

  private createBlockerMesh(x1: number, z1: number, x2: number, z2: number, color: number, opacity: number): THREE.Mesh {
    const dx = x2 - x1; const dz = z2 - z1; const length = Math.max(0.1, Math.hypot(dx, dz)); const midX = (x1 + x2) / 2; const midZ = (z1 + z2) / 2;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(length, 3, 0.18), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false })); mesh.position.set(midX, this.terrainHeight(midX, midZ) + 1.5, midZ); mesh.rotation.y = -Math.atan2(dz, dx); mesh.userData.editorHelper = true; return mesh;
  }

  private applyVisibility(): void {
    this.terrain.mesh.visible = this.visibility.terrain; if (this.grid) this.grid.visible = this.showEditorHelpers && this.visibility.grid; if (this.water) this.water.visible = this.visibility.water; if (this.spawnMarker) this.spawnMarker.visible = this.visibility.spawn;
    this.blockersGroup.visible = this.visibility.collision; this.collisionGroup.visible = this.visibility.collision; if (this.blockerPreview) this.blockerPreview.visible = this.visibility.collision;
  }

  private disposeMesh(mesh: THREE.Mesh): void { mesh.geometry.dispose(); if (Array.isArray(mesh.material)) mesh.material.forEach((material) => material.dispose()); else mesh.material.dispose(); }
}
