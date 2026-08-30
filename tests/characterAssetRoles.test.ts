import { describe, expect, it } from 'vitest';
import type { AssetRecord } from '../src/assets/types';
import { inferCharacterAssetRole, isRiggedHairAsset, isRootMotionAsset } from '../src/character/characterAssetRoles';

function asset(overrides: Partial<AssetRecord>): AssetRecord {
  return { id: 'asset', name: 'Asset', format: 'gltf', category: 'characters', entryFile: 'Asset.gltf', files: [], source: 'Quaternius', license: 'CC0-1.0', thumbnail: '', animations: [], createdAt: 1, ...overrides };
}

describe('character asset roles', () => {
  it('detects complete outfits and modular slots', () => {
    expect(inferCharacterAssetRole(asset({ sourcePackId: 'quaternius-modular-character-outfits-fantasy', entryFile: 'Exports/glTF (Godot-Unreal)/Outfits/Female_Ranger.gltf', name: 'Female_Ranger' }))).toBe('outfit');
    expect(inferCharacterAssetRole(asset({ sourcePackId: 'quaternius-modular-character-outfits-fantasy', entryFile: 'Exports/glTF (Godot-Unreal)/Modular Parts/Male_Peasant_Arms.gltf', name: 'Male_Peasant_Arms' }))).toBe('arms');
  });

  it('classifies weapon and shield assets for equipment sockets', () => {
    expect(inferCharacterAssetRole(asset({ category: 'weapons', name: 'Long Sword', entryFile: 'LongSword.gltf' }))).toBe('weapon');
    expect(inferCharacterAssetRole(asset({ category: 'weapons', name: 'Knight Shield', entryFile: 'KnightShield.gltf' }))).toBe('shield');
  });

  it('prefers rigged hairstyle variants', () => {
    expect(isRiggedHairAsset(asset({ sourcePackId: 'quaternius-universal-base-characters', entryFile: 'Hairstyles/Rigged to Head Bone/glTF/Hair_Long.gltf', name: 'Hair_Long' }))).toBe(true);
  });

  it('recognizes root motion animation exports', () => {
    expect(isRootMotionAsset(asset({ category: 'animations', name: 'UAL1_Standard_RM', entryFile: 'UAL1_Standard_RM.glb' }))).toBe(true);
  });
});
