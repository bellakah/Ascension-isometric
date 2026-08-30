export const CHARACTER_PRESET_VERSION = 2 as const;
export const LEGACY_CHARACTER_PRESET_VERSION = 1 as const;

export type CharacterGender = 'male' | 'female' | 'unspecified';
export type CharacterBaseMode = 'full' | 'head-only';
export type CharacterVisualSlot = 'hair' | 'outfit' | 'body' | 'arms' | 'legs' | 'feet' | 'headgear' | 'accessory';
export type CharacterEquipmentSlot = 'mainHand' | 'offHand' | 'back';
export type CharacterWeaponProfile = 'unarmed' | 'one-handed' | 'two-handed' | 'bow' | 'staff';

export interface CharacterAssetRef {
  assetId: string;
  assetName: string;
}

export interface CharacterVector3 {
  x: number;
  y: number;
  z: number;
}

export interface CharacterAnimationClips {
  idle: string;
  walk: string;
  run: string;
}

export interface CharacterCombatClips {
  attack1: string;
  attack2: string;
  attack3: string;
  block: string;
}

export interface CharacterSocketTransform {
  position: CharacterVector3;
  rotationDegrees: CharacterVector3;
  scale: CharacterVector3;
}

export interface CharacterEquipmentAttachment {
  asset: CharacterAssetRef;
  socket: string;
  transform: CharacterSocketTransform;
}

export interface CharacterCombatConfig {
  profile: CharacterWeaponProfile;
  clips: CharacterCombatClips;
}

export interface CharacterPreset {
  version: typeof CHARACTER_PRESET_VERSION;
  id: string;
  name: string;
  gender: CharacterGender;
  base?: CharacterAssetRef;
  baseMode: CharacterBaseMode;
  visuals: Partial<Record<CharacterVisualSlot, CharacterAssetRef>>;
  equipment: Partial<Record<CharacterEquipmentSlot, CharacterEquipmentAttachment>>;
  animationLibraries: CharacterAssetRef[];
  clips: CharacterAnimationClips;
  combat: CharacterCombatConfig;
  createdAt: number;
  updatedAt: number;
}

const EQUIPMENT_SOCKETS: Record<CharacterEquipmentSlot, string> = {
  mainHand: 'hand_r',
  offHand: 'hand_l',
  back: 'spine_03',
};

function presetId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `character-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function text(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function vector(value: unknown, fallback: CharacterVector3): CharacterVector3 {
  if (!value || typeof value !== 'object') return { ...fallback };
  const candidate = value as Partial<CharacterVector3>;
  return {
    x: finite(candidate.x, fallback.x),
    y: finite(candidate.y, fallback.y),
    z: finite(candidate.z, fallback.z),
  };
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

function weaponProfile(value: unknown): CharacterWeaponProfile {
  return value === 'one-handed' || value === 'two-handed' || value === 'bow' || value === 'staff' || value === 'unarmed'
    ? value
    : 'unarmed';
}

export function defaultEquipmentSocket(slot: CharacterEquipmentSlot): string {
  return EQUIPMENT_SOCKETS[slot];
}

export function createEquipmentAttachment(asset: CharacterAssetRef, slot: CharacterEquipmentSlot): CharacterEquipmentAttachment {
  return {
    asset: { ...asset },
    socket: defaultEquipmentSocket(slot),
    transform: {
      position: { x: 0, y: 0, z: 0 },
      rotationDegrees: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    },
  };
}

function equipmentAttachment(value: unknown, slot: CharacterEquipmentSlot): CharacterEquipmentAttachment | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Partial<CharacterEquipmentAttachment>;
  const asset = assetRef(raw.asset);
  if (!asset) return undefined;
  const transformRaw = raw.transform && typeof raw.transform === 'object' ? raw.transform as Partial<CharacterSocketTransform> : {};
  const scale = vector(transformRaw.scale, { x: 1, y: 1, z: 1 });
  scale.x = Math.max(0.001, Math.abs(scale.x));
  scale.y = Math.max(0.001, Math.abs(scale.y));
  scale.z = Math.max(0.001, Math.abs(scale.z));
  return {
    asset,
    socket: text(raw.socket, defaultEquipmentSocket(slot)),
    transform: {
      position: vector(transformRaw.position, { x: 0, y: 0, z: 0 }),
      rotationDegrees: vector(transformRaw.rotationDegrees, { x: 0, y: 0, z: 0 }),
      scale,
    },
  };
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
    equipment: {},
    animationLibraries: [],
    clips: { idle: 'Idle_Loop', walk: 'Walk_Loop', run: 'Sprint_Loop' },
    combat: {
      profile: 'unarmed',
      clips: { attack1: 'Punch_Jab', attack2: 'Punch_Cross', attack3: 'Melee_Hook', block: 'Sword_Block' },
    },
    createdAt: now,
    updatedAt: now,
  };
}

export function cloneCharacterPreset(preset: CharacterPreset): CharacterPreset {
  const equipment: CharacterPreset['equipment'] = {};
  for (const slot of ['mainHand', 'offHand', 'back'] as const) {
    const item = preset.equipment[slot];
    if (!item) continue;
    equipment[slot] = {
      asset: { ...item.asset },
      socket: item.socket,
      transform: {
        position: { ...item.transform.position },
        rotationDegrees: { ...item.transform.rotationDegrees },
        scale: { ...item.transform.scale },
      },
    };
  }
  return {
    ...preset,
    base: preset.base ? { ...preset.base } : undefined,
    visuals: Object.fromEntries(Object.entries(preset.visuals).map(([slot, ref]) => [slot, ref ? { ...ref } : ref])) as CharacterPreset['visuals'],
    equipment,
    animationLibraries: preset.animationLibraries.map((ref) => ({ ...ref })),
    clips: { ...preset.clips },
    combat: { profile: preset.combat.profile, clips: { ...preset.combat.clips } },
  };
}

export function parseCharacterPreset(value: unknown): CharacterPreset {
  if (!value || typeof value !== 'object') throw new Error('CharacterPreset inválido.');
  const raw = value as Partial<CharacterPreset> & { version?: number; combat?: unknown; equipment?: unknown };
  if (raw.version !== CHARACTER_PRESET_VERSION && raw.version !== LEGACY_CHARACTER_PRESET_VERSION) {
    throw new Error(`Versão de CharacterPreset não suportada: ${String(raw.version)}.`);
  }

  const now = Date.now();
  const visualsRaw = raw.visuals && typeof raw.visuals === 'object' ? raw.visuals as Partial<Record<CharacterVisualSlot, unknown>> : {};
  const visuals: CharacterPreset['visuals'] = {};
  for (const slot of ['hair', 'outfit', 'body', 'arms', 'legs', 'feet', 'headgear', 'accessory'] as const) {
    const ref = assetRef(visualsRaw[slot]);
    if (ref) visuals[slot] = ref;
  }

  const equipmentRaw = raw.equipment && typeof raw.equipment === 'object'
    ? raw.equipment as Partial<Record<CharacterEquipmentSlot, unknown>>
    : {};
  const equipment: CharacterPreset['equipment'] = {};
  for (const slot of ['mainHand', 'offHand', 'back'] as const) {
    const attachment = equipmentAttachment(equipmentRaw[slot], slot);
    if (attachment) equipment[slot] = attachment;
  }

  const animationLibraries = Array.isArray(raw.animationLibraries)
    ? raw.animationLibraries.map(assetRef).filter((ref): ref is CharacterAssetRef => Boolean(ref))
    : [];
  const clipsRaw = raw.clips && typeof raw.clips === 'object' ? raw.clips as Partial<CharacterAnimationClips> : {};
  const combatRaw = raw.combat && typeof raw.combat === 'object' ? raw.combat as Partial<CharacterCombatConfig> : {};
  const combatClipsRaw = combatRaw.clips && typeof combatRaw.clips === 'object' ? combatRaw.clips as Partial<CharacterCombatClips> : {};

  return {
    version: CHARACTER_PRESET_VERSION,
    id: text(raw.id, presetId()),
    name: text(raw.name, 'Personagem'),
    gender: gender(raw.gender),
    base: assetRef(raw.base),
    baseMode: baseMode(raw.baseMode),
    visuals,
    equipment,
    animationLibraries,
    clips: {
      idle: text(clipsRaw.idle, 'Idle_Loop'),
      walk: text(clipsRaw.walk, 'Walk_Loop'),
      run: text(clipsRaw.run, 'Sprint_Loop'),
    },
    combat: {
      profile: weaponProfile(combatRaw.profile),
      clips: {
        attack1: text(combatClipsRaw.attack1, 'Punch_Jab'),
        attack2: text(combatClipsRaw.attack2, 'Punch_Cross'),
        attack3: text(combatClipsRaw.attack3, 'Melee_Hook'),
        block: text(combatClipsRaw.block, 'Sword_Block'),
      },
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
