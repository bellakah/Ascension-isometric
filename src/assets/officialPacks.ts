import type { AssetFormat } from './types';

export type AssetPackCategory = 'environment' | 'resources' | 'tools' | 'weapons' | 'buildings' | 'monsters' | 'animations' | 'characters' | 'props';

export interface OfficialAssetPack {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly archiveName: string;
  readonly category: AssetPackCategory;
  readonly author: 'Kay Lousberg' | 'Quaternius';
  readonly license: 'CC0-1.0';
  readonly preferredRuntimeFormats: readonly AssetFormat[];
  readonly matchers: readonly string[];
  readonly artDirection: 'primary' | 'secondary';
}

export const OFFICIAL_ASSET_PACKS: readonly OfficialAssetPack[] = [
  {
    id: 'quaternius-universal-base-characters', name: 'Universal Base Characters', version: 'Standard', archiveName: 'Universal Base Characters[Standard].zip', category: 'characters', author: 'Quaternius', license: 'CC0-1.0', preferredRuntimeFormats: ['gltf', 'fbx'], matchers: ['universal base characters'], artDirection: 'primary',
  },
  {
    id: 'quaternius-modular-character-outfits-fantasy', name: 'Modular Character Outfits - Fantasy', version: 'Standard', archiveName: 'Modular Character Outfits - Fantasy[Standard].zip', category: 'characters', author: 'Quaternius', license: 'CC0-1.0', preferredRuntimeFormats: ['gltf', 'fbx'], matchers: ['modular character outfits fantasy', 'modular character outfits'], artDirection: 'primary',
  },
  {
    id: 'quaternius-universal-animation-library-2', name: 'Universal Animation Library 2', version: 'Standard', archiveName: 'Universal Animation Library 2[Standard].zip', category: 'animations', author: 'Quaternius', license: 'CC0-1.0', preferredRuntimeFormats: ['glb', 'fbx'], matchers: ['universal animation library 2'], artDirection: 'primary',
  },
  {
    id: 'quaternius-fantasy-props-megakit', name: 'Fantasy Props MegaKit', version: 'Standard', archiveName: 'Fantasy Props MegaKit[Standard].zip', category: 'props', author: 'Quaternius', license: 'CC0-1.0', preferredRuntimeFormats: ['gltf', 'fbx'], matchers: ['fantasy props megakit'], artDirection: 'primary',
  },
  {
    id: 'quaternius-easy-enemy', name: 'Easy Enemy Pack', version: 'January 2019', archiveName: 'Easy Animated Enemy Pack - Jan 2019.zip', category: 'monsters', author: 'Quaternius', license: 'CC0-1.0', preferredRuntimeFormats: ['fbx'], matchers: ['easy animated enemy', 'easy enemy pack'], artDirection: 'primary',
  },
  {
    id: 'quaternius-stylized-nature-megakit', name: 'Stylized Nature MegaKit', version: 'Standard', archiveName: 'Stylized Nature MegaKit[Standard].zip', category: 'environment', author: 'Quaternius', license: 'CC0-1.0', preferredRuntimeFormats: ['gltf', 'fbx'], matchers: ['stylized nature megakit'], artDirection: 'primary',
  },
  {
    id: 'quaternius-universal-animation-library', name: 'Universal Animation Library', version: 'Standard', archiveName: 'Universal Animation Library[Standard].zip', category: 'animations', author: 'Quaternius', license: 'CC0-1.0', preferredRuntimeFormats: ['glb', 'fbx'], matchers: ['universal animation library'], artDirection: 'primary',
  },
  {
    id: 'kaykit-forest-nature', name: 'KayKit Forest Nature Pack', version: '1.0', archiveName: 'KayKit_Forest_Nature_Pack_1.0_FREE.zip', category: 'environment', author: 'Kay Lousberg', license: 'CC0-1.0', preferredRuntimeFormats: ['gltf'], matchers: ['kaykit forest nature', 'forest nature pack'], artDirection: 'secondary',
  },
  {
    id: 'kaykit-resource-bits', name: 'KayKit Resource Bits', version: '1.0', archiveName: 'KayKit_ResourceBits_1.0_FREE.zip', category: 'resources', author: 'Kay Lousberg', license: 'CC0-1.0', preferredRuntimeFormats: ['gltf'], matchers: ['kaykit resourcebits', 'kaykit resource bits'], artDirection: 'secondary',
  },
  {
    id: 'kaykit-rpg-tools-bits', name: 'KayKit RPG Tools Bits', version: '1.0', archiveName: 'KayKit_RPGToolsBits_1.0_FREE.zip', category: 'tools', author: 'Kay Lousberg', license: 'CC0-1.0', preferredRuntimeFormats: ['gltf'], matchers: ['kaykit rpgtoolsbits', 'kaykit rpg tools'], artDirection: 'secondary',
  },
  {
    id: 'kaykit-fantasy-weapons-bits', name: 'KayKit Fantasy Weapons Bits', version: '1.0', archiveName: 'KayKit_FantasyWeaponsBits_1.0_FREE.zip', category: 'weapons', author: 'Kay Lousberg', license: 'CC0-1.0', preferredRuntimeFormats: ['gltf'], matchers: ['kaykit fantasyweaponsbits', 'kaykit fantasy weapons'], artDirection: 'secondary',
  },
  {
    id: 'kaykit-medieval-hexagon', name: 'KayKit Medieval Hexagon Pack', version: '1.0', archiveName: 'KayKit_Medieval_Hexagon_Pack_1.0_FREE.zip', category: 'buildings', author: 'Kay Lousberg', license: 'CC0-1.0', preferredRuntimeFormats: ['gltf'], matchers: ['kaykit medieval hexagon'], artDirection: 'secondary',
  },
  {
    id: 'kaykit-skeletons', name: 'KayKit Character Pack: Skeletons', version: '1.1', archiveName: 'KayKit_Skeletons_1.1_FREE.zip', category: 'monsters', author: 'Kay Lousberg', license: 'CC0-1.0', preferredRuntimeFormats: ['glb', 'gltf'], matchers: ['kaykit skeletons', 'character pack skeletons'], artDirection: 'secondary',
  },
  {
    id: 'kaykit-character-animations', name: 'KayKit Character Animations', version: '1.1', archiveName: 'KayKit_Character_Animations_1.1.zip', category: 'animations', author: 'Kay Lousberg', license: 'CC0-1.0', preferredRuntimeFormats: ['glb'], matchers: ['kaykit character animations'], artDirection: 'secondary',
  },
  {
    id: 'kaykit-adventurers', name: 'KayKit Adventurers Character Pack', version: '2.0', archiveName: 'KayKit_Adventurers_2.0_FREE.zip', category: 'characters', author: 'Kay Lousberg', license: 'CC0-1.0', preferredRuntimeFormats: ['glb', 'gltf'], matchers: ['kaykit adventurers', 'adventurers character pack'], artDirection: 'secondary',
  },
] as const;

function normalized(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function matchOfficialAssetPack(value: string): OfficialAssetPack | undefined {
  const haystack = normalized(value);
  return OFFICIAL_ASSET_PACKS.find((pack) => pack.matchers.some((matcher) => haystack.includes(normalized(matcher))));
}

export function inferAssetOrigin(value: string): { source: string; license: string; sourcePackId?: string } {
  const pack = matchOfficialAssetPack(value);
  if (pack) return { source: `${pack.author} · ${pack.name}`, license: pack.license, sourcePackId: pack.id };
  const haystack = normalized(value);
  if (haystack.includes('quaternius')) return { source: 'Quaternius', license: 'CC0-1.0' };
  if (haystack.includes('kaykit')) return { source: 'KayKit', license: 'CC0-1.0' };
  return { source: 'Importação local', license: 'Licença não informada' };
}
