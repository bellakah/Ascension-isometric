import { describe, expect, it } from 'vitest';
import { makeSeededRng, pointInRegion, regionBounds, regionCenter, regionSize, scatterCandidates } from '../src/editor/RegionTools';

describe('RegionTools', () => {
  it('normalizes bounds, center and size', () => {
    const bounds = regionBounds({ x: 10, z: -4 }, { x: -2, z: 8 });
    expect(bounds).toEqual({ minX: -2, minZ: -4, maxX: 10, maxZ: 8 });
    expect(regionCenter(bounds)).toEqual({ x: 4, z: 2 });
    expect(regionSize(bounds)).toEqual({ width: 12, depth: 12 });
    expect(pointInRegion(bounds, 4, 2)).toBe(true);
    expect(pointInRegion(bounds, 20, 2)).toBe(false);
  });

  it('seeded RNG is deterministic', () => {
    const a = makeSeededRng(1234); const b = makeSeededRng(1234);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('scatter is deterministic and respects spacing/rejection', () => {
    const settings = { assetIds: ['tree-a', 'tree-b'], count: 30, seed: 9921, minScale: 0.8, maxScale: 1.2, minSpacing: 2.5, randomRotation: true };
    const bounds = { minX: -20, minZ: -20, maxX: 20, maxZ: 20 };
    const reject = (candidate: { x: number; z: number }): boolean => candidate.x < 0;
    const a = scatterCandidates(settings, bounds, reject); const b = scatterCandidates(settings, bounds, reject);
    expect(a).toEqual(b); expect(a.length).toBeGreaterThan(0); expect(a.every((candidate) => candidate.x >= 0)).toBe(true);
    for (let i = 0; i < a.length; i += 1) for (let j = i + 1; j < a.length; j += 1) {
      const left = a[i]!; const right = a[j]!;
      expect(Math.hypot(left.x - right.x, left.z - right.z)).toBeGreaterThanOrEqual(2.5 * Math.max(0.35, Math.min(left.scale, right.scale)) - 1e-9);
    }
  });
});
