import { describe, expect, it } from 'vitest';
import { cloneWorldDocument, createHeightStamp, createWorldDocument, createWorldEntity, duplicateWorldDocument, parseWorldDocument } from '../src/world/WorldDocument';

describe('WorldDocument v3', () => {
  it('creates terrain, water and grounded entity defaults', () => {
    const world = createWorldDocument('Village');
    expect(world.version).toBe(3); expect(world.terrain.layers).toHaveLength(4); expect(world.terrain.resolution).toBe(64); expect(world.water.enabled).toBe(false);
    const entity = createWorldEntity({ id: 'tree-1', assetId: 'user/tree', assetName: 'Tree', position: { x: 2.5, z: -4 } });
    expect(entity.position).toEqual({ x: 2.5, y: 0, z: -4 }); expect(entity.grounded).toBe(true); expect(entity.collision.mode).toBe('none');
  });

  it('migrates v1/v2 documents without losing entities', () => {
    const parsed = parseWorldDocument({ version: 2, id: 'legacy', name: 'Legacy', entities: [{ id: 'rat', assetId: 'user/rat', assetName: 'Rat', scale: { x: 0, y: -2, z: 3 } }], environment: { groundColor: '#445566' }, updatedAt: 123 });
    expect(parsed.version).toBe(3); expect(parsed.entities[0]?.scale).toEqual({ x: 0.001, y: 2, z: 3 }); expect(parsed.entities[0]?.grounded).toBe(false); expect(parsed.terrain.layers[0]?.fallbackColor).toBe('#445566');
  });

  it('normalizes terrain stamps, layers and environment', () => {
    const parsed = parseWorldDocument({ version: 3, id: 'world-a', name: 'A', entities: [], environment: { groundSize: 5000, groundColor: 'invalid', backgroundColor: '#ABCDEF' }, terrain: { resolution: 500, heightStamps: [{ id: 'h', x: 1, z: 2, radius: -4, delta: 999, mode: 'level', falloff: 'flat' }], paintStamps: [{ id: 'p', x: 0, z: 0, radius: 3, layer: 99, strength: 4 }], layers: [] }, spawn: { x: 1, y: 2, z: 3 }, createdAt: 1, updatedAt: 2 });
    expect(parsed.environment.groundSize).toBe(1000); expect(parsed.environment.backgroundColor).toBe('#abcdef'); expect(parsed.terrain.resolution).toBe(192); expect(parsed.terrain.heightStamps[0]?.radius).toBe(0.25); expect(parsed.terrain.heightStamps[0]?.delta).toBe(200); expect(parsed.terrain.paintStamps[0]?.layer).toBe(3); expect(parsed.terrain.paintStamps[0]?.strength).toBe(1);
  });

  it('deep clones terrain/world structures', () => {
    const world = createWorldDocument(); world.terrain.heightStamps.push(createHeightStamp({ x: 0, z: 0, radius: 5, delta: 2, falloff: 'smooth', mode: 'add' })); world.entities.push(createWorldEntity({ id: 'one', assetId: 'a', assetName: 'Tree' }));
    const copy = cloneWorldDocument(world); copy.terrain.heightStamps[0]!.delta = 99; copy.terrain.layers[0]!.name = 'Changed'; copy.entities[0]!.position.x = 99;
    expect(world.terrain.heightStamps[0]!.delta).toBe(2); expect(world.terrain.layers[0]!.name).toBe('Grass'); expect(world.entities[0]!.position.x).toBe(0);
  });

  it('duplicates ids for map content', () => {
    const world = createWorldDocument('Forest'); world.entities.push(createWorldEntity({ id: 'one', assetId: 'a', assetName: 'Tree' })); world.terrain.heightStamps.push(createHeightStamp({ x: 0, z: 0, radius: 2, delta: 1, falloff: 'smooth', mode: 'add' }));
    const copy = duplicateWorldDocument(world); expect(copy.id).not.toBe(world.id); expect(copy.entities[0]?.id).not.toBe('one'); expect(copy.terrain.heightStamps[0]?.id).not.toBe(world.terrain.heightStamps[0]?.id);
  });

  it('rejects duplicate entity ids', () => {
    expect(() => parseWorldDocument({ version: 3, id: 'broken', name: 'Broken', entities: [{ id: 'same', assetId: 'a', assetName: 'A' }, { id: 'same', assetId: 'b', assetName: 'B' }] })).toThrow(/duplicado/i);
  });
});
