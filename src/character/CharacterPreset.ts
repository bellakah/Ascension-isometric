export const CHARACTER_PRESET_VERSION = 1 as const;

export type CharacterGender = 'male' | 'female' | 'unspecified';
export type CharacterBaseMode = 'full' | 'head-only';
export type CharacterVisualSlot = 'hair' | 'outfit' | 'body' | 'arms' | 'legs' | 'feet' | 'headgear' | 'accessory';

export interface CharacterAssetRef {
  assetId: string;
  assetName: string;
}

export interface CharacterAnimationClips {
  idle: string;
  walk: string;
  run: string;
}

export interface CharacterPreset {
  version: typeof CHARACTER_PRESET_VERSION;
  id: string;
  name: string;
  gender: CharacterGender;
  base?: CharacterAssetRef;
  baseMode: CharacterBaseMode;
  visuals: Partial<Record<CharacterVisualSlot, CharacterAssetRef>>;
  animationLibraries: CharacterAssetRef[];
  clips: CharacterAnimationClips;
  createdAt: number;
  updatedAt: number;
}

function presetId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `character-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function text(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function assetRef(value: unknown): CharacterAssetRef | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Partial<CharacterAssetRef>;
  const assetId = text(candidate.assetId, '');
  if (!assetId) return undefined;
  return { assetId, assetName: text(candidate.assetName, 'Asset') };
}

function gender(value: unknown): CharacterGender {
  return value === 'male' || value === 'female' || value === 'unspecified' ? value : 'unspecified';
}

function baseMode(value: unknown): CharacterBaseMode {
  return value === 'head-only' ? 'head-only' : 'full';
}

export function createCharacterPreset(name = 'Novo personagem'): CharacterPreset {
  const now = Date.now();
  return {
    version: CHARACTER_PRESET_VERSION,
    id: presetId(),
    name: name.trim() || 'Novo personagem',
    gender: 'unspecified',
    baseMode: 'full',
    visuals: {},
    animationLibraries: [],
    clips: { idle: 'Idle_Loop', walk: 'Walk_Loop', run: 'Sprint_Loop' },
    createdAt: now,
    updatedAt: now,
  };
}

export function cloneCharacterPreset(preset: CharacterPreset): CharacterPreset {
  return {
    ...preset,
    base: preset.base ? { ...preset.base } : undefined,
    visuals: Object.fromEntries(Object.entries(preset.visuals).map(([slot, ref]) => [slot, ref ? { ...ref } : ref])) as CharacterPreset['visuals'],
    animationLibraries: preset.animationLibraries.map((ref) => ({ ...ref })),
    clips: { ...preset.clips },
  };
}

export function parseCharacterPreset(value: unknown): CharacterPreset {
  if (!value || typeof value !== 'object') throw new Error('CharacterPreset inválido.');
  const raw = value as Partial<CharacterPreset>;
  if (raw.version !== CHARACTER_PRESET_VERSION) throw new Error(`Versão de CharacterPreset não suportada: ${String(raw.version)}.`);

  const now = Date.now();
  const visualsRaw = raw.visuals && typeof raw.visuals === 'object' ? raw.visuals as Partial<Record<CharacterVisualSlot, unknown>> : {};
  const visuals: CharacterPreset['visuals'] = {};
  for (const slot of ['hair', 'outfit', 'body', 'arms', 'legs', 'feet', 'headgear', 'accessory'] as const) {
    const ref = assetRef(visualsRaw[slot]);
    if (ref) visuals[slot] = ref;
  }
  const animationLibraries = Array.isArray(raw.animationLibraries)
    ? raw.animationLibraries.map(assetRef).filter((ref): ref is CharacterAssetRef => Boolean(ref))
    : [];
  const clipsRaw = raw.clips && typeof raw.clips === 'object' ? raw.clips as Partial<CharacterAnimationClips> : {};

  return {
    version: CHARACTER_PRESET_VERSION,
    id: text(raw.id, presetId()),
    name: text(raw.name, 'Personagem'),
    gender: gender(raw.gender),
    base: assetRef(raw.base),
    baseMode: baseMode(raw.baseMode),
    visuals,
    animationLibraries,
    clips: {
      idle: text(clipsRaw.idle, 'Idle_Loop'),
      walk: text(clipsRaw.walk, 'Walk_Loop'),
      run: text(clipsRaw.run, 'Sprint_Loop'),
    },
    createdAt: typeof raw.createdAt === 'number' && Number.isFinite(raw.createdAt) ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === 'number' && Number.isFinite(raw.updatedAt) ? raw.updatedAt : now,
  };
}

export function duplicateCharacterPreset(source: CharacterPreset, name = `${source.name} Copy`): CharacterPreset {
  const copy = cloneCharacterPreset(source);
  const now = Date.now();
  copy.id = presetId();
  copy.name = name.trim() || `${source.name} Copy`;
  copy.createdAt = now;
  copy.updatedAt = now;
  return copy;
}

export function touchCharacterPreset(preset: CharacterPreset): void {
  preset.updatedAt = Date.now();
}
