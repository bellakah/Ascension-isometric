import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { AssetDatabase } from '../assets/AssetDatabase';
import type { AssetRecord } from '../assets/types';
import type { Engine } from '../engine/Engine';
import { storePlaytestWorld } from '../world/PlaytestSession';
import { WorldDatabase, type WorldSummary } from '../world/WorldDatabase';
import { WorldEnvironment, type EditorWorldLayer } from '../world/WorldEnvironment';
import { WorldRuntime, applyEntityTransform, syncEntityTransform, syncEntityWorldTransform } from '../world/WorldRuntime';
import {
  averageTerrainHeight,
  dominantTerrainLayerId,
  latestHeightStampIndex,
  latestPaintStampIndex,
  stampRegion,
  unionTerrainRegion,
  type TerrainRegion,
} from '../world/TerrainMath';
import {
  MAX_TERRAIN_HEIGHT_STAMPS,
  MAX_TERRAIN_LAYERS,
  MAX_TERRAIN_PAINT_STAMPS,
  MAX_WORLD_BLOCKERS,
  MAX_WORLD_ENTITIES,
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
  type TerrainHeightStamp,
  type TerrainLayerDocument,
  type TerrainPaintStamp,
  type WorldBlockerDocument,
  type WorldDocument,
  type WorldEntityDocument,
} from '../world/WorldDocument';
import { clampToCapacity } from './EditCapacity';
import { pointInRegion, regionBounds, regionCenter, regionSize, scatterCandidates, type RegionBounds, type ScatterCandidate, type ScatterSettings } from './RegionTools';

const LEGACY_STORAGE_KEY = 'ascension-isometric-world-document-v1';
const HISTORY_LIMIT = 80;

export type TransformMode = 'translate' | 'rotate' | 'scale';
export type WorldAuthoringTool = 'select' | 'raise' | 'lower' | 'smooth' | 'flatten' | 'paint' | 'erase' | 'water' | 'spawn' | 'blocker' | 'region';

export interface TerrainBrushSettings {
  radius: number;
  strength: number;
  falloff: TerrainFalloff;
  paintLayerId: string;
}

export interface RegionCopyOptions {
  objects: boolean;
  terrainSculpt: boolean;
  terrainPaint: boolean;
  blockers: boolean;
}

export interface RegionStats {
  objects: number;
  heightEdits: number;
  paintEdits: number;
  blockers: number;
}

export interface ScatterRules {
  avoidWater: boolean;
  avoidObjects: boolean;
  maxSlope: number;
  terrainLayerId?: string;
}

interface RelativeEntity {
  entity: WorldEntityDocument;
  dx: number;
  dz: number;
}
interface RelativeHeightStamp { stamp: TerrainHeightStamp; dx: number; dz: number; }
interface RelativePaintStamp { stamp: TerrainPaintStamp; dx: number; dz: number; }
interface RelativeBlocker { blocker: WorldBlockerDocument; dx1: number; dz1: number; dx2: number; dz2: number; }
interface RegionClipboard {
  width: number;
  depth: number;
  entities: RelativeEntity[];
  heights: RelativeHeightStamp[];
  paints: RelativePaintStamp[];
  blockers: RelativeBlocker[];
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

function cloneEntity(entity: WorldEntityDocument): WorldEntityDocument {
  return { ...entity, position: { ...entity.position }, rotation: { ...entity.rotation }, scale: { ...entity.scale }, collision: { ...entity.collision } };
}

export class WorldEditor {
  private readonly worlds = new WorldDatabase();
  private readonly assets = new AssetDatabase();
  private readonly runtime: WorldRuntime;
  private readonly environment: WorldEnvironment;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly transformControls: TransformControls;
  private readonly transformEvents: LooseEventTarget;
  private readonly selectedIds = new Set<string>();
  private readonly selectionBoxes = new Map<string, THREE.BoxHelper>();
  private selectionPivot: THREE.Group | null = null;
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
  private regionState: RegionBounds | null = null;
  private regionStart: THREE.Vector3 | null = null;
  private regionClipboard: RegionClipboard | null = null;
  private pasteArmed = false;
  private scatterPreview: ScatterCandidate[] = [];

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
  get selectedEntityIds(): string[] { return [...this.selectedIds]; }
  get selectionCount(): number { return this.selectedIds.size; }
  get activeTool(): WorldAuthoringTool { return this.toolState; }
  get brushSettings(): TerrainBrushSettings { return { ...this.brush }; }
  get terrainMaskPreviewLayerId(): string | null { return this.maskPreviewLayerId; }
  get regionBounds(): RegionBounds | null { return this.regionState ? { ...this.regionState } : null; }
  get hasRegionClipboard(): boolean { return this.regionClipboard !== null; }
  get isPasteArmed(): boolean { return this.pasteArmed; }
  get scatterPreviewCount(): number { return this.scatterPreview.length; }
  get isTransformInteracting(): boolean { return this.transformDragging || this.transformControls.axis !== null; }
  get isAuthoringInteracting(): boolean { return this.strokeActive || this.blockerStart !== null || this.regionStart !== null; }

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
    this.clearSelection(); this.environment.setBrushPreview(null, this.brush.radius); this.environment.setBlockerPreview(null, null); this.environment.setRegionPreview(null); this.environment.setScatterPreview(null);
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

  getRegionStats(): RegionStats {
    const bounds = this.regionState; if (!bounds) return { objects: 0, heightEdits: 0, paintEdits: 0, blockers: 0 };
    return {
      objects: this.documentState.entities.filter((entity) => pointInRegion(bounds, entity.position.x, entity.position.z)).length,
      heightEdits: this.documentState.terrain.heightStamps.filter((stamp) => pointInRegion(bounds, stamp.x, stamp.z)).length,
      paintEdits: this.documentState.terrain.paintStamps.filter((stamp) => pointInRegion(bounds, stamp.x, stamp.z)).length,
      blockers: this.documentState.blockers.filter((blocker) => pointInRegion(bounds, (blocker.x1 + blocker.x2) * 0.5, (blocker.z1 + blocker.z2) * 0.5)).length,
    };
  }

  clearRegion(): void { this.regionState = null; this.regionStart = null; this.pasteArmed = false; this.environment.setRegionPreview(null); this.clearScatterPreview(); this.events.onDocumentChanged(this.documentState); }

  copyRegion(options: RegionCopyOptions): boolean {
    const bounds = this.regionState; if (!bounds) { this.events.onStatus('Selecione uma região primeiro.', 'error'); return false; }
    const center = regionCenter(bounds); const size = regionSize(bounds);
    const entities = options.objects ? this.documentState.entities.filter((entity) => pointInRegion(bounds, entity.position.x, entity.position.z)).map((entity) => ({ entity: cloneEntity(entity), dx: entity.position.x - center.x, dz: entity.position.z - center.z })) : [];
    const heights = options.terrainSculpt ? this.documentState.terrain.heightStamps.filter((stamp) => pointInRegion(bounds, stamp.x, stamp.z)).map((stamp) => ({ stamp: { ...stamp }, dx: stamp.x - center.x, dz: stamp.z - center.z })) : [];
    const paints = options.terrainPaint ? this.documentState.terrain.paintStamps.filter((stamp) => pointInRegion(bounds, stamp.x, stamp.z)).map((stamp) => ({ stamp: { ...stamp }, dx: stamp.x - center.x, dz: stamp.z - center.z })) : [];
    const blockers = options.blockers ? this.documentState.blockers.filter((blocker) => pointInRegion(bounds, (blocker.x1 + blocker.x2) * 0.5, (blocker.z1 + blocker.z2) * 0.5)).map((blocker) => ({ blocker: { ...blocker }, dx1: blocker.x1 - center.x, dz1: blocker.z1 - center.z, dx2: blocker.x2 - center.x, dz2: blocker.z2 - center.z })) : [];
    this.regionClipboard = { width: size.width, depth: size.depth, entities, heights, paints, blockers };
    const total = entities.length + heights.length + paints.length + blockers.length; this.events.onStatus(`${total} elemento(s) copiado(s) da região.`, 'success'); return true;
  }

  async cutRegion(options: RegionCopyOptions): Promise<void> { if (!this.copyRegion(options)) return; await this.deleteRegion(options); }

  armRegionPaste(): void {
    if (!this.regionClipboard) { this.events.onStatus('O clipboard de região está vazio.', 'error'); return; }
    this.pasteArmed = true; this.setAuthoringTool('region'); this.events.onStatus('Paste armado: clique no terreno para posicionar o centro da cópia.', 'success');
  }

  async duplicateRegion(options: RegionCopyOptions): Promise<void> {
    const bounds = this.regionState; if (!bounds || !this.copyRegion(options) || !this.regionClipboard) return;
    const center = regionCenter(bounds); const offset = Math.max(3, this.regionClipboard.width + 3); await this.pasteRegionAt(center.x + offset, center.z);
  }

  async deleteRegion(options: RegionCopyOptions): Promise<void> {
    const bounds = this.regionState; if (!bounds) return;
    this.releaseSelectionPivot(true); this.clearSelectionVisuals(false); this.selectedIds.clear(); this.selectedId = null;
    if (options.objects) this.documentState.entities = this.documentState.entities.filter((entity) => !pointInRegion(bounds, entity.position.x, entity.position.z));
    if (options.terrainSculpt) this.documentState.terrain.heightStamps = this.documentState.terrain.heightStamps.filter((stamp) => !pointInRegion(bounds, stamp.x, stamp.z));
    if (options.terrainPaint) this.documentState.terrain.paintStamps = this.documentState.terrain.paintStamps.filter((stamp) => !pointInRegion(bounds, stamp.x, stamp.z));
    if (options.blockers) this.documentState.blockers = this.documentState.blockers.filter((blocker) => !pointInRegion(bounds, (blocker.x1 + blocker.x2) * 0.5, (blocker.z1 + blocker.z2) * 0.5));
    await this.rebuildAfterBatch(); this.recordHistory(); this.events.onStatus('Conteúdo da região removido.', 'success');
  }

  previewScatter(settings: ScatterSettings, rules: ScatterRules): number {
    const bounds = this.regionState; if (!bounds) { this.events.onStatus('Selecione uma região antes de usar Scatter.', 'error'); return 0; }
    const spacing = Math.max(0, settings.minSpacing);
    const reject = (candidate: ScatterCandidate): boolean => {
      const y = this.terrainHeightAt(candidate.x, candidate.z);
      if (rules.avoidWater && this.documentState.water.enabled && y <= this.documentState.water.level + 0.05) return true;
      if (rules.terrainLayerId && dominantTerrainLayerId(this.documentState, candidate.x, candidate.z) !== rules.terrainLayerId) return true;
      if (Number.isFinite(rules.maxSlope) && this.slopeAt(candidate.x, candidate.z) > Math.max(0, rules.maxSlope)) return true;
      if (rules.avoidObjects && spacing > 0 && this.documentState.entities.some((entity) => Math.hypot(entity.position.x - candidate.x, entity.position.z - candidate.z) < spacing)) return true;
      return false;
    };
    this.scatterPreview = scatterCandidates(settings, bounds, reject); this.environment.setScatterPreview(this.scatterPreview); this.events.onDocumentChanged(this.documentState);
    this.events.onStatus(`Scatter preview: ${this.scatterPreview.length}/${Math.max(0, settings.count)} placements.`, this.scatterPreview.length ? 'success' : 'error'); return this.scatterPreview.length;
  }

  clearScatterPreview(): void { this.scatterPreview = []; this.environment.setScatterPreview(null); }

  async applyScatterPreview(): Promise<void> {
    if (!this.scatterPreview.length) { this.events.onStatus('Não há Scatter Preview para aplicar.', 'error'); return; }
    this.releaseSelectionPivot(true); this.clearSelectionVisuals(false); this.selectedIds.clear(); this.selectedId = null;
    const ids = [...new Set(this.scatterPreview.map((candidate) => candidate.assetId))];
    const records = new Map<string, AssetRecord>();
    for (const id of ids) { const record = await this.assets.get(id); if (record) records.set(id, record); }
    const pending: WorldEntityDocument[] = [];
    for (const candidate of this.scatterPreview) {
      const asset = records.get(candidate.assetId); if (!asset) continue;
      const entity = createWorldEntity({ assetId: asset.id, assetName: asset.name, position: { x: candidate.x, y: this.terrainHeightAt(candidate.x, candidate.z), z: candidate.z } });
      entity.rotation.y = candidate.rotationY; entity.scale = { x: candidate.scale, y: candidate.scale, z: candidate.scale }; entity.grounded = true; entity.groundOffset = 0;
      pending.push(entity);
    }
    const batch = clampToCapacity(pending, this.documentState.entities.length, MAX_WORLD_ENTITIES);
    const created = batch.accepted.map((entity) => entity.id);
    this.documentState.entities.push(...batch.accepted);
    this.clearScatterPreview(); await this.rebuildAfterBatch(); this.selectMany(created); this.recordHistory(); this.events.onStatus(`${created.length} objeto(s) do Scatter aplicados.`, 'success');
    if (batch.truncated) this.events.onStatus(`Scatter limitado a ${MAX_WORLD_ENTITIES} objetos por mapa.`, 'error');
  }

  surfaceAt(clientX: number, clientY: number): THREE.Vector3 | null { return this.environment.surfaceAt(this.engine.camera.camera, this.canvas, clientX, clientY); }
  terrainHeightAt(x: number, z: number): number { return this.environment.terrainHeight(x, z); }

  handleAuthoringPointerDown(event: PointerEvent): boolean {
    if (event.button !== 0 || this.toolState === 'select' || this.toolState === 'water') return false;
    const point = this.surfaceAt(event.clientX, event.clientY); if (!point) return false;
    if (this.toolState === 'region') {
      if (this.pasteArmed) { this.pasteArmed = false; void this.pasteRegionAt(point.x, point.z); return true; }
      this.regionStart = point.clone(); this.regionState = regionBounds(point, point); this.environment.setRegionPreview(this.regionState); this.clearScatterPreview(); return true;
    }
    if (this.toolState === 'spawn') {
      this.documentState.spawn = { x: point.x, y: point.y, z: point.z }; this.environment.update(this.documentState); this.touchDocument(); this.recordHistory(); this.events.onStatus('Spawn definido no terreno.', 'success'); return true;
    }
    if (this.toolState === 'blocker') { this.blockerStart = point.clone(); this.environment.setBlockerPreview(this.blockerStart, point); return true; }
    if (isTerrainTool(this.toolState)) {
      if (this.toolState === 'paint') {
        const layer = this.layerById(this.brush.paintLayerId); if (!layer) return false;
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
    if (this.toolState === 'region' && this.regionStart && point) { this.regionState = regionBounds(this.regionStart, point); this.environment.setRegionPreview(this.regionState); return true; }
    if (isTerrainTool(this.toolState)) this.environment.setBrushPreview(point, this.brush.radius, brushColor(this.toolState, this.toolState === 'paint' && (this.strokePaintErase || event.shiftKey)));
    if (this.blockerStart && point) { this.environment.setBlockerPreview(this.blockerStart, point); return true; }
    if (this.strokeActive && point) { this.applyBrush(point); return true; }
    return false;
  }

  handleAuthoringPointerUp(event: PointerEvent): boolean {
    if (event.button !== 0) return false;
    if (this.regionStart) {
      const end = this.surfaceAt(event.clientX, event.clientY); const start = this.regionStart; this.regionStart = null;
      if (end) { this.regionState = regionBounds(start, end); this.environment.setRegionPreview(this.regionState); const ids = this.documentState.entities.filter((entity) => pointInRegion(this.regionState!, entity.position.x, entity.position.z)).map((entity) => entity.id); this.selectMany(ids); const size = regionSize(this.regionState); this.events.onStatus(`Região ${size.width.toFixed(1)} × ${size.depth.toFixed(1)} m · ${ids.length} objeto(s).`, 'success'); this.events.onDocumentChanged(this.documentState); }
      return true;
    }
    if (this.blockerStart) {
      const end = this.surfaceAt(event.clientX, event.clientY); const start = this.blockerStart; this.blockerStart = null; this.environment.setBlockerPreview(null, null);
      if (end && Math.hypot(end.x - start.x, end.z - start.z) >= 0.5) {
        const batch = clampToCapacity([createBlocker({ x1: start.x, z1: start.z, x2: end.x, z2: end.z })], this.documentState.blockers.length, MAX_WORLD_BLOCKERS);
        if (batch.accepted[0]) { this.documentState.blockers.push(batch.accepted[0]); this.environment.update(this.documentState); this.touchDocument(); this.recordHistory(); this.events.onStatus('Blocker adicionado.', 'success'); }
        else this.events.onStatus(`Limite de ${MAX_WORLD_BLOCKERS} blockers atingido.`, 'error');
      }
      return true;
    }
    if (this.strokeActive) { this.strokeActive = false; this.strokePaintErase = false; this.lastStrokePoint = null; this.schedulePersist(); this.recordHistory(); return true; }
    return false;
  }

  select(entityId: string | null, additive = false): void {
    if (!entityId) { if (!additive) this.clearSelection(); return; }
    if (additive) {
      if (this.selectedIds.has(entityId)) this.selectedIds.delete(entityId); else this.selectedIds.add(entityId);
      this.selectedId = this.selectedIds.has(entityId) ? entityId : [...this.selectedIds].at(-1) ?? null;
    } else { this.selectedIds.clear(); this.selectedIds.add(entityId); this.selectedId = entityId; }
    this.refreshSelectionVisuals(); this.events.onSelectionChanged(this.getSelectedEntity());
  }

  selectMany(ids: readonly string[], additive = false): void {
    if (!additive) this.selectedIds.clear();
    for (const id of ids) if (this.getEntity(id)) this.selectedIds.add(id);
    this.selectedId = [...this.selectedIds].at(-1) ?? null; this.refreshSelectionVisuals(); this.events.onSelectionChanged(this.getSelectedEntity());
  }

  clearSelection(): void { this.releaseSelectionPivot(true); this.clearSelectionVisuals(false); this.selectedIds.clear(); this.selectedId = null; this.events.onSelectionChanged(null); }

  selectFromPointer(event: PointerEvent): boolean {
    if (this.toolState !== 'select' || event.button !== 0 || this.isTransformInteracting) return false;
    const rect = this.canvas.getBoundingClientRect(); this.pointer.x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1; this.pointer.y = -((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1; this.raycaster.setFromCamera(this.pointer, this.engine.camera.camera);
    for (const hit of this.raycaster.intersectObjects(this.runtime.getObjects(), true)) {
      let current: THREE.Object3D | null = hit.object;
      while (current) { const id = current.userData.worldEntityId as string | undefined; if (id) { this.select(id, event.shiftKey); return true; } current = current.parent; }
    }
    if (!event.shiftKey) this.clearSelection(); return false;
  }

  async placeAsset(asset: AssetRecord, position: SerializedVector3): Promise<void> {
    const entity = createWorldEntity({ assetId: asset.id, assetName: asset.name, position: { ...position, y: this.terrainHeightAt(position.x, position.z) } });
    const batch = clampToCapacity([entity], this.documentState.entities.length, MAX_WORLD_ENTITIES);
    if (!batch.accepted[0]) { this.events.onStatus(`Limite de ${MAX_WORLD_ENTITIES} objetos atingido.`, 'error'); return; }
    this.documentState.entities.push(entity); await this.runtime.add(entity, asset); this.touchDocument(); this.recordHistory(); this.select(entity.id); this.events.onStatus(`${entity.name} colocado no mapa.`, 'success');
  }

  async duplicateSelected(): Promise<void> {
    const sources = [...this.selectedIds].map((id) => this.getEntity(id)).filter((entity): entity is WorldEntityDocument => Boolean(entity)); if (!sources.length) return;
    const batch = clampToCapacity(sources, this.documentState.entities.length, MAX_WORLD_ENTITIES);
    if (!batch.accepted.length) { this.events.onStatus(`Limite de ${MAX_WORLD_ENTITIES} objetos atingido.`, 'error'); return; }
    this.releaseSelectionPivot(true); this.clearSelectionVisuals(false); const created: string[] = [];
    for (const source of batch.accepted) {
      const copy = createWorldEntity({ assetId: source.assetId, assetName: source.assetName, name: `${source.name} Copy`, position: { x: source.position.x + 0.75, y: source.position.y, z: source.position.z + 0.75 } });
      copy.rotation = { ...source.rotation }; copy.scale = { ...source.scale }; copy.visible = source.visible; copy.grounded = source.grounded; copy.groundOffset = source.groundOffset; copy.collision = { ...source.collision };
      if (copy.grounded) copy.position.y = this.terrainHeightAt(copy.position.x, copy.position.z) + copy.groundOffset; this.documentState.entities.push(copy); await this.runtime.add(copy); created.push(copy.id);
    }
    this.selectMany(created); this.touchDocument(); this.recordHistory();
    if (batch.truncated) this.events.onStatus(`Duplicação limitada a ${MAX_WORLD_ENTITIES} objetos por mapa.`, 'error');
  }

  deleteSelected(): void {
    if (!this.selectedIds.size) return; const ids = new Set(this.selectedIds); this.releaseSelectionPivot(true); this.clearSelectionVisuals(false);
    for (const id of ids) this.runtime.remove(id); this.documentState.entities = this.documentState.entities.filter((entity) => !ids.has(entity.id)); this.selectedIds.clear(); this.selectedId = null; this.touchDocument(); this.recordHistory(); this.events.onSelectionChanged(null);
  }

  focusSelected(): void {
    const objects = [...this.selectedIds].map((id) => this.runtime.getObject(id)).filter((object): object is THREE.Object3D => Boolean(object)); if (!objects.length) return;
    const bounds = new THREE.Box3(); for (const object of objects) bounds.expandByObject(object); if (!bounds.isEmpty()) this.engine.camera.setTarget(bounds.getCenter(new THREE.Vector3()));
  }

  renameSelected(name: string): void { const entity = this.getSelectedEntity(); const normalized = name.trim(); if (!entity || !normalized || normalized === entity.name) return; entity.name = normalized; const object = this.runtime.getObject(entity.id); if (object) object.name = normalized; this.touchDocument(); this.recordHistory(); }

  setSelectedVisible(visible: boolean): void {
    const ids = this.selectedIds.size ? [...this.selectedIds] : this.selectedId ? [this.selectedId] : []; if (!ids.length) return;
    for (const id of ids) { const entity = this.getEntity(id); const object = this.runtime.getObject(id); if (entity) entity.visible = visible; if (object) object.visible = visible; } this.touchDocument(); this.recordHistory();
  }

  setSelectedGrounding(grounded: boolean, offset?: number): void {
    const ids = this.selectedIds.size ? [...this.selectedIds] : this.selectedId ? [this.selectedId] : []; if (!ids.length) return;
    this.releaseSelectionPivot(true);
    for (const id of ids) { const entity = this.getEntity(id); const object = this.runtime.getObject(id); if (!entity || !object) continue; entity.grounded = grounded; if (offset !== undefined && Number.isFinite(offset)) entity.groundOffset = offset; if (grounded) entity.position.y = this.terrainHeightAt(entity.position.x, entity.position.z) + entity.groundOffset; applyEntityTransform(entity, object); }
    this.refreshSelectionVisuals(); this.touchDocument(); this.recordHistory();
  }

  snapSelectedToGround(): void { const entity = this.getSelectedEntity(); if (!entity) return; this.setSelectedGrounding(true, entity.groundOffset); }

  setSelectedCollision(mode: EntityCollisionMode, radius?: number): void {
    const ids = this.selectedIds.size ? [...this.selectedIds] : this.selectedId ? [this.selectedId] : []; if (!ids.length) return;
    for (const id of ids) { const entity = this.getEntity(id); if (!entity) continue; entity.collision = mode === 'radius' ? { mode, radius: Math.max(0.1, Math.min(30, radius ?? entity.collision.radius ?? 1)) } : { mode }; }
    this.environment.refreshCollisionFootprints(this.documentState); this.touchDocument(); this.recordHistory();
  }

  updateSelectedTransform(transform: { position: SerializedVector3; rotationDegrees: SerializedVector3; scale: SerializedVector3 }): void {
    const entity = this.getSelectedEntity(); const object = entity ? this.runtime.getObject(entity.id) : undefined; if (!entity || !object || this.selectedIds.size > 1) return;
    entity.position = { ...transform.position }; entity.rotation = { x: THREE.MathUtils.degToRad(transform.rotationDegrees.x), y: THREE.MathUtils.degToRad(transform.rotationDegrees.y), z: THREE.MathUtils.degToRad(transform.rotationDegrees.z) }; entity.scale = { x: Math.max(0.001, transform.scale.x), y: Math.max(0.001, transform.scale.y), z: Math.max(0.001, transform.scale.z) };
    if (entity.grounded) entity.position.y = this.terrainHeightAt(entity.position.x, entity.position.z) + entity.groundOffset; applyEntityTransform(entity, object); this.updateSelectionBoxes(); this.touchDocument(); this.recordHistory();
  }

  getSelectedEntity(): WorldEntityDocument | null { return this.selectedId ? this.getEntity(this.selectedId) ?? null : null; }
  canUndo(): boolean { return this.historyIndex > 0; }
  canRedo(): boolean { return this.historyIndex >= 0 && this.historyIndex < this.history.length - 1; }
  async undo(): Promise<void> { if (!this.canUndo()) return; this.historyIndex -= 1; await this.restoreHistory(); }
  async redo(): Promise<void> { if (!this.canRedo()) return; this.historyIndex += 1; await this.restoreHistory(); }

  private async pasteRegionAt(centerX: number, centerZ: number): Promise<void> {
    const clipboard = this.regionClipboard; if (!clipboard) return;
    this.releaseSelectionPivot(true); this.clearSelectionVisuals(false); this.selectedIds.clear(); this.selectedId = null;
    const pendingEntities: WorldEntityDocument[] = [];
    for (const relative of clipboard.entities) {
      const source = relative.entity; const x = centerX + relative.dx; const z = centerZ + relative.dz;
      const copy = createWorldEntity({ assetId: source.assetId, assetName: source.assetName, name: source.name, position: { x, y: source.position.y, z } });
      copy.rotation = { ...source.rotation }; copy.scale = { ...source.scale }; copy.visible = source.visible; copy.grounded = source.grounded; copy.groundOffset = source.groundOffset; copy.collision = { ...source.collision }; if (copy.grounded) copy.position.y = this.terrainHeightAt(x, z) + copy.groundOffset;
      pendingEntities.push(copy);
    }
    const pendingHeights = clipboard.heights.map((relative) => createHeightStamp({ ...relative.stamp, x: centerX + relative.dx, z: centerZ + relative.dz }));
    const pendingPaints = clipboard.paints.filter((relative) => this.layerById(relative.stamp.layerId)).map((relative) => createPaintStamp({ ...relative.stamp, x: centerX + relative.dx, z: centerZ + relative.dz }));
    const pendingBlockers = clipboard.blockers.map((relative) => createBlocker({ x1: centerX + relative.dx1, z1: centerZ + relative.dz1, x2: centerX + relative.dx2, z2: centerZ + relative.dz2 }));
    const entityBatch = clampToCapacity(pendingEntities, this.documentState.entities.length, MAX_WORLD_ENTITIES);
    const heightBatch = clampToCapacity(pendingHeights, this.documentState.terrain.heightStamps.length, MAX_TERRAIN_HEIGHT_STAMPS);
    const paintBatch = clampToCapacity(pendingPaints, this.documentState.terrain.paintStamps.length, MAX_TERRAIN_PAINT_STAMPS);
    const blockerBatch = clampToCapacity(pendingBlockers, this.documentState.blockers.length, MAX_WORLD_BLOCKERS);
    this.documentState.entities.push(...entityBatch.accepted);
    this.documentState.terrain.heightStamps.push(...heightBatch.accepted);
    this.documentState.terrain.paintStamps.push(...paintBatch.accepted);
    this.documentState.blockers.push(...blockerBatch.accepted);
    const created = entityBatch.accepted.map((entity) => entity.id);
    this.regionState = { minX: centerX - clipboard.width * 0.5, maxX: centerX + clipboard.width * 0.5, minZ: centerZ - clipboard.depth * 0.5, maxZ: centerZ + clipboard.depth * 0.5 }; this.environment.setRegionPreview(this.regionState);
    await this.rebuildAfterBatch(); this.selectMany(created); this.recordHistory(); this.events.onStatus(`Região colada com ${created.length} objeto(s).`, 'success');
    if (entityBatch.truncated || heightBatch.truncated || paintBatch.truncated || blockerBatch.truncated) this.events.onStatus('Parte da região não coube nos limites seguros do mapa.', 'error');
  }

  private slopeAt(x: number, z: number): number {
    const sample = 0.65; const dx = (this.terrainHeightAt(x + sample, z) - this.terrainHeightAt(x - sample, z)) / (sample * 2); const dz = (this.terrainHeightAt(x, z + sample) - this.terrainHeightAt(x, z - sample)) / (sample * 2); return THREE.MathUtils.radToDeg(Math.atan(Math.hypot(dx, dz)));
  }

  private applyBrush(point: THREE.Vector3): void {
    if (this.lastStrokePoint && point.distanceTo(this.lastStrokePoint) < Math.max(0.18, this.brush.radius * 0.2)) return;
    this.lastStrokePoint = point.clone(); let region: TerrainRegion | null = null;
    if (this.toolState === 'paint') {
      if (this.documentState.terrain.paintStamps.length >= MAX_TERRAIN_PAINT_STAMPS) { this.events.onStatus('Limite de pintura do terreno atingido.', 'error'); return; }
      const layer = this.layerById(this.brush.paintLayerId); if (!layer || layer.locked) return;
      const stamp = createPaintStamp({ x: point.x, z: point.z, radius: this.brush.radius, layerId: layer.id, strength: Math.min(1, this.brush.strength / 10), mode: this.strokePaintErase ? 'erase' : 'paint' }); this.documentState.terrain.paintStamps.push(stamp); region = stampRegion(stamp);
    } else if (this.toolState === 'erase') {
      const paintIndex = latestPaintStampIndex(this.documentState.terrain.paintStamps, point.x, point.z); const heightIndex = latestHeightStampIndex(this.documentState.terrain.heightStamps, point.x, point.z);
      if (paintIndex >= 0) { const [removed] = this.documentState.terrain.paintStamps.splice(paintIndex, 1); if (removed) region = stampRegion(removed); }
      else if (heightIndex >= 0) { const [removed] = this.documentState.terrain.heightStamps.splice(heightIndex, 1); if (removed) region = stampRegion(removed); }
    } else {
      if (this.documentState.terrain.heightStamps.length >= MAX_TERRAIN_HEIGHT_STAMPS) { this.events.onStatus('Limite de escultura do terreno atingido.', 'error'); return; }
      let delta = this.brush.strength * 0.11; let mode: 'add' | 'level' = 'add';
      if (this.toolState === 'lower') delta *= -1;
      if (this.toolState === 'smooth') { const current = this.terrainHeightAt(point.x, point.z); const average = averageTerrainHeight(this.documentState, point.x, point.z, this.brush.radius); delta = current + (average - current) * Math.min(0.9, 0.12 + this.brush.strength / 38); mode = 'level'; }
      if (this.toolState === 'flatten') { delta = this.flattenTarget; mode = 'level'; }
      const stamp = createHeightStamp({ x: point.x, z: point.z, radius: this.brush.radius, delta, falloff: this.brush.falloff, mode }); this.documentState.terrain.heightStamps.push(stamp); region = stampRegion(stamp);
    }
    if (!region) return;
    this.strokeRegion = unionTerrainRegion(this.strokeRegion, region); this.documentState.updatedAt = Date.now(); this.environment.refreshTerrain(this.documentState, region); this.runtime.reseatGrounded(this.documentState, region); this.updateSelectionBoxes();
  }

  private layerById(layerId: string): TerrainLayerDocument | undefined { return this.documentState.terrain.layers.find((layer) => layer.id === layerId); }

  private refreshTerrainAndCommit(): void { this.ensureBrushLayer(); this.environment.refreshTerrain(this.documentState); this.environment.setTerrainMaskPreview(this.documentState, this.maskPreviewLayerId); this.touchDocument(); this.recordHistory(); }
  private ensureBrushLayer(): void { if (!this.layerById(this.brush.paintLayerId)) this.brush.paintLayerId = this.documentState.terrain.layers[0]?.id ?? ''; }

  private finishAuthoringGesture(): void {
    if (this.strokeActive) { this.strokeActive = false; this.lastStrokePoint = null; if (this.strokeRegion) this.recordHistory(); }
    this.strokePaintErase = false; this.strokeRegion = null; this.blockerStart = null; this.regionStart = null; this.environment.setBlockerPreview(null, null);
  }

  private async activateDocument(document: WorldDocument): Promise<void> {
    this.finishAuthoringGesture(); this.clearSelection(); this.documentState = cloneWorldDocument(document); this.ensureBrushLayer(); this.maskPreviewLayerId = null; this.regionState = null; this.regionClipboard = null; this.pasteArmed = false; this.scatterPreview = [];
    this.environment.update(this.documentState); this.environment.setTerrainMaskPreview(this.documentState, null); this.environment.setRegionPreview(null); this.environment.setScatterPreview(null); await this.runtime.build(this.documentState); this.runtime.setObjectsVisible(this.objectsVisible);
    await this.worlds.setCurrentId(this.documentState.id); this.resetHistory(); this.emitDocumentChanged();
  }

  private async rebuildAfterBatch(): Promise<void> {
    this.environment.update(this.documentState); this.environment.setTerrainMaskPreview(this.documentState, this.maskPreviewLayerId); await this.runtime.build(this.documentState); this.runtime.setObjectsVisible(this.objectsVisible); this.touchDocument(false);
  }

  private refreshSelectionVisuals(): void {
    this.releaseSelectionPivot(true); this.clearSelectionVisuals(false);
    const validIds = [...this.selectedIds].filter((id) => this.getEntity(id) && this.runtime.getObject(id)); this.selectedIds.clear(); validIds.forEach((id) => this.selectedIds.add(id));
    if (!this.selectedIds.size) { this.selectedId = null; return; }
    if (!this.selectedId || !this.selectedIds.has(this.selectedId)) this.selectedId = [...this.selectedIds].at(-1) ?? null;
    for (const id of this.selectedIds) { const object = this.runtime.getObject(id); if (!object) continue; const box = new THREE.BoxHelper(object, id === this.selectedId ? 0x78baff : 0x69d9a9); box.userData.editorHelper = true; this.selectionBoxes.set(id, box); this.engine.scene.add(box); }
    if (this.selectedIds.size === 1) { const object = this.selectedId ? this.runtime.getObject(this.selectedId) : undefined; if (object) this.transformControls.attach(object); return; }
    const pivot = new THREE.Group(); pivot.name = 'Multi Selection Pivot'; pivot.userData.editorHelper = true; const center = new THREE.Vector3(); let count = 0;
    for (const id of this.selectedIds) { const object = this.runtime.getObject(id); if (!object) continue; center.add(object.getWorldPosition(new THREE.Vector3())); count += 1; }
    if (count > 0) center.multiplyScalar(1 / count); pivot.position.copy(center); this.engine.scene.add(pivot);
    for (const id of this.selectedIds) { const object = this.runtime.getObject(id); if (object) pivot.attach(object); }
    this.selectionPivot = pivot; this.transformControls.attach(pivot);
  }

  private releaseSelectionPivot(sync: boolean): void {
    const pivot = this.selectionPivot; if (!pivot) return;
    this.transformControls.detach();
    for (const id of this.selectedIds) {
      const object = this.runtime.getObject(id); const entity = this.getEntity(id); if (!object || object.parent !== pivot) continue;
      this.engine.scene.attach(object);
      if (sync && entity) { syncEntityWorldTransform(entity, object); if (entity.grounded) entity.groundOffset = entity.position.y - this.terrainHeightAt(entity.position.x, entity.position.z); }
    }
    this.engine.scene.remove(pivot); this.selectionPivot = null;
  }

  private clearSelectionVisuals(releasePivot = true): void {
    if (releasePivot) this.releaseSelectionPivot(true); this.transformControls.detach();
    for (const box of this.selectionBoxes.values()) this.engine.scene.remove(box); this.selectionBoxes.clear();
  }

  private updateSelectionBoxes(): void { for (const box of this.selectionBoxes.values()) box.update(); }
  private getEntity(id: string): WorldEntityDocument | undefined { return this.documentState.entities.find((entity) => entity.id === id); }
  private touchDocument(emit = true): void { this.documentState.updatedAt = Date.now(); this.schedulePersist(); if (emit) this.emitDocumentChanged(); }

  private schedulePersist(): void {
    if (this.saveTimer) window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => { this.saveTimer = 0; void this.saveCurrent().catch((error: unknown) => this.events.onStatus(`Autosave falhou: ${error instanceof Error ? error.message : String(error)}`, 'error')); }, 180);
  }

  private emitDocumentChanged(): void { this.events.onDocumentChanged(this.documentState); this.events.onSelectionChanged(this.getSelectedEntity()); }
  private resetHistory(): void { this.history = [cloneWorldDocument(this.documentState)]; this.historyIndex = 0; }
  private recordHistory(): void { this.history.splice(this.historyIndex + 1); this.history.push(cloneWorldDocument(this.documentState)); if (this.history.length > HISTORY_LIMIT) this.history.shift(); this.historyIndex = this.history.length - 1; this.emitDocumentChanged(); }

  private async restoreHistory(): Promise<void> {
    const snapshot = this.history[this.historyIndex]; if (!snapshot) return; this.clearSelection(); this.documentState = cloneWorldDocument(snapshot); this.ensureBrushLayer(); this.environment.update(this.documentState); this.environment.setTerrainMaskPreview(this.documentState, this.maskPreviewLayerId); await this.runtime.build(this.documentState); this.runtime.setObjectsVisible(this.objectsVisible); this.touchDocument();
  }

  private handleDraggingChanged = (event: unknown): void => { this.transformDragging = Boolean((event as { value?: boolean }).value); };
  private handleObjectChange = (): void => {
    if (this.selectionPivot) { this.updateSelectionBoxes(); return; }
    const entity = this.getSelectedEntity(); const object = entity ? this.runtime.getObject(entity.id) : undefined; if (!entity || !object) return; syncEntityTransform(entity, object); if (entity.grounded) entity.groundOffset = object.position.y - this.terrainHeightAt(object.position.x, object.position.z); this.updateSelectionBoxes(); this.touchDocument();
  };
  private handleTransformEnd = (): void => {
    if (!this.selectedIds.size) return;
    if (this.selectionPivot) { this.releaseSelectionPivot(true); this.refreshSelectionVisuals(); this.touchDocument(); this.recordHistory(); return; }
    if (this.getSelectedEntity()) { this.touchDocument(); this.recordHistory(); }
  };
}
