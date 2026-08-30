import type { AssetRecord } from '../assets/types';
import type { CharacterVisualSlot } from './CharacterPreset';

export type CharacterAssetRole = 'base' | 'hair' | 'outfit' | 'body' | 'arms' | 'legs' | 'feet' | 'headgear' | 'accessory' | 'animation' | 'other';

const BASE_PACK = 'quaternius-universal-base-characters';
const OUTFIT_PACK = 'quaternius-modular-character-outfits-fantasy';
const UAL1 = 'quaternius-universal-animation-library';
const UAL2 = 'quaternius-universal-animation-library-2';

function sourceText(asset: AssetRecord): string {
  return `${asset.name} ${asset.entryFile} ${asset.sourceArchive ?? ''}`.toLowerCase();
}

export function inferCharacterAssetRole(asset: AssetRecord): CharacterAssetRole {
  const text = sourceText(asset);
  if (asset.sourcePackId === UAL1 || asset.sourcePackId === UAL2 || asset.category === 'animations') return 'animation';
  if (asset.sourcePackId === BASE_PACK) {
    if (/fullbody/i.test(text)) return 'base';
    if (/hair_|hairstyle|eyebrow/i.test(text)) return 'hair';
  }
  if (asset.sourcePackId === OUTFIT_PACK || /modular character outfits/i.test(text)) {
    if (/\/outfits\//i.test(asset.entryFile.replace(/\\/g, '/'))) return 'outfit';
    if (/_body\b/i.test(text)) return 'body';
    if (/_arms\b/i.test(text)) return 'arms';
    if (/_legs\b/i.test(text)) return 'legs';
    if (/_feet(?:_|\b)/i.test(text)) return 'feet';
    if (/_head(?:_|\b)|hood/i.test(text)) return 'headgear';
    if (/_acc(?:_|\b)|pauldron/i.test(text)) return 'accessory';
  }
  return 'other';
}

export function characterAssetGender(asset: AssetRecord): 'male' | 'female' | 'unspecified' {
  const text = sourceText(asset);
  if (/female/i.test(text)) return 'female';
  if (/male/i.test(text)) return 'male';
  return 'unspecified';
}

export function roleToVisualSlot(role: CharacterAssetRole): CharacterVisualSlot | null {
  switch (role) {
    case 'hair':
    case 'outfit':
    case 'body':
    case 'arms':
    case 'legs':
    case 'feet':
    case 'headgear':
    case 'accessory': return role;
    default: return null;
  }
}

export function isRootMotionAsset(asset: AssetRecord): boolean {
  return /(?:^|[_\s-])rm(?:[_\s.-]|$)/i.test(`${asset.name} ${asset.entryFile}`);
}

export function isRiggedHairAsset(asset: AssetRecord): boolean {
  return inferCharacterAssetRole(asset) === 'hair' && /rigged to head bone/i.test(asset.entryFile);
}
