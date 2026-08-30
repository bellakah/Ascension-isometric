import { describe, expect, it } from 'vitest';
import { cloneCharacterPreset, createCharacterPreset, duplicateCharacterPreset, parseCharacterPreset } from '../src/character/CharacterPreset';

describe('CharacterPreset', () => {
  it('creates an editable universal character preset', () => {
    const preset = createCharacterPreset('Hero');
    expect(preset.version).toBe(1); expect(preset.name).toBe('Hero'); expect(preset.baseMode).toBe('full'); expect(preset.clips.idle).toBe('Idle_Loop');
  });
  it('parses modular visual slots and animation libraries', () => {
    const parsed = parseCharacterPreset({ version: 1, id: 'hero', name: 'Ranger', gender: 'female', base: { assetId: 'base-f', assetName: 'Superhero_Female_FullBody' }, baseMode: 'head-only', visuals: { body: { assetId: 'body', assetName: 'Female_Ranger_Body' }, arms: { assetId: 'arms', assetName: 'Female_Ranger_Arms' } }, animationLibraries: [{ assetId: 'ual1', assetName: 'UAL1_Standard' }], clips: { idle: 'Idle_Loop', walk: 'Walk_Loop', run: 'Sprint_Loop' }, createdAt: 1, updatedAt: 2 });
    expect(parsed.gender).toBe('female'); expect(parsed.baseMode).toBe('head-only'); expect(parsed.visuals.body?.assetId).toBe('body'); expect(parsed.animationLibraries).toHaveLength(1);
  });
  it('deep clones nested refs for editor drafts', () => {
    const preset = createCharacterPreset('Hero'); preset.base = { assetId: 'base', assetName: 'Base' }; preset.visuals.hair = { assetId: 'hair', assetName: 'Hair' };
    const clone = cloneCharacterPreset(preset); clone.visuals.hair!.assetName = 'Changed'; expect(preset.visuals.hair!.assetName).toBe('Hair');
  });
  it('duplicates with a new id', () => { const preset = createCharacterPreset('Hero'); const copy = duplicateCharacterPreset(preset); expect(copy.id).not.toBe(preset.id); expect(copy.name).toContain('Copy'); });
});
