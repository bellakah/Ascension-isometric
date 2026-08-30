import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { AssetDatabase } from '../assets/AssetDatabase';
import { loadStoredAsset } from '../assets/AssetLoader';
import type { AssetRecord } from '../assets/types';
import type { Engine } from '../engine/Engine';
import {
  cloneWorldDocument,
  createWorldDocument,
  createWorldEntity,
  parseWorldDocument,
  type SerializedVector3,
  type WorldDocument,
  type WorldEntityDocument,
} from '../world/WorldDocument';

const STORAGE_KEY = 'ascension-isometric-world-document-v1';
const HISTORY_LIMIT = 80;

export type TransformMode = 'translate' | 'rotate' | 'scale';

export interface WorldEditorEvents {
  onDocumentChanged(document: WorldDocument): void;
  onSelectionChanged(entity: WorldEntityDocument | null): void;
  onModeChanged(mode: TransformMode): void;
  onStatus(message: string, tone?: 'normal' | 'success' | 'error'): void;
}

type LooseEventTarget = {
  addEventListener(type: string, listener: (event: unknown) => void): void;
  removeEventListener(type: string, listener: (event: unknown) => void): void;
};

function copyTransform(entity: WorldEntityDocument, object: THREE.Object3D): void {
  object.position.set(entity.position.x, entity.position.y, entity.position.z);
  object.rotation.set(entity.rotation.x, entity.rotation.y, entity.rotation.z);
  object.scale.set(entity.scale.x, entity.scale.y, entity.scale.z);
  object.visible = entity.visible;
  object.updateMatrixWorld(true);
}

function syncTransform(entity: WorldEntityDocument, object: THREE.Object3D): void {
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

export class WorldEditor {
  private readonly database = new AssetDatabase();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly transformControls: TransformControls;
  private readonly transformEvents: LooseEventTarget;
  private readonly runtimeObjects = new Map<string, THREE.Object3D>();
  private selectionBox: THREE.BoxHelper | null = null;
  private selectedId: string | null = null;
  private transformDragging = false;
  private rebuildToken = 0;
  private history: WorldDocument[] = [];
  private historyIndex = -1;
  private documentState = createWorldDocument();

  constructor(
    private readonly engine: Engine,
    private readonly canvas: HTMLCanvasElement,
    private readonly events: WorldEditorEvents,
  ) {
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

  get document(): WorldDocument {
    return this.documentState;
  }

  get selectedEntityId(): string | null {
    return this.selectedId;
  }

  get isTransformInteracting(): boolean {
    return this.transformDragging || this.transformControls.axis !== null;
  }

  async initialize(): Promise<void> {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        this.documentState = parseWorldDocument(JSON.parse(saved));
      } catch (error) {
        this.events.onStatus(`WorldDocument local ignorado: ${error instanceof Error ? error.message : String(error)}`, 'error');
        this.documentState = createWorldDocument();
      }
    }
    await this.rebuildScene();
    this.resetHistory();
    this.emitDocumentChanged();
  }

  dispose(): void {
    ++this.rebuildToken;
    this.clearSelection();
    this.transformEvents.removeEventListener('dragging-changed', this.handleDraggingChanged);
    this.transformEvents.removeEventListener('objectChange', this.handleObjectChange);
    this.transformEvents.removeEventListener('mouseUp', this.handleTransformEnd);
    this.engine.scene.remove(this.transformControls.getHelper());
    this.transformControls.dispose();
    for (const object of this.runtimeObjects.values()) this.engine.scene.remove(object);
    this.runtimeObjects.clear();
  }

  setMode(mode: TransformMode): void {
    this.transformControls.setMode(mode);
    this.events.onModeChanged(mode);
    const label = mode === 'translate' ? 'Mover' : mode === 'rotate' ? 'Rotacionar' : 'Escalar';
    this.events.onStatus(`Ferramenta ativa: ${label}.`);
  }

  select(entityId: string | null): void {
    if (entityId === this.selectedId) return;
    this.clearSelectionVisuals();
    this.selectedId = entityId;
    if (!entityId) {
      this.events.onSelectionChanged(null);
      return;
    }

    const object = this.runtimeObjects.get(entityId);
    const entity = this.getEntity(entityId);
    if (!object || !entity) {
      this.selectedId = null;
      this.events.onSelectionChanged(null);
      return;
    }

    this.transformControls.attach(object);
    this.selectionBox = new THREE.BoxHelper(object, 0x78baff);
    this.selectionBox.userData.editorHelper = true;
    this.engine.scene.add(this.selectionBox);
    this.events.onSelectionChanged(entity);
  }

  clearSelection(): void {
    this.select(null);
  }

  selectFromPointer(event: PointerEvent): boolean {
    if (event.button !== 0 || this.isTransformInteracting) return false;
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.engine.camera.camera);
    const hits = this.raycaster.intersectObjects([...this.runtimeObjects.values()], true);
    for (const hit of hits) {
      let current: THREE.Object3D | null = hit.object;
      while (current) {
        const id = current.userData.worldEntityId as string | undefined;
        if (id) {
          this.select(id);
          return true;
        }
        current = current.parent;
      }
    }
    this.clearSelection();
    return false;
  }

  async placeAsset(asset: AssetRecord, position: SerializedVector3): Promise<void> {
    const entity = createWorldEntity({ assetId: asset.id, assetName: asset.name, position });
    this.documentState.entities.push(entity);
    await this.addRuntimeEntity(entity, asset);
    this.touchDocument();
    this.recordHistory();
    this.select(entity.id);
    this.events.onStatus(`${entity.name} colocado no mapa.`, 'success');
  }

  async duplicateSelected(): Promise<void> {
    const source = this.getSelectedEntity();
    if (!source) return;
    const copy = createWorldEntity({
      assetId: source.assetId,
      assetName: source.assetName,
      name: `${source.name} Copy`,
      position: { x: source.position.x + 0.5, y: source.position.y, z: source.position.z + 0.5 },
    });
    copy.rotation = { ...source.rotation };
    copy.scale = { ...source.scale };
    copy.visible = source.visible;
    this.documentState.entities.push(copy);
    await this.addRuntimeEntity(copy);
    this.touchDocument();
    this.recordHistory();
    this.select(copy.id);
    this.events.onStatus(`${source.name} duplicado.`, 'success');
  }

  deleteSelected(): void {
    const entity = this.getSelectedEntity();
    if (!entity) return;
    const object = this.runtimeObjects.get(entity.id);
    this.clearSelection();
    if (object) this.engine.scene.remove(object);
    this.runtimeObjects.delete(entity.id);
    this.documentState.entities = this.documentState.entities.filter((candidate) => candidate.id !== entity.id);
    this.touchDocument();
    this.recordHistory();
    this.events.onStatus(`${entity.name} removido do mapa.`);
  }

  focusSelected(): void {
    const object = this.selectedId ? this.runtimeObjects.get(this.selectedId) : undefined;
    if (!object) return;
    const bounds = new THREE.Box3().setFromObject(object);
    const center = bounds.isEmpty() ? object.position.clone() : bounds.getCenter(new THREE.Vector3());
    this.engine.camera.setTarget(center);
  }

  renameSelected(name: string): void {
    const entity = this.getSelectedEntity();
    if (!entity) return;
    const normalized = name.trim();
    if (!normalized || normalized === entity.name) return;
    entity.name = normalized;
    const object = this.runtimeObjects.get(entity.id);
    if (object) object.name = normalized;
    this.touchDocument();
    this.recordHistory();
  }

  setSelectedVisible(visible: boolean): void {
    const entity = this.getSelectedEntity();
    if (!entity || entity.visible === visible) return;
    entity.visible = visible;
    const object = this.runtimeObjects.get(entity.id);
    if (object) object.visible = visible;
    this.touchDocument();
    this.recordHistory();
  }

  updateSelectedTransform(transform: {
    position: SerializedVector3;
    rotationDegrees: SerializedVector3;
    scale: SerializedVector3;
  }): void {
    const entity = this.getSelectedEntity();
    const object = entity ? this.runtimeObjects.get(entity.id) : undefined;
    if (!entity || !object) return;
    entity.position = { ...transform.position };
    entity.rotation = {
      x: THREE.MathUtils.degToRad(transform.rotationDegrees.x),
      y: THREE.MathUtils.degToRad(transform.rotationDegrees.y),
      z: THREE.MathUtils.degToRad(transform.rotationDegrees.z),
    };
    entity.scale = {
      x: Math.max(0.001, transform.scale.x),
      y: Math.max(0.001, transform.scale.y),
      z: Math.max(0.001, transform.scale.z),
    };
    copyTransform(entity, object);
    this.selectionBox?.update();
    this.touchDocument();
    this.recordHistory();
  }

  getSelectedEntity(): WorldEntityDocument | null {
    return this.selectedId ? this.getEntity(this.selectedId) ?? null : null;
  }

  canUndo(): boolean {
    return this.historyIndex > 0;
  }

  canRedo(): boolean {
    return this.historyIndex >= 0 && this.historyIndex < this.history.length - 1;
  }

  async undo(): Promise<void> {
    if (!this.canUndo()) return;
    this.historyIndex -= 1;
    await this.restoreHistory();
    this.events.onStatus('Desfazer aplicado.');
  }

  async redo(): Promise<void> {
    if (!this.canRedo()) return;
    this.historyIndex += 1;
    await this.restoreHistory();
    this.events.onStatus('Refazer aplicado.');
  }

  serialize(): string {
    return JSON.stringify(this.documentState, null, 2);
  }

  async replaceFromJson(json: string): Promise<void> {
    const parsed = parseWorldDocument(JSON.parse(json));
    this.documentState = parsed;
    await this.rebuildScene();
    this.touchDocument(false);
    this.resetHistory();
    this.emitDocumentChanged();
    this.events.onStatus(`Mapa “${parsed.name}” carregado com ${parsed.entities.length} entidade(s).`, 'success');
  }

  private getEntity(id: string): WorldEntityDocument | undefined {
    return this.documentState.entities.find((entity) => entity.id === id);
  }

  private async addRuntimeEntity(entity: WorldEntityDocument, knownAsset?: AssetRecord): Promise<void> {
    const previous = this.runtimeObjects.get(entity.id);
    if (previous) this.engine.scene.remove(previous);

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
        this.events.onStatus(`Falha ao carregar ${entity.assetName}: ${error instanceof Error ? error.message : String(error)}`, 'error');
      }
    } else {
      root.add(missingAssetPlaceholder(entity));
    }
    copyTransform(entity, root);
    this.runtimeObjects.set(entity.id, root);
    this.engine.scene.add(root);
  }

  private async rebuildScene(): Promise<void> {
    const token = ++this.rebuildToken;
    this.clearSelection();
    for (const object of this.runtimeObjects.values()) this.engine.scene.remove(object);
    this.runtimeObjects.clear();
    for (const entity of this.documentState.entities) {
      if (token !== this.rebuildToken) return;
      await this.addRuntimeEntity(entity);
    }
  }

  private clearSelectionVisuals(): void {
    this.transformControls.detach();
    if (this.selectionBox) this.engine.scene.remove(this.selectionBox);
    this.selectionBox = null;
  }

  private touchDocument(emit = true): void {
    this.documentState.updatedAt = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.documentState));
    if (emit) this.emitDocumentChanged();
  }

  private emitDocumentChanged(): void {
    this.events.onDocumentChanged(this.documentState);
    this.events.onSelectionChanged(this.getSelectedEntity());
  }

  private resetHistory(): void {
    this.history = [cloneWorldDocument(this.documentState)];
    this.historyIndex = 0;
  }

  private recordHistory(): void {
    const snapshot = cloneWorldDocument(this.documentState);
    this.history.splice(this.historyIndex + 1);
    this.history.push(snapshot);
    if (this.history.length > HISTORY_LIMIT) this.history.shift();
    this.historyIndex = this.history.length - 1;
    this.emitDocumentChanged();
  }

  private async restoreHistory(): Promise<void> {
    const snapshot = this.history[this.historyIndex];
    if (!snapshot) return;
    this.documentState = cloneWorldDocument(snapshot);
    await this.rebuildScene();
    this.touchDocument();
  }

  private handleDraggingChanged = (event: unknown): void => {
    this.transformDragging = Boolean((event as { value?: boolean }).value);
  };

  private handleObjectChange = (): void => {
    const entity = this.getSelectedEntity();
    const object = entity ? this.runtimeObjects.get(entity.id) : undefined;
    if (!entity || !object) return;
    syncTransform(entity, object);
    this.selectionBox?.update();
    this.touchDocument();
  };

  private handleTransformEnd = (): void => {
    if (!this.getSelectedEntity()) return;
    this.touchDocument();
    this.recordHistory();
  };
}
