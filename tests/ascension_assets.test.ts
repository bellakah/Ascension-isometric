import { describe, expect, it } from 'vitest';
import {
  ASCENSION_ASSET_CATEGORIES,
  ASCENSION_ASSET_ROOT,
  ascensionAssetPath,
  ascensionAssetUrl,
  type AscensionAssetCategory,
} from '../src/ascension/assets';

describe('Ascension asset contract', () => {
  it('builds canonical public URLs for nested assets', () => {
    expect(ASCENSION_ASSET_ROOT).toBe('/ascension');
    expect(ascensionAssetPath('models', 'village/house-a.glb')).toBe(
      '/ascension/models/village/house-a.glb',
    );
    expect(
      ascensionAssetUrl({ category: 'characters', path: 'warrior/body/idle.glb' }),
    ).toBe('/ascension/characters/warrior/body/idle.glb');
  });

  it('keeps every canonical content category addressable', () => {
    for (const category of ASCENSION_ASSET_CATEGORIES) {
      expect(ascensionAssetPath(category, 'example.asset')).toBe(
        `/ascension/${category}/example.asset`,
      );
    }
  });

  it('rejects unsafe or ambiguous relative paths', () => {
    const invalidPaths = [
      '',
      '   ',
      '/absolute.glb',
      '../outside.glb',
      './model.glb',
      'props//barrel.glb',
      'props\\barrel.glb',
      'model.glb?variant=1',
      'model.glb#mesh',
      '%2e%2e/outside.glb',
      'props/%2Foutside.glb',
      'props/%5Coutside.glb',
      'props/%ZZ.glb',
    ];

    for (const path of invalidPaths) {
      expect(() => ascensionAssetPath('models', path)).toThrow();
    }
  });

  it('rejects unknown categories at the runtime boundary', () => {
    expect(() => ascensionAssetPath('legacy' as AscensionAssetCategory, 'model.glb')).toThrow(
      'Unknown Ascension asset category',
    );
  });
});
