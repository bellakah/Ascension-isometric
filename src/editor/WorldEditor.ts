import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import type { AssetRecord } from '../assets/types';
import type { Engine } from '../engine/Engine';
import { storePlaytestWorld } from '../world/PlaytestSession';
import { WorldDatabase, type WorldSummary } from '../world/WorldDatabase';
import { WorldEnvironment, type EditorWorldLayer } from '../world/WorldEnvironment';
import { WorldRuntime, applyEntityTransform, syncEntityTransform } from '../world/WorldRuntime';
import {
  averageTerrainHeight,
  latestHeightStampIndex,
  latestPaintStampIndex,
  stampRegion,
  unionTerrainRegion,
  type TerrainRegion,
} from '../world/TerrainMath';
import {
  MAX_TERRAIN_LAYERS,
  cloneWorldDocument,
  createBlocker,
  createHeightStamp,
  createPaintStamp,
  createTerrainLayer,
  createWorldDocument,
  createWorldEntity,
  duplicateWorldDocument,
  parseWorldDocument,
  type EntityCollisionMode,
  type SerializedVector3,
  type TerrainFalloff,
  type TerrainLayerDocument,
  type WorldDocument,
  type WorldEntityDocument,
} from '../world/WorldDocument';

const LEGACY_STORAGE_KEY = 'ascension-isometric-world-document-v1';
const HISTORY_LIMIT = 80;
const MAX_STAMPS = 12000;

export type TransformMode = 'translate' | 'rotate' | 'scale';
export type WorldAuthoringTool = 'select' | 'raise' | 'lower' | 'smooth' | 'flatten' | 'paint' | 'erase' | 'water' | 'spawn' | 'blocker';

export interface TerrainBrushSettings {
  radius: number;
  strength: number;
  falloff: TerrainFalloff;
  paintLayerId: string;
}

export interface WorldEditorEvents {
  onDocumentChanged(document: WorldDocument): void;
  onSelectionChanged(entity: WorldEntityDocument | null): void;
  onModeChanged(mode: TransformMode): void;
  onToolChanged(tool: WorldAuthoringTool): void;
  onStatus(message: string, tone?: 'normal' | 'success' | 'error'): void;
}

type LooseEventTarget = {
  addEventListener(type: string, listener: (event: unknown) => void): void;
  removeEventListener(type: string, listener: (event: unknown) => void): void;
};

function isTerrainTool(tool: WorldAuthoringTool): boolean {
  return tool === 'raise' || tool === 'lower' || tool === 'smooth' || tool === 'flatten' || tool === 'paint' || tool === 'erase';
}

function brushColor(tool: WorldAuthoringTool, erasePaint = false): number {
  if (erasePaint) return 0xef6d72;
  if (tool === 'raise') return 0xf0c95a;
  if (tool === 'lower') return 0x5aa7f0;
  if (tool === 'smooth') return 0x83d478;
  if (tool === 'flatten') return 0xd8c27a;
  if (tool === 'paint') return 0xa77af2;
  if (tool === 'erase') return 0xe65b62;
  return 0x66c6ff;
}

export class WorldEditor {
  private readonly worlds = new WorldDatabase();
  private readonly runtime: WorldRuntime;
  private readonly environment: WorldEnvironment;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly transformControls: TransformControls;
  private readonly transformEvents: LooseEventTarget;
  private selectionBox: THREE.BoxHelper | null = null;
  private selectedId: string | null = null;
  private transformDragging = false;
  private history: WorldDocument[] = [];
  private historyIndex = -1;
  private documentState = createWorldDocument();
  private saveTimer = 0;
  private toolState: WorldAuthoringTool = 'select';
  private brush: TerrainBrushSettings = { radius: 7, strength: 5, falloff: 'smooth', paintLayerId: 'grass' };
  private strokeActive = false;
  private strokeRegion: TerrainRegion | null = null;
  private lastStrokePoint: THREE.Vector3 | null = null;
  private flattenTarget = 0;
  private blockerStart: THREE.Vector3 | null = null;
  private strokePaintErase = false;
  private maskPreviewLayerId: string | null = null;
  private objectsVisible = true;

  constructor(private readonly engine: Engine, private readonly canvas: HTMLCanvasElement, private readonly events: WorldEditorEvents) {
    this.environment = new WorldEnvironment(engine.scene, this.documentState, true);
    this.runtime = new WorldRuntime(engine.scene, {
      onAssetError: (message) => events.onStatus(message, 'error'),
      heightAt: (x, z) => this.environment.terrainHeight(x, z),
    });
    this.transformControls = new TransformControls(engine.camera.camera, canvas);
    this.transformControls.setMode('translate');
    this.transformControls.setTranslationSnap(0.5);
    this.transformControls.setRotationSnap(THREE.MathUtils.degToRad(15));
    this.transformControls.setScaleSnap(0.1);
    this.engine.scene.add(this.transformControls.getHelper());
    this.transformEvents = this.transformControls as unknown as LooseEventTarget;
    this.transformEvents.addEventListener('dragging-changed', this.handleDraggingChanged);
    this.transformEvents.addEventListener('objectChange', this.handleObjectChange);
    this.transformEvents.addEventListener('mouseUp', this.handleTransformEnd);
  }

  get document(): WorldDocument { return this.documentState; }
  get selectedEntityId(): string | null { return this.selectedId; }
  get activeTool(): WorldAuthoringTool { return this.toolState; }
  get brushSettings(): TerrainBrushSettings { return { ...this.brush }; }
  get terrainMaskPreviewLayerId(): string | null { return this.maskPreviewLayerId; }
  get isTransformInteracting(): boolean { return this.transformDragging || this.transformControls.axis !== null; }
  get isAuthoringInteracting(): boolean { return this.strokeActive || this.blockerStart !== null; }

  async initialize(): Promise<void> {
    let summaries = await this.worlds.list();
    if (summaries.length === 0) {
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy) {
        try {
          const migrated = parseWorldDocument(JSON.parse(legacy));
          await this.worlds.put(migrated); await this.worlds.setCurrentId(migrated.id); localStorage.removeItem(LEGACY_STORAGE_KEY);
          summaries = await this.worlds.list(); this.events.onStatus('Mapa legado migrado para WorldDocument v4.', 'success');
        } catch (error) { this.events.onStatus(`Mapa legado ignorado: ${error instanceof Error ? error.message : String(error)}`, 'error'); }
      }
    }
    const currentId = await this.worlds.getCurrentId();
    let document = currentId ? await this.worlds.get(currentId) : undefined;
    if (!document && summaries[0]) document = await this.worlds.get(summaries[0].id);
    if (!document) { document = createWorldDocument('Mapa Principal'); await this.worlds.put(document); }
    await this.activateDocument(document);
  }

  dispose(): void {
    if (this.saveTimer) window.clearTimeout(this.saveTimer);
    this.clearSelection(); this.environment.setBrushPreview(null, this.brush.radius); this.environment.setBlockerPreview(null, null);
    this.transformEvents.removeEventListener('dragging-changed', this.handleDraggingChanged);
    this.transformEvents.removeEventListener('objectChange', this.handleObjectChange);
    this.transformEvents.removeEventListener('mouseUp', this.handleTransformEnd);
    this.engine.scene.remove(this.transformControls.getHelper()); this.transformControls.dispose(); this.runtime.dispose(); this.environment.dispose();
  }

  async listWorlds(): Promise<WorldSummary[]> { return this.worlds.list(); }

  async createNewWorld(name = 'Novo mapa'): Promise<void> {
    await this.saveCurrent(); const document = createWorldDocument(name); await this.worlds.put(document); await this.activateDocument(document); this.events.onStatus(`Mapa “${document.name}” criado.`, 'success');
  }

  async openWorld(id: string): Promise<void> {
    if (id === this.documentState.id) return; await this.saveCurrent(); const document = await this.worlds.get(id); if (!document) throw new Error('Mapa não encontrado.');
    await this.activateDocument(document); this.events.onStatus(`Mapa “${document.name}” aberto.`, 'success');
  }

  async duplicateCurrentWorld(): Promise<void> {
    await this.saveCurrent(); const copy = duplicateWorldDocument(this.documentState); await this.worlds.put(copy); await this.activateDocument(copy); this.events.onStatus(`Mapa duplicado como “${copy.name}”.`, 'success');
  }

  async deleteWorld(id: string): Promise<void> {
    const summaries = await this.worlds.list(); await this.worlds.delete(id); if (id !== this.documentState.id) return;
    const next = summaries.find((entry) => entry.id !== id);
    if (next) { const document = await this.worlds.get(next.id); if (document) await this.activateDocument(document); }
    else { const document = createWorldDocument('Mapa Principal'); await this.worlds.put(document); await this.activateDocument(document); }
  }

  async updateMapSettings(input: { name: string; description: string; spawn: SerializedVector3; groundSize: number; groundColor: string; backgroundColor: string; }): Promise<void> {
    const normalizedName = input.name.trim(); if (normalizedName) this.documentState.name = normalizedName;
    this.documentState.description = input.description.trim(); this.documentState.spawn = { ...input.spawn };
    this.documentState.environment = {
      groundSize: Math.max(10, Math.min(1000, input.groundSize)),
      groundColor: /^#[0-9a-f]{6}$/i.test(input.groundColor) ? input.groundColor : this.documentState.environment.groundColor,
      backgroundColor: /^#[0-9a-f]{6}$/i.test(input.backgroundColor) ? input.backgroundColor : this.documentState.environment.backgroundColor,
    };
    this.environment.update(this.documentState); this.runtime.reseatGrounded(this.documentState); this.touchDocument(); this.recordHistory(); await this.saveCurrent();
  }

  async saveCurrent(): Promise<void> {
    if (this.saveTimer) { window.clearTimeout(this.saveTimer); this.saveTimer = 0; }
    await this.worlds.put(this.documentState); await this.worlds.setCurrentId(this.documentState.id);
  }

  async preparePlaytest(): Promise<void> { await this.saveCurrent(); storePlaytestWorld(this.documentState); }

  async importWorldJson(json: string): Promise<void> {
    let parsed = parseWorldDocument(JSON.parse(json)); if (await this.worlds.get(parsed.id)) parsed = duplicateWorldDocument(parsed, `${parsed.name} Importado`);
    await this.worlds.put(parsed); await this.activateDocument(parsed); this.events.onStatus(`Mapa “${parsed.name}” importado.`, 'success');
  }

  serialize(): string { return JSON.stringify(this.documentState, null, 2); }

  setMode(mode: TransformMode): void {
    this.setAuthoringTool('select'); this.transformControls.setMode(mode); this.events.onModeChanged(mode);
    this.events.onStatus(`Ferramenta ativa: ${mode === 'translate' ? 'Mover' : mode === 'rotate' ? 'Rotacionar' : 'Escalar'}.`);
  }

  setAuthoringTool(tool: WorldAuthoringTool): void {
    if (this.toolState === tool) return;
    this.finishAuthoringGesture(); this.toolState = tool;
    if (tool !== 'select') { this.clearSelection(); this.transformControls.detach(); }
    this.environment.setBrushPreview(null, this.brush.radius);
    if (tool === 'blocker') this.environment.setLayerVisible('collision', true);
    this.events.onToolChanged(tool); this.events.onStatus(`Ferramenta de mapa: ${tool}.`);
  }

  setBrushSettings(change: Partial<TerrainBrushSettings>): void {
    if (change.radius !== undefined) this.brush.radius = Math.max(0.5, Math.min(80, change.radius));
    if (change.strength !== undefined) this.brush.strength = Math.max(0.1, Math.min(30, change.strength));
    if (change.falloff) this.brush.falloff = change.falloff;
    if (change.paintLayerId && this.documentState.terrain.layers.some((layer) => layer.id === change.paintLayerId)) this.brush.paintLayerId = change.paintLayerId;
    this.events.onDocumentChanged(this.documentState);
  }

  setLayerVisible(layer: EditorWorldLayer, visible: boolean): void {
    if (layer === 'objects') { this.objectsVisible = visible; this.runtime.setObjectsVisible(visible); }
    else this.environment.setLayerVisible(layer, visible);
  }

  getLayerVisible(layer: EditorWorldLayer): boolean { return layer === 'objects' ? this.objectsVisible : this.environment.getLayerVisible(layer); }

  updateWater(change: Partial<WorldDocument['water']>): void {
    this.documentState.water = { ...this.documentState.water, ...change };
    this.documentState.water.level = Math.max(-100, Math.min(100, this.documentState.water.level));
    this.documentState.water.opacity = Math.max(0.05, Math.min(0.95, this.documentState.water.opacity));
    this.environment.update(this.documentState); this.touchDocument(); this.recordHistory();
  }

  addTerrainLayer(input: Partial<TerrainLayerDocument> = {}): string | null {
    if (this.documentState.terrain.layers.length >= MAX_TERRAIN_LAYERS) { this.events.onStatus(`O terreno suporta até ${MAX_TERRAIN_LAYERS} layers.`, 'error'); return null; }
    const layer = createTerrainLayer({ name: `Layer ${this.documentState.terrain.layers.length + 1}`, ...input, fill: input.fill ?? 0 });
    this.documentState.terrain.layers.push(layer); this.brush.paintLayerId = layer.id; this.refreshTerrainAndCommit();
    this.events.onStatus(`Layer “${layer.name}” adicionada.`, 'success'); return layer.id;
  }

  removeTerrainLayer(layerId: string): void {
    const layers = this.documentState.terrain.layers; const index = layers.findIndex((layer) => layer.id === layerId); if (index < 0) return;
    if (layers.length <= 1) { this.events.onStatus('O terreno precisa manter pelo menos uma layer.', 'error'); return; }
    const [removed] = layers.splice(index, 1); this.documentState.terrain.paintStamps = this.documentState.terrain.paintStamps.filter((stamp) => stamp.layerId !== layerId);
    if (this.brush.paintLayerId === layerId) this.brush.paintLayerId = layers[Math.min(index, layers.length - 1)]!.id;
    if (this.maskPreviewLayerId === layerId) this.setTerrainLayerMaskPreview(null);
    this.refreshTerrainAndCommit(); this.events.onStatus(`Layer “${removed?.name ?? layerId}” removida com sua pintura.`, 'success');
  }

  duplicateTerrainLayer(layerId: string): string | null {
    const source = this.layerById(layerId); if (!source) return null;
    if (this.documentState.terrain.layers.length >= MAX_TERRAIN_LAYERS) { this.events.onStatus(`O terreno suporta até ${MAX_TERRAIN_LAYERS} layers.`, 'error'); return null; }
    const copy = createTerrainLayer({ ...source, id: undefined, name: `${source.name} Copy`, solo: false, fill: 0 });
    const sourceIndex = this.documentState.terrain.layers.indexOf(source); this.documentState.terrain.layers.splice(sourceIndex + 1, 0, copy);
    this.brush.paintLayerId = copy.id; this.refreshTerrainAndCommit(); return copy.id;
  }

  moveTerrainLayer(layerId: string, targetIndex: number): void {
    const layers = this.documentState.terrain.layers; const from = layers.findIndex((layer) => layer.id === layerId); if (from < 0) return;
    const to = Math.max(0, Math.min(layers.length - 1, Math.floor(targetIndex))); if (from === to) return;
    const [layer] = layers.splice(from, 1); if (!layer) return; layers.splice(to, 0, layer); this.refreshTerrainAndCommit();
  }

  setTerrainLayerMaterial(layerId: string, material: { id: string; name: string } | null): void {
    const layer = this.layerById(layerId); if (!layer) return;
    if (material) { layer.materialId = material.id; layer.materialName = material.name; }
    else { delete layer.materialId; delete layer.materialName; }
    this.refreshTerrainAndCommit();
  }

  updateTerrainLayer(layerId: string, change: Partial<Omit<TerrainLayerDocument, 'id'>>): void {
    const layer = this.layerById(layerId); if (!layer) return;
    if (change.name?.trim()) layer.name = change.name.trim();
    if (change.fallbackColor && /^#[0-9a-f]{6}$/i.test(change.fallbackColor)) layer.fallbackColor = change.fallbackColor;
    if (change.tint && /^#[0-9a-f]{6}$/i.test(change.tint)) layer.tint = change.tint;
    if (change.tileScale !== undefined) layer.tileScale = Math.max(0.25, Math.min(100, change.tileScale));
    if (change.rotation !== undefined) layer.rotation = Math.max(-3600, Math.min(3600, change.rotation));
    if (change.opacity !== undefined) layer.opacity = Math.max(0, Math.min(1, change.opacity));
    if (change.normalStrength !== undefined) layer.normalStrength = Math.max(0, Math.min(4, change.normalStrength));
    if (change.roughnessMultiplier !== undefined) layer.roughnessMultiplier = Math.max(0, Math.min(4, change.roughnessMultiplier));
    if (change.visible !== undefined) layer.visible = change.visible;
    if (change.locked !== undefined) layer.locked = change.locked;
    if (change.fill !== undefined) layer.fill = Math.max(0, Math.min(1, change.fill));
    if (change.solo !== undefined) {
      if (change.solo) this.documentState.terrain.layers.forEach((candidate) => { candidate.solo = candidate.id === layerId; });
      else layer.solo = false;
    }
    this.refreshTerrainAndCommit();
  }

  clearTerrainLayerPaint(layerId: string): void {
    const layer = this.layerById(layerId); if (!layer) return;
    this.documentState.terrain.paintStamps = this.documentState.terrain.paintStamps.filter((stamp) => stamp.layerId !== layerId); layer.fill = 0;
    this.refreshTerrainAndCommit(); this.events.onStatus(`Pintura de “${layer.name}” limpa.`, 'success');
  }

  fillTerrainLayer(layerId: string): void {
    const layer = this.layerById(layerId); if (!layer) return; if (layer.locked) { this.events.onStatus('Desbloqueie a layer antes de preencher.', 'error'); return; }
    layer.fill = 1; this.refreshTerrainAndCommit(); this.events.onStatus(`“${layer.name}” preenchendo o terreno inteiro.`, 'success');
  }

  setTerrainLayerMaskPreview(layerId: string | null): void {
    this.maskPreviewLayerId = layerId && this.layerById(layerId) ? layerId : null;
    this.environment.setTerrainMaskPreview(this.documentState, this.maskPreviewLayerId); this.events.onDocumentChanged(this.documentState);
  }

  surfaceAt(clientX: number, clientY: number): THREE.Vector3 | null { return this.environment.surfaceAt(this.engine.camera.camera, this.canvas, clientX, clientY); }
  terrainHeightAt(x: number, z: number): number { return this.environment.terrainHeight(x, z); }

  handleAuthoringPointerDown(event: PointerEvent): boolean {
    if (event.button !== 0 || this.toolState === 'select' || this.toolState === 'water') return false;
    const point = this.surfaceAt(event.clientX, event.clientY); if (!point) return false;
    if (this.toolState === 'spawn') {
      this.documentState.spawn = { x: point.x, y: point.y, z: point.z }; this.environment.update(this.documentState); this.touchDocument(); this.recordHistory(); this.events.onStatus('Spawn definido no terreno.', 'success'); return true;
    }
    if (this.toolState === 'blocker') { this.blockerStart = point.clone(); this.environment.setBlockerPreview(this.blockerStart, point); return true; }
    if (isTerrainTool(this.toolState)) {
      if (this.toolState === 'paint') {
        const layer = this.layerById(this.brush.paintLayerId);
        if (!layer) return false;
        if (layer.locked) { this.events.onStatus(`Layer “${layer.name}” está bloqueada.`, 'error'); return true; }
        this.strokePaintErase = event.shiftKey;
      }
      this.strokeActive = true; this.strokeRegion = null; this.lastStrokePoint = null; this.flattenTarget = point.y; this.applyBrush(point); return true;
    }
    return false;
  }

  handleAuthoringPointerMove(event: PointerEvent): boolean {
    if (this.toolState === 'select' || this.toolState === 'water') return false;
    const point = this.surfaceAt(event.clientX, event.clientY);
    if (isTerrainTool(this.toolState)) this.environment.setBrushPreview(point, this.brush.radius, brushColor(this.toolState, this.toolState === 'paint' && (this.strokePaintErase || event.shiftKey)));
    if (this.blockerStart && point) { this.environment.setBlockerPreview(this.blockerStart, point); return true; }
    if (this.strokeActive && point) { this.applyBrush(point); return true; }
    return false;
  }

  handleAuthoringPointerUp(event: PointerEvent): boolean {
    if (event.button !== 0) return false;
    if (this.blockerStart) {
      const end = this.surfaceAt(event.clientX, event.clientY); const start = this.blockerStart; this.blockerStart = null; this.environment.setBlockerPreview(null, null);
      if (end && Math.hypot(end.x - start.x, end.z - start.z) >= 0.5) {
        this.documentState.blockers.push(createBlocker({ x1: start.x, z1: start.z, x2: end.x, z2: end.z }));
        this.environment.update(this.documentState); this.touchDocument(); this.recordHistory(); this.events.onStatus('Blocker adicionado.', 'success');
      }
      return true;
    }
    if (this.strokeActive) { this.strokeActive = false; this.strokePaintErase = false; this.lastStrokePoint = null; this.schedulePersist(); this.recordHistory(); return true; }
    return false;
  }

  select(entityId: string | null): void {
    if (entityId === this.selectedId) return; this.clearSelectionVisuals(); this.selectedId = entityId;
    if (!entityId) { this.events.onSelectionChanged(null); return; }
    const object = this.runtime.getObject(entityId); const entity = this.getEntity(entityId);
    if (!object || !entity) { this.selectedId = null; this.events.onSelectionChanged(null); return; }
    this.transformControls.attach(object); this.selectionBox = new THREE.BoxHelper(object, 0x78baff); this.selectionBox.userData.editorHelper = true; this.engine.scene.add(this.selectionBox); this.events.onSelectionChanged(entity);
  }

  clearSelection(): void { this.select(null); }

  selectFromPointer(event: PointerEvent): boolean {
    if (this.toolState !== 'select' || event.button !== 0 || this.isTransformInteracting) return false;
    const rect = this.canvas.getBoundingClientRect(); this.pointer.x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1; this.pointer.y = -((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.engine.camera.camera);
    for (const hit of this.raycaster.intersectObjects(this.runtime.getObjects(), true)) {
      let current: THREE.Object3D | null = hit.object;
      while (current) { const id = current.userData.worldEntityId as string | undefined; if (id) { this.select(id); return true; } current = current.parent; }
    }
    this.clearSelection(); return false;
  }

  async placeAsset(asset: AssetRecord, position: SerializedVector3): Promise<void> {
    const entity = createWorldEntity({ assetId: asset.id, assetName: asset.name, position: { ...position, y: this.terrainHeightAt(position.x, position.z) } });
    this.documentState.entities.push(entity); await this.runtime.add(entity, asset); this.touchDocument(); this.recordHistory(); this.select(entity.id); this.events.onStatus(`${entity.name} colocado no mapa.`, 'success');
  }

  async duplicateSelected(): Promise<void> {
    const source = this.getSelectedEntity(); if (!source) return;
    const copy = createWorldEntity({ assetId: source.assetId, assetName: source.assetName, name: `${source.name} Copy`, position: { x: source.position.x + 0.5, y: source.position.y, z: source.position.z + 0.5 } });
    copy.rotation = { ...source.rotation }; copy.scale = { ...source.scale }; copy.visible = source.visible; copy.grounded = source.grounded; copy.groundOffset = source.groundOffset; copy.collision = { ...source.collision };
    if (copy.grounded) copy.position.y = this.terrainHeightAt(copy.position.x, copy.position.z) + copy.groundOffset;
    this.documentState.entities.push(copy); await this.runtime.add(copy); this.touchDocument(); this.recordHistory(); this.select(copy.id);
  }

  deleteSelected(): void {
    const entity = this.getSelectedEntity(); if (!entity) return; this.clearSelection(); this.runtime.remove(entity.id); this.documentState.entities = this.documentState.entities.filter((candidate) => candidate.id !== entity.id); this.touchDocument(); this.recordHistory();
  }

  focusSelected(): void {
    const object = this.selectedId ? this.runtime.getObject(this.selectedId) : undefined; if (!object) return; const bounds = new THREE.Box3().setFromObject(object); this.engine.camera.setTarget(bounds.isEmpty() ? object.position.clone() : bounds.getCenter(new THREE.Vector3()));
  }

  renameSelected(name: string): void { const entity = this.getSelectedEntity(); const normalized = name.trim(); if (!entity || !normalized || normalized === entity.name) return; entity.name = normalized; const object = this.runtime.getObject(entity.id); if (object) object.name = normalized; this.touchDocument(); this.recordHistory(); }
  setSelectedVisible(visible: boolean): void { const entity = this.getSelectedEntity(); if (!entity || entity.visible === visible) return; entity.visible = visible; const object = this.runtime.getObject(entity.id); if (object) object.visible = visible; this.touchDocument(); this.recordHistory(); }

  setSelectedGrounding(grounded: boolean, offset?: number): void {
    const entity = this.getSelectedEntity(); const object = entity ? this.runtime.getObject(entity.id) : undefined; if (!entity || !object) return;
    entity.grounded = grounded; if (offset !== undefined && Number.isFinite(offset)) entity.groundOffset = offset;
    if (grounded) entity.position.y = this.terrainHeightAt(entity.position.x, entity.position.z) + entity.groundOffset;
    applyEntityTransform(entity, object); this.selectionBox?.update(); this.touchDocument(); this.recordHistory();
  }

  snapSelectedToGround(): void { const entity = this.getSelectedEntity(); if (!entity) return; this.setSelectedGrounding(true, entity.groundOffset); }

  setSelectedCollision(mode: EntityCollisionMode, radius?: number): void {
    const entity = this.getSelectedEntity(); if (!entity) return; entity.collision = mode === 'radius' ? { mode, radius: Math.max(0.1, Math.min(30, radius ?? entity.collision.radius ?? 1)) } : { mode }; this.touchDocument(); this.recordHistory();
  }

  updateSelectedTransform(transform: { position: SerializedVector3; rotationDegrees: SerializedVector3; scale: SerializedVector3 }): void {
    const entity = this.getSelectedEntity(); const object = entity ? this.runtime.getObject(entity.id) : undefined; if (!entity || !object) return;
    entity.position = { ...transform.position };
    entity.rotation = { x: THREE.MathUtils.degToRad(transform.rotationDegrees.x), y: THREE.MathUtils.degToRad(transform.rotationDegrees.y), z: THREE.MathUtils.degToRad(transform.rotationDegrees.z) };
    entity.scale = { x: Math.max(0.001, transform.scale.x), y: Math.max(0.001, transform.scale.y), z: Math.max(0.001, transform.scale.z) };
    if (entity.grounded) entity.position.y = this.terrainHeightAt(entity.position.x, entity.position.z) + entity.groundOffset;
    applyEntityTransform(entity, object); this.selectionBox?.update(); this.touchDocument(); this.recordHistory();
  }

  getSelectedEntity(): WorldEntityDocument | null { return this.selectedId ? this.getEntity(this.selectedId) ?? null : null; }
  canUndo(): boolean { return this.historyIndex > 0; }
  canRedo(): boolean { return this.historyIndex >= 0 && this.historyIndex < this.history.length - 1; }
  async undo(): Promise<void> { if (!this.canUndo()) return; this.historyIndex -= 1; await this.restoreHistory(); }
  async redo(): Promise<void> { if (!this.canRedo()) return; this.historyIndex += 1; await this.restoreHistory(); }

  private applyBrush(point: THREE.Vector3): void {
    if (this.lastStrokePoint && point.distanceTo(this.lastStrokePoint) < Math.max(0.18, this.brush.radius * 0.2)) return;
    this.lastStrokePoint = point.clone(); let region: TerrainRegion | null = null;
    if (this.toolState === 'paint') {
      if (this.documentState.terrain.paintStamps.length >= MAX_STAMPS) { this.events.onStatus('Limite de pintura do terreno atingido.', 'error'); return; }
      const layer = this.layerById(this.brush.paintLayerId); if (!layer || layer.locked) return;
      const stamp = createPaintStamp({ x: point.x, z: point.z, radius: this.brush.radius, layerId: layer.id, strength: Math.min(1, this.brush.strength / 10), mode: this.strokePaintErase ? 'erase' : 'paint' });
      this.documentState.terrain.paintStamps.push(stamp); region = stampRegion(stamp);
    } else if (this.toolState === 'erase') {
      const paintIndex = latestPaintStampIndex(this.documentState.terrain.paintStamps, point.x, point.z);
      const heightIndex = latestHeightStampIndex(this.documentState.terrain.heightStamps, point.x, point.z);
      if (paintIndex >= 0) { const [removed] = this.documentState.terrain.paintStamps.splice(paintIndex, 1); if (removed) region = stampRegion(removed); }
      else if (heightIndex >= 0) { const [removed] = this.documentState.terrain.heightStamps.splice(heightIndex, 1); if (removed) region = stampRegion(removed); }
    } else {
      if (this.documentState.terrain.heightStamps.length >= MAX_STAMPS) { this.events.onStatus('Limite de escultura do terreno atingido.', 'error'); return; }
      let delta = this.brush.strength * 0.11; let mode: 'add' | 'level' = 'add';
      if (this.toolState === 'lower') delta *= -1;
      if (this.toolState === 'smooth') { const current = this.terrainHeightAt(point.x, point.z); const average = averageTerrainHeight(this.documentState, point.x, point.z, this.brush.radius); delta = current + (average - current) * Math.min(0.9, 0.12 + this.brush.strength / 38); mode = 'level'; }
      if (this.toolState === 'flatten') { delta = this.flattenTarget; mode = 'level'; }
      const stamp = createHeightStamp({ x: point.x, z: point.z, radius: this.brush.radius, delta, falloff: this.brush.falloff, mode }); this.documentState.terrain.heightStamps.push(stamp); region = stampRegion(stamp);
    }
    if (!region) return;
    this.strokeRegion = unionTerrainRegion(this.strokeRegion, region); this.documentState.updatedAt = Date.now(); this.environment.refreshTerrain(this.documentState, region); this.runtime.reseatGrounded(this.documentState, region); this.selectionBox?.update();
  }

  private layerById(layerId: string): TerrainLayerDocument | undefined { return this.documentState.terrain.layers.find((layer) => layer.id === layerId); }

  private refreshTerrainAndCommit(): void {
    this.ensureBrushLayer(); this.environment.refreshTerrain(this.documentState); this.environment.setTerrainMaskPreview(this.documentState, this.maskPreviewLayerId); this.touchDocument(); this.recordHistory();
  }

  private ensureBrushLayer(): void {
    if (!this.layerById(this.brush.paintLayerId)) this.brush.paintLayerId = this.documentState.terrain.layers[0]?.id ?? '';
  }

  private finishAuthoringGesture(): void {
    if (this.strokeActive) { this.strokeActive = false; this.lastStrokePoint = null; if (this.strokeRegion) this.recordHistory(); }
    this.strokePaintErase = false; this.strokeRegion = null; this.blockerStart = null; this.environment.setBlockerPreview(null, null);
  }

  private async activateDocument(document: WorldDocument): Promise<void> {
    this.finishAuthoringGesture(); this.clearSelection(); this.documentState = cloneWorldDocument(document); this.ensureBrushLayer(); this.maskPreviewLayerId = null;
    this.environment.update(this.documentState); this.environment.setTerrainMaskPreview(this.documentState, null); await this.runtime.build(this.documentState); this.runtime.setObjectsVisible(this.objectsVisible);
    await this.worlds.setCurrentId(this.documentState.id); this.resetHistory(); this.emitDocumentChanged();
  }

  private getEntity(id: string): WorldEntityDocument | undefined { return this.documentState.entities.find((entity) => entity.id === id); }
  private clearSelectionVisuals(): void { this.transformControls.detach(); if (this.selectionBox) this.engine.scene.remove(this.selectionBox); this.selectionBox = null; }
  private touchDocument(emit = true): void { this.documentState.updatedAt = Date.now(); this.schedulePersist(); if (emit) this.emitDocumentChanged(); }

  private schedulePersist(): void {
    if (this.saveTimer) window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => { this.saveTimer = 0; void this.saveCurrent().catch((error: unknown) => this.events.onStatus(`Autosave falhou: ${error instanceof Error ? error.message : String(error)}`, 'error')); }, 180);
  }

  private emitDocumentChanged(): void { this.events.onDocumentChanged(this.documentState); this.events.onSelectionChanged(this.getSelectedEntity()); }
  private resetHistory(): void { this.history = [cloneWorldDocument(this.documentState)]; this.historyIndex = 0; }
  private recordHistory(): void { this.history.splice(this.historyIndex + 1); this.history.push(cloneWorldDocument(this.documentState)); if (this.history.length > HISTORY_LIMIT) this.history.shift(); this.historyIndex = this.history.length - 1; this.emitDocumentChanged(); }

  private async restoreHistory(): Promise<void> {
    const snapshot = this.history[this.historyIndex]; if (!snapshot) return; this.documentState = cloneWorldDocument(snapshot); this.ensureBrushLayer(); this.environment.update(this.documentState); this.environment.setTerrainMaskPreview(this.documentState, this.maskPreviewLayerId); await this.runtime.build(this.documentState); this.runtime.setObjectsVisible(this.objectsVisible); this.touchDocument();
  }

  private handleDraggingChanged = (event: unknown): void => { this.transformDragging = Boolean((event as { value?: boolean }).value); };
  private handleObjectChange = (): void => {
    const entity = this.getSelectedEntity(); const object = entity ? this.runtime.getObject(entity.id) : undefined; if (!entity || !object) return; syncEntityTransform(entity, object);
    if (entity.grounded) entity.groundOffset = object.position.y - this.terrainHeightAt(object.position.x, object.position.z); this.selectionBox?.update(); this.touchDocument();
  };
  private handleTransformEnd = (): void => { if (!this.getSelectedEntity()) return; this.touchDocument(); this.recordHistory(); };
}
