import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import type { AssetRecord } from '../assets/types';
import type { Engine } from '../engine/Engine';
import { storePlaytestWorld } from '../world/PlaytestSession';
import { WorldDatabase, type WorldSummary } from '../world/WorldDatabase';
import { WorldEnvironment } from '../world/WorldEnvironment';
import { WorldRuntime, applyEntityTransform, syncEntityTransform } from '../world/WorldRuntime';
import {
  cloneWorldDocument,
  createWorldDocument,
  createWorldEntity,
  duplicateWorldDocument,
  parseWorldDocument,
  type SerializedVector3,
  type WorldDocument,
  type WorldEntityDocument,
} from '../world/WorldDocument';

const LEGACY_STORAGE_KEY = 'ascension-isometric-world-document-v1';
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

  constructor(
    private readonly engine: Engine,
    private readonly canvas: HTMLCanvasElement,
    private readonly events: WorldEditorEvents,
  ) {
    this.runtime = new WorldRuntime(engine.scene, { onAssetError: (message) => events.onStatus(message, 'error') });
    this.environment = new WorldEnvironment(engine.scene, this.documentState, true);
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
  get isTransformInteracting(): boolean { return this.transformDragging || this.transformControls.axis !== null; }

  async initialize(): Promise<void> {
    let summaries = await this.worlds.list();
    if (summaries.length === 0) {
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy) {
        try {
          const migrated = parseWorldDocument(JSON.parse(legacy));
          await this.worlds.put(migrated);
          await this.worlds.setCurrentId(migrated.id);
          localStorage.removeItem(LEGACY_STORAGE_KEY);
          summaries = await this.worlds.list();
          this.events.onStatus('Mapa da Etapa 3 migrado para a biblioteca de mapas.', 'success');
        } catch (error) {
          this.events.onStatus(`Mapa legado ignorado: ${error instanceof Error ? error.message : String(error)}`, 'error');
        }
      }
    }

    const currentId = await this.worlds.getCurrentId();
    let document = currentId ? await this.worlds.get(currentId) : undefined;
    if (!document && summaries[0]) document = await this.worlds.get(summaries[0].id);
    if (!document) {
      document = createWorldDocument('Mapa Principal');
      await this.worlds.put(document);
    }
    await this.activateDocument(document);
  }

  dispose(): void {
    if (this.saveTimer) window.clearTimeout(this.saveTimer);
    this.clearSelection();
    this.transformEvents.removeEventListener('dragging-changed', this.handleDraggingChanged);
    this.transformEvents.removeEventListener('objectChange', this.handleObjectChange);
    this.transformEvents.removeEventListener('mouseUp', this.handleTransformEnd);
    this.engine.scene.remove(this.transformControls.getHelper());
    this.transformControls.dispose();
    this.runtime.dispose();
    this.environment.dispose();
  }

  async listWorlds(): Promise<WorldSummary[]> { return this.worlds.list(); }

  async createNewWorld(name = 'Novo mapa'): Promise<void> {
    await this.saveCurrent();
    const document = createWorldDocument(name);
    await this.worlds.put(document);
    await this.activateDocument(document);
    this.events.onStatus(`Mapa “${document.name}” criado.`, 'success');
  }

  async openWorld(id: string): Promise<void> {
    if (id === this.documentState.id) return;
    await this.saveCurrent();
    const document = await this.worlds.get(id);
    if (!document) throw new Error('Mapa não encontrado.');
    await this.activateDocument(document);
    this.events.onStatus(`Mapa “${document.name}” aberto.`, 'success');
  }

  async duplicateCurrentWorld(): Promise<void> {
    await this.saveCurrent();
    const copy = duplicateWorldDocument(this.documentState);
    await this.worlds.put(copy);
    await this.activateDocument(copy);
    this.events.onStatus(`Mapa duplicado como “${copy.name}”.`, 'success');
  }

  async deleteWorld(id: string): Promise<void> {
    const summaries = await this.worlds.list();
    await this.worlds.delete(id);
    if (id !== this.documentState.id) return;
    const next = summaries.find((entry) => entry.id !== id);
    if (next) {
      const document = await this.worlds.get(next.id);
      if (document) await this.activateDocument(document);
    } else {
      const document = createWorldDocument('Mapa Principal');
      await this.worlds.put(document);
      await this.activateDocument(document);
    }
  }

  async updateMapSettings(input: {
    name: string;
    description: string;
    spawn: SerializedVector3;
    groundSize: number;
    groundColor: string;
    backgroundColor: string;
  }): Promise<void> {
    const normalizedName = input.name.trim();
    if (normalizedName) this.documentState.name = normalizedName;
    this.documentState.description = input.description.trim();
    this.documentState.spawn = { ...input.spawn };
    this.documentState.environment = {
      groundSize: Math.max(10, Math.min(1000, input.groundSize)),
      groundColor: /^#[0-9a-f]{6}$/i.test(input.groundColor) ? input.groundColor : this.documentState.environment.groundColor,
      backgroundColor: /^#[0-9a-f]{6}$/i.test(input.backgroundColor) ? input.backgroundColor : this.documentState.environment.backgroundColor,
    };
    this.environment.update(this.documentState);
    this.touchDocument();
    this.recordHistory();
    await this.saveCurrent();
  }

  async saveCurrent(): Promise<void> {
    if (this.saveTimer) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = 0;
    }
    await this.worlds.put(this.documentState);
    await this.worlds.setCurrentId(this.documentState.id);
  }

  async preparePlaytest(): Promise<void> {
    await this.saveCurrent();
    storePlaytestWorld(this.documentState);
  }

  async importWorldJson(json: string): Promise<void> {
    let parsed = parseWorldDocument(JSON.parse(json));
    if (await this.worlds.get(parsed.id)) parsed = duplicateWorldDocument(parsed, `${parsed.name} Importado`);
    await this.worlds.put(parsed);
    await this.activateDocument(parsed);
    this.events.onStatus(`Mapa “${parsed.name}” importado.`, 'success');
  }

  serialize(): string { return JSON.stringify(this.documentState, null, 2); }

  setMode(mode: TransformMode): void {
    this.transformControls.setMode(mode);
    this.events.onModeChanged(mode);
    this.events.onStatus(`Ferramenta ativa: ${mode === 'translate' ? 'Mover' : mode === 'rotate' ? 'Rotacionar' : 'Escalar'}.`);
  }

  select(entityId: string | null): void {
    if (entityId === this.selectedId) return;
    this.clearSelectionVisuals();
    this.selectedId = entityId;
    if (!entityId) { this.events.onSelectionChanged(null); return; }
    const object = this.runtime.getObject(entityId);
    const entity = this.getEntity(entityId);
    if (!object || !entity) { this.selectedId = null; this.events.onSelectionChanged(null); return; }
    this.transformControls.attach(object);
    this.selectionBox = new THREE.BoxHelper(object, 0x78baff);
    this.selectionBox.userData.editorHelper = true;
    this.engine.scene.add(this.selectionBox);
    this.events.onSelectionChanged(entity);
  }

  clearSelection(): void { this.select(null); }

  selectFromPointer(event: PointerEvent): boolean {
    if (event.button !== 0 || this.isTransformInteracting) return false;
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.engine.camera.camera);
    for (const hit of this.raycaster.intersectObjects(this.runtime.getObjects(), true)) {
      let current: THREE.Object3D | null = hit.object;
      while (current) {
        const id = current.userData.worldEntityId as string | undefined;
        if (id) { this.select(id); return true; }
        current = current.parent;
      }
    }
    this.clearSelection();
    return false;
  }

  async placeAsset(asset: AssetRecord, position: SerializedVector3): Promise<void> {
    const entity = createWorldEntity({ assetId: asset.id, assetName: asset.name, position });
    this.documentState.entities.push(entity);
    await this.runtime.add(entity, asset);
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
    await this.runtime.add(copy);
    this.touchDocument();
    this.recordHistory();
    this.select(copy.id);
  }

  deleteSelected(): void {
    const entity = this.getSelectedEntity();
    if (!entity) return;
    this.clearSelection();
    this.runtime.remove(entity.id);
    this.documentState.entities = this.documentState.entities.filter((candidate) => candidate.id !== entity.id);
    this.touchDocument();
    this.recordHistory();
  }

  focusSelected(): void {
    const object = this.selectedId ? this.runtime.getObject(this.selectedId) : undefined;
    if (!object) return;
    const bounds = new THREE.Box3().setFromObject(object);
    this.engine.camera.setTarget(bounds.isEmpty() ? object.position.clone() : bounds.getCenter(new THREE.Vector3()));
  }

  renameSelected(name: string): void {
    const entity = this.getSelectedEntity();
    const normalized = name.trim();
    if (!entity || !normalized || normalized === entity.name) return;
    entity.name = normalized;
    const object = this.runtime.getObject(entity.id);
    if (object) object.name = normalized;
    this.touchDocument();
    this.recordHistory();
  }

  setSelectedVisible(visible: boolean): void {
    const entity = this.getSelectedEntity();
    if (!entity || entity.visible === visible) return;
    entity.visible = visible;
    const object = this.runtime.getObject(entity.id);
    if (object) object.visible = visible;
    this.touchDocument();
    this.recordHistory();
  }

  updateSelectedTransform(transform: { position: SerializedVector3; rotationDegrees: SerializedVector3; scale: SerializedVector3 }): void {
    const entity = this.getSelectedEntity();
    const object = entity ? this.runtime.getObject(entity.id) : undefined;
    if (!entity || !object) return;
    entity.position = { ...transform.position };
    entity.rotation = {
      x: THREE.MathUtils.degToRad(transform.rotationDegrees.x),
      y: THREE.MathUtils.degToRad(transform.rotationDegrees.y),
      z: THREE.MathUtils.degToRad(transform.rotationDegrees.z),
    };
    entity.scale = {
      x: Math.max(0.001, transform.scale.x), y: Math.max(0.001, transform.scale.y), z: Math.max(0.001, transform.scale.z),
    };
    applyEntityTransform(entity, object);
    this.selectionBox?.update();
    this.touchDocument();
    this.recordHistory();
  }

  getSelectedEntity(): WorldEntityDocument | null { return this.selectedId ? this.getEntity(this.selectedId) ?? null : null; }
  canUndo(): boolean { return this.historyIndex > 0; }
  canRedo(): boolean { return this.historyIndex >= 0 && this.historyIndex < this.history.length - 1; }

  async undo(): Promise<void> {
    if (!this.canUndo()) return;
    this.historyIndex -= 1;
    await this.restoreHistory();
  }

  async redo(): Promise<void> {
    if (!this.canRedo()) return;
    this.historyIndex += 1;
    await this.restoreHistory();
  }

  private async activateDocument(document: WorldDocument): Promise<void> {
    this.clearSelection();
    this.documentState = cloneWorldDocument(document);
    this.environment.update(this.documentState);
    await this.runtime.build(this.documentState);
    await this.worlds.setCurrentId(this.documentState.id);
    this.resetHistory();
    this.emitDocumentChanged();
  }

  private getEntity(id: string): WorldEntityDocument | undefined { return this.documentState.entities.find((entity) => entity.id === id); }

  private clearSelectionVisuals(): void {
    this.transformControls.detach();
    if (this.selectionBox) this.engine.scene.remove(this.selectionBox);
    this.selectionBox = null;
  }

  private touchDocument(emit = true): void {
    this.documentState.updatedAt = Date.now();
    this.schedulePersist();
    if (emit) this.emitDocumentChanged();
  }

  private schedulePersist(): void {
    if (this.saveTimer) window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = 0;
      void this.saveCurrent().catch((error: unknown) => this.events.onStatus(`Autosave falhou: ${error instanceof Error ? error.message : String(error)}`, 'error'));
    }, 180);
  }

  private emitDocumentChanged(): void {
    this.events.onDocumentChanged(this.documentState);
    this.events.onSelectionChanged(this.getSelectedEntity());
  }

  private resetHistory(): void { this.history = [cloneWorldDocument(this.documentState)]; this.historyIndex = 0; }

  private recordHistory(): void {
    this.history.splice(this.historyIndex + 1);
    this.history.push(cloneWorldDocument(this.documentState));
    if (this.history.length > HISTORY_LIMIT) this.history.shift();
    this.historyIndex = this.history.length - 1;
    this.emitDocumentChanged();
  }

  private async restoreHistory(): Promise<void> {
    const snapshot = this.history[this.historyIndex];
    if (!snapshot) return;
    this.documentState = cloneWorldDocument(snapshot);
    this.environment.update(this.documentState);
    await this.runtime.build(this.documentState);
    this.touchDocument();
  }

  private handleDraggingChanged = (event: unknown): void => { this.transformDragging = Boolean((event as { value?: boolean }).value); };

  private handleObjectChange = (): void => {
    const entity = this.getSelectedEntity();
    const object = entity ? this.runtime.getObject(entity.id) : undefined;
    if (!entity || !object) return;
    syncEntityTransform(entity, object);
    this.selectionBox?.update();
    this.touchDocument();
  };

  private handleTransformEnd = (): void => {
    if (!this.getSelectedEntity()) return;
    this.touchDocument();
    this.recordHistory();
  };
}
