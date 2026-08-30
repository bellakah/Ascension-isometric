export const WORLD_DOCUMENT_VERSION = 3 as const;
export const LEGACY_WORLD_DOCUMENT_VERSIONS = [1, 2] as const;

export interface SerializedVector3 { x: number; y: number; z: number; }
export type TerrainFalloff = 'smooth' | 'flat';
export type TerrainStampMode = 'add' | 'level';
export type EntityCollisionMode = 'none' | 'auto' | 'radius';

export interface WorldEnvironmentDocument {
  groundSize: number;
  groundColor: string;
  backgroundColor: string;
}

export interface TerrainHeightStamp {
  id: string;
  x: number;
  z: number;
  radius: number;
  delta: number;
  falloff: TerrainFalloff;
  mode: TerrainStampMode;
}

export interface TerrainPaintStamp {
  id: string;
  x: number;
  z: number;
  radius: number;
  layer: number;
  strength: number;
}

export interface TerrainLayerDocument {
  id: string;
  name: string;
  materialId?: string;
  materialName?: string;
  fallbackColor: string;
  tileScale: number;
}

export interface TerrainDocument {
  resolution: number;
  heightStamps: TerrainHeightStamp[];
  paintStamps: TerrainPaintStamp[];
  layers: TerrainLayerDocument[];
}

export interface WorldWaterDocument {
  enabled: boolean;
  level: number;
  color: string;
  opacity: number;
}

export interface WorldBlockerDocument {
  id: string;
  x1: number;
  z1: number;
  x2: number;
  z2: number;
}

export interface WorldEntityCollisionDocument {
  mode: EntityCollisionMode;
  radius?: number;
}

export interface WorldEntityDocument {
  id: string;
  name: string;
  assetId: string;
  assetName: string;
  position: SerializedVector3;
  rotation: SerializedVector3;
  scale: SerializedVector3;
  visible: boolean;
  grounded: boolean;
  groundOffset: number;
  collision: WorldEntityCollisionDocument;
}

export interface WorldDocument {
  version: typeof WORLD_DOCUMENT_VERSION;
  id: string;
  name: string;
  description: string;
  spawn: SerializedVector3;
  environment: WorldEnvironmentDocument;
  terrain: TerrainDocument;
  water: WorldWaterDocument;
  blockers: WorldBlockerDocument[];
  entities: WorldEntityDocument[];
  createdAt: number;
  updatedAt: number;
}

const MAX_TERRAIN_STAMPS = 4000;
const MAX_PAINT_STAMPS = 4000;
const MAX_BLOCKERS = 256;
const MAX_TERRAIN_LAYERS = 4;

const DEFAULT_ENVIRONMENT: WorldEnvironmentDocument = {
  groundSize: 100,
  groundColor: '#71955f',
  backgroundColor: '#9fc2da',
};

const DEFAULT_LAYERS: TerrainLayerDocument[] = [
  { id: 'grass', name: 'Grass', fallbackColor: '#71955f', tileScale: 10 },
  { id: 'dirt', name: 'Dirt', fallbackColor: '#8b7355', tileScale: 10 },
  { id: 'rock', name: 'Rock', fallbackColor: '#7c817e', tileScale: 8 },
  { id: 'sand', name: 'Sand', fallbackColor: '#c9b77d', tileScale: 9 },
];

const DEFAULT_WATER: WorldWaterDocument = {
  enabled: false,
  level: -0.25,
  color: '#4f9fbd',
  opacity: 0.62,
};

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function vector(value: unknown, fallback: SerializedVector3): SerializedVector3 {
  if (!value || typeof value !== 'object') return { ...fallback };
  const candidate = value as Partial<SerializedVector3>;
  return { x: finite(candidate.x, fallback.x), y: finite(candidate.y, fallback.y), z: finite(candidate.z, fallback.z) };
}

function text(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function color(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value.trim()) ? value.trim().toLowerCase() : fallback;
}

function id(prefix: string): string {
  return globalThis.crypto?.randomUUID?.() ?? `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function worldId(): string { return id('world'); }
function entityId(): string { return id('entity'); }
function stampId(): string { return id('stamp'); }
function blockerId(): string { return id('blocker'); }

function legacyWorldId(name: string, updatedAt: number): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'world';
  return `legacy-${slug}-${Math.max(0, Math.floor(updatedAt))}`;
}

function parseLayer(value: unknown, index: number): TerrainLayerDocument {
  const fallback = DEFAULT_LAYERS[index] ?? DEFAULT_LAYERS[0]!;
  const raw = value && typeof value === 'object' ? value as Partial<TerrainLayerDocument> : {};
  const materialId = typeof raw.materialId === 'string' && raw.materialId.trim() ? raw.materialId.trim() : undefined;
  const materialName = typeof raw.materialName === 'string' && raw.materialName.trim() ? raw.materialName.trim() : undefined;
  return {
    id: text(raw.id, fallback.id),
    name: text(raw.name, fallback.name),
    ...(materialId ? { materialId } : {}),
    ...(materialName ? { materialName } : {}),
    fallbackColor: color(raw.fallbackColor, fallback.fallbackColor),
    tileScale: Math.max(0.25, Math.min(100, finite(raw.tileScale, fallback.tileScale))),
  };
}

function parseTerrain(value: unknown): TerrainDocument {
  const raw = value && typeof value === 'object' ? value as Partial<TerrainDocument> : {};
  const rawLayers = Array.isArray(raw.layers) ? raw.layers.slice(0, MAX_TERRAIN_LAYERS) : [];
  const layers = Array.from({ length: MAX_TERRAIN_LAYERS }, (_, index) => parseLayer(rawLayers[index], index));
  const heightStamps: TerrainHeightStamp[] = [];
  if (Array.isArray(raw.heightStamps)) {
    for (const entry of raw.heightStamps.slice(0, MAX_TERRAIN_STAMPS)) {
      if (!entry || typeof entry !== 'object') continue;
      const stamp = entry as Partial<TerrainHeightStamp>;
      const radius = Math.max(0.25, Math.min(200, finite(stamp.radius, 4)));
      heightStamps.push({
        id: text(stamp.id, stampId()),
        x: finite(stamp.x, 0), z: finite(stamp.z, 0), radius,
        delta: Math.max(-200, Math.min(200, finite(stamp.delta, 0))),
        falloff: stamp.falloff === 'flat' ? 'flat' : 'smooth',
        mode: stamp.mode === 'level' ? 'level' : 'add',
      });
    }
  }
  const paintStamps: TerrainPaintStamp[] = [];
  if (Array.isArray(raw.paintStamps)) {
    for (const entry of raw.paintStamps.slice(0, MAX_PAINT_STAMPS)) {
      if (!entry || typeof entry !== 'object') continue;
      const stamp = entry as Partial<TerrainPaintStamp>;
      paintStamps.push({
        id: text(stamp.id, stampId()),
        x: finite(stamp.x, 0), z: finite(stamp.z, 0),
        radius: Math.max(0.25, Math.min(200, finite(stamp.radius, 4))),
        layer: Math.max(0, Math.min(MAX_TERRAIN_LAYERS - 1, Math.floor(finite(stamp.layer, 0)))),
        strength: Math.max(0.01, Math.min(1, finite(stamp.strength, 1))),
      });
    }
  }
  return {
    resolution: Math.max(16, Math.min(192, Math.round(finite(raw.resolution, 64)))),
    heightStamps,
    paintStamps,
    layers,
  };
}

function parseWater(value: unknown): WorldWaterDocument {
  const raw = value && typeof value === 'object' ? value as Partial<WorldWaterDocument> : {};
  return {
    enabled: raw.enabled === true,
    level: Math.max(-100, Math.min(100, finite(raw.level, DEFAULT_WATER.level))),
    color: color(raw.color, DEFAULT_WATER.color),
    opacity: Math.max(0.05, Math.min(0.95, finite(raw.opacity, DEFAULT_WATER.opacity))),
  };
}

function parseBlockers(value: unknown): WorldBlockerDocument[] {
  if (!Array.isArray(value)) return [];
  const blockers: WorldBlockerDocument[] = [];
  for (const entry of value.slice(0, MAX_BLOCKERS)) {
    if (!entry || typeof entry !== 'object') continue;
    const raw = entry as Partial<WorldBlockerDocument>;
    const x1 = finite(raw.x1, 0); const z1 = finite(raw.z1, 0); const x2 = finite(raw.x2, x1); const z2 = finite(raw.z2, z1);
    if (Math.hypot(x2 - x1, z2 - z1) < 0.1) continue;
    blockers.push({ id: text(raw.id, blockerId()), x1, z1, x2, z2 });
  }
  return blockers;
}

function parseCollision(value: unknown): WorldEntityCollisionDocument {
  const raw = value && typeof value === 'object' ? value as Partial<WorldEntityCollisionDocument> : {};
  const mode: EntityCollisionMode = raw.mode === 'auto' || raw.mode === 'radius' ? raw.mode : 'none';
  if (mode !== 'radius') return { mode };
  return { mode, radius: Math.max(0.1, Math.min(30, finite(raw.radius, 1))) };
}

function parseEntities(entries: unknown[], legacy: boolean): WorldEntityDocument[] {
  const normalized: WorldEntityDocument[] = entries.map((entry, index) => {
    if (!entry || typeof entry !== 'object') throw new Error(`Entidade inválida no índice ${index}.`);
    const entity = entry as Partial<WorldEntityDocument>;
    const assetId = text(entity.assetId, '');
    if (!assetId) throw new Error(`Entidade ${index} não possui assetId.`);
    const assetName = text(entity.assetName, 'Asset');
    const scale = vector(entity.scale, { x: 1, y: 1, z: 1 });
    scale.x = Math.max(0.001, Math.abs(scale.x)); scale.y = Math.max(0.001, Math.abs(scale.y)); scale.z = Math.max(0.001, Math.abs(scale.z));
    return {
      id: text(entity.id, `entity-${index}`), name: text(entity.name, assetName), assetId, assetName,
      position: vector(entity.position, { x: 0, y: 0, z: 0 }), rotation: vector(entity.rotation, { x: 0, y: 0, z: 0 }), scale,
      visible: entity.visible !== false,
      grounded: legacy ? entity.grounded === true : entity.grounded !== false,
      groundOffset: finite(entity.groundOffset, 0),
      collision: parseCollision(entity.collision),
    };
  });
  const ids = new Set<string>();
  for (const entity of normalized) { if (ids.has(entity.id)) throw new Error(`ID de entidade duplicado: ${entity.id}.`); ids.add(entity.id); }
  return normalized;
}

export function createWorldDocument(name = 'Novo mapa'): WorldDocument {
  const now = Date.now();
  return {
    version: WORLD_DOCUMENT_VERSION, id: worldId(), name: name.trim() || 'Novo mapa', description: '',
    spawn: { x: 0, y: 0, z: 0 }, environment: { ...DEFAULT_ENVIRONMENT },
    terrain: { resolution: 64, heightStamps: [], paintStamps: [], layers: DEFAULT_LAYERS.map((layer) => ({ ...layer })) },
    water: { ...DEFAULT_WATER }, blockers: [], entities: [], createdAt: now, updatedAt: now,
  };
}

export function createWorldEntity(input: { id?: string; assetId: string; assetName: string; name?: string; position?: Partial<SerializedVector3>; }): WorldEntityDocument {
  return {
    id: input.id ?? entityId(), name: input.name?.trim() || input.assetName, assetId: input.assetId, assetName: input.assetName,
    position: { x: finite(input.position?.x, 0), y: finite(input.position?.y, 0), z: finite(input.position?.z, 0) },
    rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, visible: true,
    grounded: true, groundOffset: 0, collision: { mode: 'none' },
  };
}

export function cloneWorldDocument(document: WorldDocument): WorldDocument {
  return {
    ...document,
    spawn: { ...document.spawn }, environment: { ...document.environment }, water: { ...document.water },
    terrain: {
      resolution: document.terrain.resolution,
      heightStamps: document.terrain.heightStamps.map((stamp) => ({ ...stamp })),
      paintStamps: document.terrain.paintStamps.map((stamp) => ({ ...stamp })),
      layers: document.terrain.layers.map((layer) => ({ ...layer })),
    },
    blockers: document.blockers.map((blocker) => ({ ...blocker })),
    entities: document.entities.map((entity) => ({ ...entity, position: { ...entity.position }, rotation: { ...entity.rotation }, scale: { ...entity.scale }, collision: { ...entity.collision } })),
  };
}

export function parseWorldDocument(value: unknown): WorldDocument {
  if (!value || typeof value !== 'object') throw new Error('WorldDocument inválido.');
  const raw = value as Partial<WorldDocument> & { version?: number; entities?: unknown[] };
  const legacy = raw.version === 1 || raw.version === 2;
  if (raw.version !== WORLD_DOCUMENT_VERSION && !legacy) throw new Error(`Versão de WorldDocument não suportada: ${String(raw.version)}.`);
  const name = text(raw.name, 'Ascension World');
  const updatedAt = finite(raw.updatedAt, Date.now()); const createdAt = finite(raw.createdAt, updatedAt);
  const environmentRaw = raw.environment && typeof raw.environment === 'object' ? raw.environment as Partial<WorldEnvironmentDocument> : {};
  const environment = {
    groundSize: Math.max(10, Math.min(1000, finite(environmentRaw.groundSize, DEFAULT_ENVIRONMENT.groundSize))),
    groundColor: color(environmentRaw.groundColor, DEFAULT_ENVIRONMENT.groundColor),
    backgroundColor: color(environmentRaw.backgroundColor, DEFAULT_ENVIRONMENT.backgroundColor),
  };
  const terrain = parseTerrain(raw.terrain);
  if (legacy && (!raw.terrain || typeof raw.terrain !== 'object')) terrain.layers[0] = { ...terrain.layers[0]!, fallbackColor: environment.groundColor };
  return {
    version: WORLD_DOCUMENT_VERSION,
    id: text(raw.id, legacyWorldId(name, updatedAt)), name, description: typeof raw.description === 'string' ? raw.description.trim() : '',
    spawn: vector(raw.spawn, { x: 0, y: 0, z: 0 }), environment, terrain,
    water: parseWater(raw.water), blockers: parseBlockers(raw.blockers),
    entities: parseEntities(Array.isArray(raw.entities) ? raw.entities : [], legacy), createdAt, updatedAt,
  };
}

export function duplicateWorldDocument(source: WorldDocument, name = `${source.name} Copy`): WorldDocument {
  const copy = cloneWorldDocument(source); const now = Date.now();
  copy.id = worldId(); copy.name = name.trim() || `${source.name} Copy`; copy.createdAt = now; copy.updatedAt = now;
  copy.entities = copy.entities.map((entity) => ({ ...entity, id: entityId() }));
  copy.blockers = copy.blockers.map((blocker) => ({ ...blocker, id: blockerId() }));
  copy.terrain.heightStamps = copy.terrain.heightStamps.map((stamp) => ({ ...stamp, id: stampId() }));
  copy.terrain.paintStamps = copy.terrain.paintStamps.map((stamp) => ({ ...stamp, id: stampId() }));
  return copy;
}

export function createHeightStamp(input: Omit<TerrainHeightStamp, 'id'>): TerrainHeightStamp { return { id: stampId(), ...input }; }
export function createPaintStamp(input: Omit<TerrainPaintStamp, 'id'>): TerrainPaintStamp { return { id: stampId(), ...input }; }
export function createBlocker(input: Omit<WorldBlockerDocument, 'id'>): WorldBlockerDocument { return { id: blockerId(), ...input }; }
