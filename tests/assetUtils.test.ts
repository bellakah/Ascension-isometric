import { describe, expect, it } from 'vitest';
import {
  assetFileAliases,
  collectExternalGltfUris,
  inferAssetCategory,
  normalizeArchivePath,
  normalizedFileKey,
  resolveArchiveDependency,
  stripExtension,
} from '../src/assets/assetUtils';

describe('assetUtils', () => {
  it('detects categories from KayKit and Quaternius-style paths', () => {
    expect(inferAssetCategory('Assets/gltf/Tree_1_A_Color1.gltf')).toBe('nature');
    expect(inferAssetCategory('Universal Base Characters/Superhero_Male_FullBody.gltf')).toBe('characters');
    expect(inferAssetCategory('Easy Animated Enemy Pack/FBX/Spider.fbx')).toBe('monsters');
    expect(inferAssetCategory('Universal Animation Library 2/UAL2_Standard.glb')).toBe('animations');
    expect(inferAssetCategory('Fantasy Props MegaKit/Exports/glTF/Anvil.gltf')).toBe('props');
  });

  it('collects external GLTF dependencies and ignores embedded data', () => {
    const gltf = JSON.stringify({
      buffers: [{ uri: 'Tree.bin' }],
      images: [{ uri: '../Textures/texture.png' }, { uri: 'data:image/png;base64,abc' }],
    });
    expect(collectExternalGltfUris(gltf)).toEqual(['Tree.bin', '../Textures/texture.png']);
  });

  it('normalizes paths and resolves ZIP-relative dependencies', () => {
    expect(normalizedFileKey('Assets\\gltf\\Tree.bin')).toBe('tree.bin');
    expect(normalizeArchivePath('Assets/gltf/../Textures/Forest.PNG')).toBe('Assets/Textures/Forest.PNG');
    expect(resolveArchiveDependency('Exports/glTF/Anvil.gltf', 'Anvil.bin')).toBe('Exports/glTF/Anvil.bin');
    expect(resolveArchiveDependency('Models/gltf/Hero.gltf', '../Textures/Hero.png')).toBe('Models/Textures/Hero.png');
    expect(stripExtension('Knight.glb')).toBe('Knight');
    expect(assetFileAliases('T_Eye_Normal.png')).toContain('t_eye_normal_png.png');
    expect(assetFileAliases('T_Eye_Normal_png.png')).toContain('t_eye_normal.png');
  });
});
