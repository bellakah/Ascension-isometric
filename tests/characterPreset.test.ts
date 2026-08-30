import { describe, expect, it } from 'vitest';
import {
  cloneCharacterPreset,
  createCharacterPreset,
  createEquipmentAttachment,
  duplicateCharacterPreset,
  parseCharacterPreset,
} from '../src/character/CharacterPreset';

describe('CharacterPreset', () => {
  it('creates a v2 preset with equipment and combat defaults', () => {
    const preset = createCharacterPreset('Hero');
    expect(preset.version).toBe(2);
    expect(preset.name).toBe('Hero');
    expect(preset.baseMode).toBe('full');
    expect(preset.clips.idle).toBe('Idle_Loop');
    expect(preset.combat.profile).toBe('unarmed');
    expect(preset.equipment).toEqual({});
  });

  it('migrates v1 presets without losing modular visuals', () => {
    const parsed = parseCharacterPreset({
      version: 1,
      id: 'hero',
      name: 'Ranger',
      gender: 'female',
      base: { assetId: 'base-f', assetName: 'Superhero_Female_FullBody' },
      baseMode: 'head-only',
      visuals: {
        body: { assetId: 'body', assetName: 'Female_Ranger_Body' },
        arms: { assetId: 'arms', assetName: 'Female_Ranger_Arms' },
      },
      animationLibraries: [{ assetId: 'ual1', assetName: 'UAL1_Standard' }],
      clips: { idle: 'Idle_Loop', walk: 'Walk_Loop', run: 'Sprint_Loop' },
      createdAt: 1,
      updatedAt: 2,
    });
    expect(parsed.version).toBe(2);
    expect(parsed.gender).toBe('female');
    expect(parsed.visuals.body?.assetId).toBe('body');
    expect(parsed.animationLibraries).toHaveLength(1);
    expect(parsed.combat.profile).toBe('unarmed');
  });

  it('parses socket transforms and protects against invalid scale', () => {
    const parsed = parseCharacterPreset({
      version: 2,
      id: 'fighter',
      name: 'Fighter',
      baseMode: 'full',
      visuals: {},
      equipment: {
        mainHand: {
          asset: { assetId: 'sword', assetName: 'Sword' },
          socket: 'hand_r',
          transform: {
            position: { x: 1, y: 2, z: 3 },
            rotationDegrees: { x: 10, y: 20, z: 30 },
            scale: { x: 0, y: -2, z: 3 },
          },
        },
      },
      animationLibraries: [],
      clips: { idle: 'Idle_Loop', walk: 'Walk_Loop', run: 'Sprint_Loop' },
      combat: { profile: 'one-handed', clips: { attack1: 'A', attack2: 'B', attack3: 'C', block: 'D' } },
    });
    expect(parsed.equipment.mainHand?.socket).toBe('hand_r');
    expect(parsed.equipment.mainHand?.transform.scale).toEqual({ x: 0.001, y: 2, z: 3 });
    expect(parsed.combat.profile).toBe('one-handed');
  });

  it('deep clones equipment transforms for editor drafts', () => {
    const preset = createCharacterPreset('Hero');
    preset.equipment.mainHand = createEquipmentAttachment({ assetId: 'sword', assetName: 'Sword' }, 'mainHand');
    const clone = cloneCharacterPreset(preset);
    clone.equipment.mainHand!.transform.position.x = 99;
    expect(preset.equipment.mainHand!.transform.position.x).toBe(0);
  });

  it('duplicates with a new id', () => {
    const preset = createCharacterPreset('Hero');
    const copy = duplicateCharacterPreset(preset);
    expect(copy.id).not.toBe(preset.id);
    expect(copy.name).toContain('Copy');
  });
});
