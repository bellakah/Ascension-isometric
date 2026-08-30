import * as THREE from 'three';
import { cloneAssetScene, loadStoredAsset } from '../assets/AssetLoader';
import type { AssetRecord } from '../assets/types';
import type { Engine } from '../engine/Engine';
import type { SerializedVector3 } from '../world/WorldDocument';

function makeGhostMaterial(material: THREE.Material): THREE.Material {
  const cloned = material.clone(); cloned.transparent = true; cloned.opacity = 0.5; cloned.depthWrite = false; return cloned;
}

function prepareGhost(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.material = Array.isArray(child.material) ? child.material.map(makeGhostMaterial) : makeGhostMaterial(child.material);
    child.castShadow = false;
  });
}

function alignBottomToGround(object: THREE.Object3D): void {
  object.updateMatrixWorld(true); const bounds = new THREE.Box3().setFromObject(object); if (!bounds.isEmpty()) object.position.y -= bounds.min.y;
}

export class EditorAssetPlacement {
  private ghost: THREE.Object3D | null = null;
  private activeAsset: AssetRecord | null = null;
  private loadToken = 0;

  constructor(
    private readonly engine: Engine,
    private readonly canvas: HTMLCanvasElement,
    private readonly surfaceAt: (clientX: number, clientY: number) => THREE.Vector3 | null,
    private readonly onPlace: (asset: AssetRecord, position: SerializedVector3) => Promise<void> | void,
    private readonly onStatus: (message: string) => void,
  ) {
    canvas.addEventListener('pointermove', this.handlePointerMove); canvas.addEventListener('pointerdown', this.handlePointerDown); window.addEventListener('keydown', this.handleKeyDown);
  }

  get isActive(): boolean { return this.activeAsset !== null; }

  async activate(asset: AssetRecord): Promise<void> {
    this.cancel(); const token = ++this.loadToken; this.onStatus(`Carregando ${asset.name} para posicionamento...`); const loaded = await loadStoredAsset(asset); if (token !== this.loadToken) return;
    this.activeAsset = asset; this.ghost = cloneAssetScene(loaded.scene); alignBottomToGround(this.ghost); prepareGhost(this.ghost); this.engine.scene.add(this.ghost);
    this.onStatus(`Posicionamento ativo: ${asset.name}. Clique no terreno para colocar · ESC cancela.`);
  }

  cancel(): void { ++this.loadToken; if (this.ghost) this.engine.scene.remove(this.ghost); this.ghost = null; this.activeAsset = null; }
  dispose(): void { this.cancel(); this.canvas.removeEventListener('pointermove', this.handlePointerMove); this.canvas.removeEventListener('pointerdown', this.handlePointerDown); window.removeEventListener('keydown', this.handleKeyDown); }

  private snapped(event: PointerEvent): THREE.Vector3 | null {
    const hit = this.surfaceAt(event.clientX, event.clientY); if (!hit) return null;
    const x = Math.round(hit.x * 2) / 2; const z = Math.round(hit.z * 2) / 2;
    const surface = this.surfaceAt(event.clientX, event.clientY);
    return new THREE.Vector3(x, surface?.y ?? hit.y, z);
  }

  private handlePointerMove = (event: PointerEvent): void => {
    if (!this.ghost) return; const hit = this.snapped(event); if (!hit) return; this.ghost.position.set(hit.x, hit.y, hit.z);
  };

  private handlePointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || !this.ghost || !this.activeAsset) return; const hit = this.snapped(event); if (!hit) return;
    const position = { x: hit.x, y: hit.y, z: hit.z };
    void Promise.resolve(this.onPlace(this.activeAsset, position)).catch((error: unknown) => this.onStatus(`Não foi possível colocar ${this.activeAsset?.name ?? 'asset'}: ${error instanceof Error ? error.message : String(error)}`));
  };

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (event.code !== 'Escape' || !this.activeAsset) return; const name = this.activeAsset.name; this.cancel(); this.onStatus(`Posicionamento de ${name} cancelado.`);
  };
}
