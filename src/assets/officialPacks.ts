export type AssetPackCategory =
  | 'environment'
  | 'resources'
  | 'tools'
  | 'weapons'
  | 'buildings'
  | 'monsters'
  | 'animations'
  | 'characters';

export interface OfficialAssetPack {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly archiveName: string;
  readonly category: AssetPackCategory;
  readonly author: 'Kay Lousberg';
  readonly license: 'CC0-1.0';
  readonly preferredRuntimeFormats: readonly ('glb' | 'gltf')[];
}

export const OFFICIAL_ASSET_PACKS: readonly OfficialAssetPack[] = [
  {
    id: 'kaykit-forest-nature',
    name: 'KayKit Forest Nature Pack',
    version: '1.0',
    archiveName: 'KayKit_Forest_Nature_Pack_1.0_FREE.zip',
    category: 'environment',
    author: 'Kay Lousberg',
    license: 'CC0-1.0',
    preferredRuntimeFormats: ['gltf'],
  },
  {
    id: 'kaykit-resource-bits',
    name: 'KayKit Resource Bits',
    version: '1.0',
    archiveName: 'KayKit_ResourceBits_1.0_FREE.zip',
    category: 'resources',
    author: 'Kay Lousberg',
    license: 'CC0-1.0',
    preferredRuntimeFormats: ['gltf'],
  },
  {
    id: 'kaykit-rpg-tools-bits',
    name: 'KayKit RPG Tools Bits',
    version: '1.0',
    archiveName: 'KayKit_RPGToolsBits_1.0_FREE.zip',
    category: 'tools',
    author: 'Kay Lousberg',
    license: 'CC0-1.0',
    preferredRuntimeFormats: ['gltf'],
  },
  {
    id: 'kaykit-fantasy-weapons-bits',
    name: 'KayKit Fantasy Weapons Bits',
    version: '1.0',
    archiveName: 'KayKit_FantasyWeaponsBits_1.0_FREE.zip',
    category: 'weapons',
    author: 'Kay Lousberg',
    license: 'CC0-1.0',
    preferredRuntimeFormats: ['gltf'],
  },
  {
    id: 'kaykit-medieval-hexagon',
    name: 'KayKit Medieval Hexagon Pack',
    version: '1.0',
    archiveName: 'KayKit_Medieval_Hexagon_Pack_1.0_FREE.zip',
    category: 'buildings',
    author: 'Kay Lousberg',
    license: 'CC0-1.0',
    preferredRuntimeFormats: ['gltf'],
  },
  {
    id: 'kaykit-skeletons',
    name: 'KayKit Character Pack: Skeletons',
    version: '1.1',
    archiveName: 'KayKit_Skeletons_1.1_FREE.zip',
    category: 'monsters',
    author: 'Kay Lousberg',
    license: 'CC0-1.0',
    preferredRuntimeFormats: ['glb', 'gltf'],
  },
  {
    id: 'kaykit-character-animations',
    name: 'KayKit Character Animations',
    version: '1.1',
    archiveName: 'KayKit_Character_Animations_1.1.zip',
    category: 'animations',
    author: 'Kay Lousberg',
    license: 'CC0-1.0',
    preferredRuntimeFormats: ['glb'],
  },
  {
    id: 'kaykit-adventurers',
    name: 'KayKit Adventurers Character Pack',
    version: '2.0',
    archiveName: 'KayKit_Adventurers_2.0_FREE.zip',
    category: 'characters',
    author: 'Kay Lousberg',
    license: 'CC0-1.0',
    preferredRuntimeFormats: ['glb', 'gltf'],
  },
] as const;
