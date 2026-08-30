import { describe, expect, it } from 'vitest';
import { averageTerrainHeight, latestHeightStampIndex, sampleTerrainHeight, terrainLayerWeights } from '../src/world/TerrainMath';
import { createHeightStamp, createPaintStamp, createWorldDocument } from '../src/world/WorldDocument';

describe('TerrainMath', () => {
  it('applies additive smooth height stamps', () => {
    const world = createWorldDocument(); world.terrain.heightStamps.push(createHeightStamp({ x: 0, z: 0, radius: 10, delta: 5, falloff: 'smooth', mode: 'add' }));
    expect(sampleTerrainHeight(world, 0, 0)).toBeCloseTo(5); expect(sampleTerrainHeight(world, 20, 0)).toBe(0); expect(sampleTerrainHeight(world, 5, 0)).toBeGreaterThan(0);
  });

  it('supports level stamps for flatten/smooth', () => {
    const world = createWorldDocument(); world.terrain.heightStamps.push(createHeightStamp({ x: 0, z: 0, radius: 10, delta: 5, falloff: 'flat', mode: 'level' })); world.terrain.heightStamps.push(createHeightStamp({ x: 0, z: 0, radius: 3, delta: 2, falloff: 'flat', mode: 'level' }));
    expect(sampleTerrainHeight(world, 0, 0)).toBe(2); expect(averageTerrainHeight(world, 0, 0, 2)).toBeCloseTo(2);
  });

  it('blends paint layers sequentially', () => {
    const world = createWorldDocument(); world.terrain.paintStamps.push(createPaintStamp({ x: 0, z: 0, radius: 10, layer: 1, strength: 1 }));
    const weights = terrainLayerWeights(world, 0, 0); expect(weights[1]).toBeCloseTo(1); expect(weights[0]).toBeCloseTo(0);
  });

  it('erases latest overlapping height edit first', () => {
    const world = createWorldDocument(); world.terrain.heightStamps.push(createHeightStamp({ x: 0, z: 0, radius: 3, delta: 1, falloff: 'smooth', mode: 'add' }), createHeightStamp({ x: 0, z: 0, radius: 2, delta: 2, falloff: 'smooth', mode: 'add' }));
    expect(latestHeightStampIndex(world.terrain.heightStamps, 0, 0)).toBe(1);
  });
});
