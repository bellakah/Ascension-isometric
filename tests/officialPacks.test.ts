import { describe, expect, it } from 'vitest';
import { inferAssetOrigin, matchOfficialAssetPack } from '../src/assets/officialPacks';

describe('official asset packs', () => {
  it('recognizes Quaternius packs as the primary art direction', () => {
    const pack = matchOfficialAssetPack('Universal Animation Library 2[Standard](1).zip');
    expect(pack?.id).toBe('quaternius-universal-animation-library-2');
    expect(pack?.artDirection).toBe('primary');
    expect(inferAssetOrigin('Stylized Nature MegaKit[Standard](1).zip').license).toBe('CC0-1.0');
  });

  it('keeps KayKit as a secondary supported source', () => {
    const pack = matchOfficialAssetPack('KayKit_Adventurers_2.0_FREE.zip');
    expect(pack?.id).toBe('kaykit-adventurers');
    expect(pack?.artDirection).toBe('secondary');
  });
});
