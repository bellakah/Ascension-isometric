import * as THREE from 'three';
import { AssetDatabase } from '../assets/AssetDatabase';
import { loadStoredAsset } from '../assets/AssetLoader';
import type { AssetRecord } from '../assets/types';
import type { WorldDocument, WorldEntityDocument } from './WorldDocument';

export function applyEntityTransform(entity: WorldEntityDocument, object: THREE.Object3D): void {
  object.position.set(entity.position.x, entity.position.y, entity.position.z);
  object.rotation.set(entity.rotation.x, entity.rotation.y, entity.rotation.z);
  object.scale.set(entity.scale.x, entity.scale.y, entity.scale.z);
  object.visible = entity.visible;
  object.updateMatrixWorld(true);
}

export function syncEntityTransform(entity: WorldEntityDocument, object: THREE.Object3D): void {
  entity.position = { x: object.position.x, y: object.position.y, z: object.position.z };
  entity.rotation = { x: object.rotation.x, y: object.rotation.y, z: object.rotation.z };
  entity.scale = {
    x: Math.max(0.001, object.scale.x),
    y: Math.max(0.001, object.scale.y),
    z: Math.max(0.001, object.scale.z),
  };
  entity.visible = object.visible;
}

function alignModelToRoot(model: THREE.Object3D): void {
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  if (!bounds.isEmpty()) model.position.y -= bounds.min.y;
}

function missingAssetPlaceholder(entity: WorldEntityDocument): THREE.Object3D {
  const group = new THREE.Group();
  const geometry = new THREE.BoxGeometry(1.2, 1.2, 1.2);
  const material = new THREE.MeshStandardMaterial({ color: 0xb94d5b, wireframe: true });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = 0.6;
  group.add(mesh);
  group.name = `Missing asset: ${entity.assetName}`;
  return group;
}

export interface WorldRuntimeOptions {
  onAssetError?(message: string): void;
}

export class WorldRuntime {
  private readonly database = new AssetDatabase();
  private readonly runtimeObjects = new Map<string, THREE.Object3D>();
  private rebuildToken = 0;

  constructor(private readonly scene: THREE.Scene, private readonly options: WorldRuntimeOptions = {}) {}

  getObject(entityId: string): THREE.Object3D | undefined {
    return this.runtimeObjects.get(entityId);
  }

  getObjects(): THREE.Object3D[] {
    return [...this.runtimeObjects.values()];
  }

  async build(document: WorldDocument): Promise<void> {
    const token = ++this.rebuildToken;
    this.clear();
    for (const entity of document.entities) {
      if (token !== this.rebuildToken) return;
      await this.add(entity);
    }
  }

  async add(entity: WorldEntityDocument, knownAsset?: AssetRecord): Promise<THREE.Object3D> {
    const previous = this.runtimeObjects.get(entity.id);
    if (previous) this.scene.remove(previous);

    const root = new THREE.Group();
    root.name = entity.name;
    root.userData.worldEntityId = entity.id;
    const asset = knownAsset ?? await this.database.get(entity.assetId);
    if (asset) {
      try {
        const loaded = await loadStoredAsset(asset);
        const model = loaded.scene;
        alignModelToRoot(model);
        root.add(model);
      } catch (error) {
        root.add(missingAssetPlaceholder(entity));
        this.options.onAssetError?.(`Falha ao carregar ${entity.assetName}: ${error instanceof Error ? error.message : String(error)}`);
      }
    } else {
      root.add(missingAssetPlaceholder(entity));
      this.options.onAssetError?.(`Asset ausente: ${entity.assetName}.`);
    }
    applyEntityTransform(entity, root);
    this.runtimeObjects.set(entity.id, root);
    this.scene.add(root);
    return root;
  }

  remove(entityId: string): void {
    const object = this.runtimeObjects.get(entityId);
    if (object) this.scene.remove(object);
    this.runtimeObjects.delete(entityId);
  }

  clear(): void {
    for (const object of this.runtimeObjects.values()) this.scene.remove(object);
    this.runtimeObjects.clear();
  }

  dispose(): void {
    ++this.rebuildToken;
    this.clear();
  }
}
