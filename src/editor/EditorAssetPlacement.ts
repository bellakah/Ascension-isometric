import * as THREE from 'three';
import { cloneAssetScene, loadStoredAsset } from '../assets/AssetLoader';
import type { AssetRecord } from '../assets/types';
import type { Engine } from '../engine/Engine';

function makeGhostMaterial(material: THREE.Material): THREE.Material {
  const cloned = material.clone();
  cloned.transparent = true;
  cloned.opacity = 0.5;
  cloned.depthWrite = false;
  return cloned;
}

function prepareGhost(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.material = Array.isArray(child.material)
      ? child.material.map(makeGhostMaterial)
      : makeGhostMaterial(child.material);
    child.castShadow = false;
  });
}

function alignBottomToGround(object: THREE.Object3D): void {
  object.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(object);
  if (!bounds.isEmpty()) object.position.y -= bounds.min.y;
}

export class EditorAssetPlacement {
  private readonly plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private ghost: THREE.Object3D | null = null;
  private template: THREE.Object3D | null = null;
  private activeAsset: AssetRecord | null = null;
  private loadToken = 0;

  constructor(
    private readonly engine: Engine,
    private readonly canvas: HTMLCanvasElement,
    private readonly onStatus: (message: string) => void,
  ) {
    canvas.addEventListener('pointermove', this.handlePointerMove);
    canvas.addEventListener('pointerdown', this.handlePointerDown);
    window.addEventListener('keydown', this.handleKeyDown);
  }

  async activate(asset: AssetRecord): Promise<void> {
    this.cancel();
    const token = ++this.loadToken;
    this.onStatus(`Carregando ${asset.name} para posicionamento...`);
    const loaded = await loadStoredAsset(asset);
    if (token !== this.loadToken) return;

    this.activeAsset = asset;
    this.template = loaded.scene;
    this.ghost = cloneAssetScene(loaded.scene);
    alignBottomToGround(this.ghost);
    prepareGhost(this.ghost);
    this.engine.scene.add(this.ghost);
    this.onStatus(`Posicionamento ativo: ${asset.name}. Clique no chão para colocar · ESC cancela.`);
  }

  cancel(): void {
    ++this.loadToken;
    if (this.ghost) this.engine.scene.remove(this.ghost);
    this.ghost = null;
    this.template = null;
    this.activeAsset = null;
  }

  dispose(): void {
    this.cancel();
    this.canvas.removeEventListener('pointermove', this.handlePointerMove);
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    window.removeEventListener('keydown', this.handleKeyDown);
  }

  private updatePointer(event: PointerEvent): THREE.Vector3 | null {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.engine.camera.camera);
    const hit = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(this.plane, hit);
  }

  private handlePointerMove = (event: PointerEvent): void => {
    if (!this.ghost) return;
    const hit = this.updatePointer(event);
    if (!hit) return;
    this.ghost.position.x = Math.round(hit.x * 2) / 2;
    this.ghost.position.z = Math.round(hit.z * 2) / 2;
  };

  private handlePointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || !this.ghost || !this.template || !this.activeAsset) return;
    const hit = this.updatePointer(event);
    if (!hit) return;

    const placed = cloneAssetScene(this.template);
    alignBottomToGround(placed);
    placed.position.x = Math.round(hit.x * 2) / 2;
    placed.position.z = Math.round(hit.z * 2) / 2;
    placed.name = `asset:${this.activeAsset.id}`;
    this.engine.scene.add(placed);
    this.onStatus(`${this.activeAsset.name} colocado em X ${placed.position.x.toFixed(1)} / Z ${placed.position.z.toFixed(1)}.`);
  };

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (event.code !== 'Escape' || !this.activeAsset) return;
    const name = this.activeAsset.name;
    this.cancel();
    this.onStatus(`Posicionamento de ${name} cancelado.`);
  };
}
