import { describe, expect, it } from 'vitest';
import { choosePreferredModelPaths } from '../src/assets/ZipAssetScanner';

describe('choosePreferredModelPaths', () => {
  it('hides lower priority duplicate exports', () => {
    const chosen = choosePreferredModelPaths([
      'Exports/FBX/Anvil.fbx',
      'Exports/OBJ/Anvil.obj',
      'Exports/glTF/Anvil.gltf',
      'Exports/FBX/Barrel.fbx',
    ]);
    expect(chosen).toEqual([
      'Exports/FBX/Barrel.fbx',
      'Exports/glTF/Anvil.gltf',
    ]);
  });

  it('keeps multiple preferred-format variants with the same filename stem', () => {
    const chosen = choosePreferredModelPaths([
      'Origin at 0/glTF/Hair_Buns.gltf',
      'Rigged to Head Bone/glTF/Hair_Buns.gltf',
      'Origin at 0/FBX/Hair_Buns.fbx',
    ]);
    expect(chosen).toEqual([
      'Origin at 0/glTF/Hair_Buns.gltf',
      'Rigged to Head Bone/glTF/Hair_Buns.gltf',
    ]);
  });

  it('prefers GLB when available', () => {
    expect(choosePreferredModelPaths([
      'Animations/UAL1_Standard.fbx',
      'Animations/UAL1_Standard.glb',
    ])).toEqual(['Animations/UAL1_Standard.glb']);
  });
});
