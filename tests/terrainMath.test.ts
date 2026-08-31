import { describe, expect, it } from 'vitest';
import { averageTerrainHeight, dominantTerrainLayerId, latestHeightStampIndex, sampleTerrainHeight, terrainLayerWeights } from '../src/world/TerrainMath';
import { createHeightStamp, createPaintStamp, createTerrainLayer, createWorldDocument } from '../src/world/WorldDocument';

describe('TerrainMath v4', () => {
  it('applies additive smooth height stamps', () => {
    const world = createWorldDocument(); world.terrain.heightStamps.push(createHeightStamp({ x: 0, z: 0, radius: 10, delta: 5, falloff: 'smooth', mode: 'add' }));
    expect(sampleTerrainHeight(world, 0, 0)).toBeCloseTo(5); expect(sampleTerrainHeight(world, 20, 0)).toBe(0); expect(sampleTerrainHeight(world, 5, 0)).toBeGreaterThan(0);
  });

  it('supports level stamps for flatten/smooth', () => {
    const world = createWorldDocument(); world.terrain.heightStamps.push(createHeightStamp({ x: 0, z: 0, radius: 10, delta: 5, falloff: 'flat', mode: 'level' })); world.terrain.heightStamps.push(createHeightStamp({ x: 0, z: 0, radius: 3, delta: 2, falloff: 'flat', mode: 'level' }));
    expect(sampleTerrainHeight(world, 0, 0)).toBe(2); expect(averageTerrainHeight(world, 0, 0, 2)).toBeCloseTo(2);
  });

  it('uses layer ids and reveals underlying masks after erase', () => {
    const world = createWorldDocument(); const grass = world.terrain.layers[0]!; const dirt = world.terrain.layers[1]!;
    world.terrain.paintStamps.push(createPaintStamp({ x: 0, z: 0, radius: 10, layerId: dirt.id, strength: 1, mode: 'paint' }));
    expect(dominantTerrainLayerId(world, 0, 0)).toBe(dirt.id);
    world.terrain.paintStamps.push(createPaintStamp({ x: 0, z: 0, radius: 10, layerId: dirt.id, strength: 1, mode: 'erase' }));
    expect(dominantTerrainLayerId(world, 0, 0)).toBe(grass.id);
  });

  it('supports more than four composited layers', () => {
    const world = createWorldDocument();
    for (let index = 0; index < 5; index += 1) world.terrain.layers.push(createTerrainLayer({ name: `Extra ${index}` }));
    const target = world.terrain.layers[8]!; world.terrain.paintStamps.push(createPaintStamp({ x: 0, z: 0, radius: 10, layerId: target.id, strength: 1, mode: 'paint' }));
    const weights = terrainLayerWeights(world, 0, 0); expect(weights.length).toBe(9); expect(weights[8]).toBeCloseTo(1);
  });

  it('respects solo visibility', () => {
    const world = createWorldDocument(); const dirt = world.terrain.layers[1]!; dirt.fill = 1; dirt.solo = true;
    const weights = terrainLayerWeights(world, 0, 0); expect(weights[1]).toBeCloseTo(1); expect(weights[0]).toBeCloseTo(0);
  });

  it('erases latest overlapping height edit first', () => {
    const world = createWorldDocument(); world.terrain.heightStamps.push(createHeightStamp({ x: 0, z: 0, radius: 3, delta: 1, falloff: 'smooth', mode: 'add' }), createHeightStamp({ x: 0, z: 0, radius: 2, delta: 2, falloff: 'smooth', mode: 'add' }));
    expect(latestHeightStampIndex(world.terrain.heightStamps, 0, 0)).toBe(1);
  });
});
