import { describe, expect, it } from 'vitest';
import { collectExternalGltfUris, inferAssetCategory, normalizedFileKey, stripExtension } from '../src/assets/assetUtils';

describe('assetUtils', () => {
  it('detects categories from KayKit-style paths', () => {
    expect(inferAssetCategory('Assets/gltf/Tree_1_A_Color1.gltf')).toBe('nature');
    expect(inferAssetCategory('Characters/gltf/Knight.glb')).toBe('characters');
    expect(inferAssetCategory('assets/gltf/Skeleton_Staff.gltf')).toBe('monsters');
    expect(inferAssetCategory('buildings/blue/building_tavern_blue.gltf')).toBe('buildings');
  });

  it('collects external GLTF dependencies and ignores embedded data', () => {
    const gltf = JSON.stringify({
      buffers: [{ uri: 'Tree.bin' }],
      images: [{ uri: 'texture.png' }, { uri: 'data:image/png;base64,abc' }],
    });
    expect(collectExternalGltfUris(gltf)).toEqual(['Tree.bin', 'texture.png']);
  });

  it('normalizes paths for companion file lookup', () => {
    expect(normalizedFileKey('Assets\\gltf\\Tree.bin')).toBe('tree.bin');
    expect(normalizedFileKey('./Textures/Forest.PNG')).toBe('forest.png');
    expect(stripExtension('Knight.glb')).toBe('Knight');
  });
});
