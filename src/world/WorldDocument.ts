export const WORLD_DOCUMENT_VERSION = 1 as const;

export interface SerializedVector3 {
  x: number;
  y: number;
  z: number;
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
  name: string;
  entities: WorldEntityDocument[];
  updatedAt: number;
}

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

export function createWorldDocument(name = 'Ascension World'): WorldDocument {
  return {
    version: WORLD_DOCUMENT_VERSION,
    name,
    entities: [],
    updatedAt: Date.now(),
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
    entities: document.entities.map((entity) => ({
      ...entity,
      position: { ...entity.position },
      rotation: { ...entity.rotation },
      scale: { ...entity.scale },
    })),
  };
}

export function parseWorldDocument(value: unknown): WorldDocument {
  if (!value || typeof value !== 'object') throw new Error('WorldDocument inválido.');
  const raw = value as Partial<WorldDocument> & { entities?: unknown[] };
  if (raw.version !== WORLD_DOCUMENT_VERSION) {
    throw new Error(`Versão de WorldDocument não suportada: ${String(raw.version)}.`);
  }

  const entities = Array.isArray(raw.entities) ? raw.entities : [];
  const normalized: WorldEntityDocument[] = entities.map((entry, index) => {
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

  return {
    version: WORLD_DOCUMENT_VERSION,
    name: text(raw.name, 'Ascension World'),
    entities: normalized,
    updatedAt: finite(raw.updatedAt, Date.now()),
  };
}
