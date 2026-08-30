import * as THREE from 'three';
import { cloneAssetScene, loadStoredAsset } from '../assets/AssetLoader';
import type { AssetRecord } from '../assets/types';
import type { Engine } from '../engine/Engine';
import type { SerializedVector3 } from '../world/WorldDocument';

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
  private activeAsset: AssetRecord | null = null;
  private loadToken = 0;

  constructor(
    private readonly engine: Engine,
    private readonly canvas: HTMLCanvasElement,
    private readonly onPlace: (asset: AssetRecord, position: SerializedVector3) => Promise<void> | void,
    private readonly onStatus: (message: string) => void,
  ) {
    canvas.addEventListener('pointermove', this.handlePointerMove);
    canvas.addEventListener('pointerdown', this.handlePointerDown);
    window.addEventListener('keydown', this.handleKeyDown);
  }

  get isActive(): boolean {
    return this.activeAsset !== null;
  }

  async activate(asset: AssetRecord): Promise<void> {
    this.cancel();
    const token = ++this.loadToken;
    this.onStatus(`Carregando ${asset.name} para posicionamento...`);
    const loaded = await loadStoredAsset(asset);
    if (token !== this.loadToken) return;

    this.activeAsset = asset;
    this.ghost = cloneAssetScene(loaded.scene);
    alignBottomToGround(this.ghost);
    prepareGhost(this.ghost);
    this.engine.scene.add(this.ghost);
    this.onStatus(`Posicionamento ativo: ${asset.name}. Clique para colocar · ESC cancela.`);
  }

  cancel(): void {
    ++this.loadToken;
    if (this.ghost) this.engine.scene.remove(this.ghost);
    this.ghost = null;
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
    this.pointer.x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
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
    if (event.button !== 0 || !this.ghost || !this.activeAsset) return;
    const hit = this.updatePointer(event);
    if (!hit) return;
    const position = {
      x: Math.round(hit.x * 2) / 2,
      y: 0,
      z: Math.round(hit.z * 2) / 2,
    };
    void Promise.resolve(this.onPlace(this.activeAsset, position)).catch((error: unknown) => {
      this.onStatus(`Não foi possível colocar ${this.activeAsset?.name ?? 'asset'}: ${error instanceof Error ? error.message : String(error)}`);
    });
  };

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (event.code !== 'Escape' || !this.activeAsset) return;
    const name = this.activeAsset.name;
    this.cancel();
    this.onStatus(`Posicionamento de ${name} cancelado.`);
  };
}
