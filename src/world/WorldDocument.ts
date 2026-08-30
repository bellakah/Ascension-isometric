export const WORLD_DOCUMENT_VERSION = 2 as const;
export const LEGACY_WORLD_DOCUMENT_VERSION = 1 as const;

export interface SerializedVector3 {
  x: number;
  y: number;
  z: number;
}

export interface WorldEnvironmentDocument {
  groundSize: number;
  groundColor: string;
  backgroundColor: string;
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
}

export interface WorldDocument {
  version: typeof WORLD_DOCUMENT_VERSION;
  id: string;
  name: string;
  description: string;
  spawn: SerializedVector3;
  environment: WorldEnvironmentDocument;
  entities: WorldEntityDocument[];
  createdAt: number;
  updatedAt: number;
}

const DEFAULT_ENVIRONMENT: WorldEnvironmentDocument = {
  groundSize: 100,
  groundColor: '#71955f',
  backgroundColor: '#9fc2da',
};

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function vector(value: unknown, fallback: SerializedVector3): SerializedVector3 {
  if (!value || typeof value !== 'object') return { ...fallback };
  const candidate = value as Partial<SerializedVector3>;
  return {
    x: finite(candidate.x, fallback.x),
    y: finite(candidate.y, fallback.y),
    z: finite(candidate.z, fallback.z),
  };
}

function text(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function color(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value.trim()) ? value.trim().toLowerCase() : fallback;
}

function worldId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `world-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function legacyWorldId(name: string, updatedAt: number): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'world';
  return `legacy-${slug}-${Math.max(0, Math.floor(updatedAt))}`;
}

export function createWorldDocument(name = 'Novo mapa'): WorldDocument {
  const now = Date.now();
  return {
    version: WORLD_DOCUMENT_VERSION,
    id: worldId(),
    name: name.trim() || 'Novo mapa',
    description: '',
    spawn: { x: 0, y: 0, z: 0 },
    environment: { ...DEFAULT_ENVIRONMENT },
    entities: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function createWorldEntity(input: {
  id?: string;
  assetId: string;
  assetName: string;
  name?: string;
  position?: Partial<SerializedVector3>;
}): WorldEntityDocument {
  const randomId = globalThis.crypto?.randomUUID?.() ?? `entity-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return {
    id: input.id ?? randomId,
    name: input.name?.trim() || input.assetName,
    assetId: input.assetId,
    assetName: input.assetName,
    position: {
      x: finite(input.position?.x, 0),
      y: finite(input.position?.y, 0),
      z: finite(input.position?.z, 0),
    },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    visible: true,
  };
}

export function cloneWorldDocument(document: WorldDocument): WorldDocument {
  return {
    ...document,
    spawn: { ...document.spawn },
    environment: { ...document.environment },
    entities: document.entities.map((entity) => ({
      ...entity,
      position: { ...entity.position },
      rotation: { ...entity.rotation },
      scale: { ...entity.scale },
    })),
  };
}

function parseEntities(entries: unknown[]): WorldEntityDocument[] {
  const normalized: WorldEntityDocument[] = entries.map((entry, index) => {
    if (!entry || typeof entry !== 'object') throw new Error(`Entidade inválida no índice ${index}.`);
    const entity = entry as Partial<WorldEntityDocument>;
    const assetId = text(entity.assetId, '');
    if (!assetId) throw new Error(`Entidade ${index} não possui assetId.`);
    const assetName = text(entity.assetName, 'Asset');
    const scale = vector(entity.scale, { x: 1, y: 1, z: 1 });
    scale.x = Math.max(0.001, Math.abs(scale.x));
    scale.y = Math.max(0.001, Math.abs(scale.y));
    scale.z = Math.max(0.001, Math.abs(scale.z));
    return {
      id: text(entity.id, `entity-${index}`),
      name: text(entity.name, assetName),
      assetId,
      assetName,
      position: vector(entity.position, { x: 0, y: 0, z: 0 }),
      rotation: vector(entity.rotation, { x: 0, y: 0, z: 0 }),
      scale,
      visible: entity.visible !== false,
    };
  });

  const ids = new Set<string>();
  for (const entity of normalized) {
    if (ids.has(entity.id)) throw new Error(`ID de entidade duplicado: ${entity.id}.`);
    ids.add(entity.id);
  }
  return normalized;
}

export function parseWorldDocument(value: unknown): WorldDocument {
  if (!value || typeof value !== 'object') throw new Error('WorldDocument inválido.');
  const raw = value as Partial<WorldDocument> & { version?: number; entities?: unknown[] };
  if (raw.version !== WORLD_DOCUMENT_VERSION && raw.version !== LEGACY_WORLD_DOCUMENT_VERSION) {
    throw new Error(`Versão de WorldDocument não suportada: ${String(raw.version)}.`);
  }

  const name = text(raw.name, 'Ascension World');
  const updatedAt = finite(raw.updatedAt, Date.now());
  const createdAt = finite(raw.createdAt, updatedAt);
  const environmentRaw = raw.environment && typeof raw.environment === 'object'
    ? raw.environment as Partial<WorldEnvironmentDocument>
    : {};

  return {
    version: WORLD_DOCUMENT_VERSION,
    id: text(raw.id, legacyWorldId(name, updatedAt)),
    name,
    description: text(raw.description, ''),
    spawn: vector(raw.spawn, { x: 0, y: 0, z: 0 }),
    environment: {
      groundSize: Math.max(10, Math.min(1000, finite(environmentRaw.groundSize, DEFAULT_ENVIRONMENT.groundSize))),
      groundColor: color(environmentRaw.groundColor, DEFAULT_ENVIRONMENT.groundColor),
      backgroundColor: color(environmentRaw.backgroundColor, DEFAULT_ENVIRONMENT.backgroundColor),
    },
    entities: parseEntities(Array.isArray(raw.entities) ? raw.entities : []),
    createdAt,
    updatedAt,
  };
}

export function duplicateWorldDocument(source: WorldDocument, name = `${source.name} Copy`): WorldDocument {
  const copy = cloneWorldDocument(source);
  const now = Date.now();
  copy.id = worldId();
  copy.name = name.trim() || `${source.name} Copy`;
  copy.createdAt = now;
  copy.updatedAt = now;
  copy.entities = copy.entities.map((entity) => ({ ...entity, id: globalThis.crypto?.randomUUID?.() ?? `entity-${now}-${Math.random().toString(16).slice(2)}` }));
  return copy;
}
