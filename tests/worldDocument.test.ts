import { describe, expect, it } from 'vitest';
import { MAX_TERRAIN_HEIGHT_STAMPS, MAX_WORLD_ENTITIES, cloneWorldDocument, createHeightStamp, createTerrainLayer, createWorldDocument, createWorldEntity, duplicateWorldDocument, parseWorldDocument } from '../src/world/WorldDocument';

describe('WorldDocument v4', () => {
  it('creates dynamic terrain layers, water and grounded entity defaults', () => {
    const world = createWorldDocument('Village');
    expect(world.version).toBe(4); expect(world.terrain.layers).toHaveLength(4); expect(world.terrain.layers[0]?.fill).toBe(1); expect(world.terrain.resolution).toBe(64); expect(world.water.enabled).toBe(false);
    const entity = createWorldEntity({ id: 'tree-1', assetId: 'user/tree', assetName: 'Tree', position: { x: 2.5, z: -4 } });
    expect(entity.position).toEqual({ x: 2.5, y: 0, z: -4 }); expect(entity.grounded).toBe(true); expect(entity.collision.mode).toBe('none');
  });

  it('migrates v3 numeric paint indices to stable layer ids', () => {
    const parsed = parseWorldDocument({ version: 3, id: 'legacy-v3', name: 'Legacy', entities: [], terrain: { resolution: 64, layers: [{ id: 'grass', name: 'Grass', fallbackColor: '#112233', tileScale: 10 }, { id: 'dirt', name: 'Dirt', fallbackColor: '#445566', tileScale: 10 }], paintStamps: [{ id: 'p', x: 0, z: 0, radius: 4, layer: 1, strength: 1 }] }, updatedAt: 123 });
    expect(parsed.version).toBe(4); expect(parsed.terrain.paintStamps[0]?.layerId).toBe('dirt'); expect(parsed.terrain.paintStamps[0]?.mode).toBe('paint');
  });

  it('migrates v1/v2 documents without losing entities', () => {
    const parsed = parseWorldDocument({ version: 2, id: 'legacy', name: 'Legacy', entities: [{ id: 'rat', assetId: 'user/rat', assetName: 'Rat', scale: { x: 0, y: -2, z: 3 } }], environment: { groundColor: '#445566' }, updatedAt: 123 });
    expect(parsed.version).toBe(4); expect(parsed.entities[0]?.scale).toEqual({ x: 0.001, y: 2, z: 3 }); expect(parsed.entities[0]?.grounded).toBe(false); expect(parsed.terrain.layers[0]?.fallbackColor).toBe('#445566');
  });

  it('normalizes dynamic layer settings', () => {
    const parsed = parseWorldDocument({ version: 4, id: 'world-a', name: 'A', entities: [], environment: { groundSize: 5000, groundColor: 'invalid', backgroundColor: '#ABCDEF' }, terrain: { resolution: 500, layers: [{ id: 'one', name: 'One', fallbackColor: '#123456', tint: '#ffffff', tileScale: 999, opacity: 3, fill: -2 }], heightStamps: [], paintStamps: [] }, createdAt: 1, updatedAt: 2 });
    expect(parsed.environment.groundSize).toBe(1000); expect(parsed.environment.backgroundColor).toBe('#abcdef'); expect(parsed.terrain.resolution).toBe(192); expect(parsed.terrain.layers[0]?.tileScale).toBe(100); expect(parsed.terrain.layers[0]?.opacity).toBe(1); expect(parsed.terrain.layers[0]?.fill).toBe(0);
  });

  it('deep clones terrain/world structures', () => {
    const world = createWorldDocument(); world.terrain.layers.push(createTerrainLayer({ name: 'Mud' })); world.terrain.heightStamps.push(createHeightStamp({ x: 0, z: 0, radius: 5, delta: 2, falloff: 'smooth', mode: 'add' })); world.entities.push(createWorldEntity({ id: 'one', assetId: 'a', assetName: 'Tree' }));
    const copy = cloneWorldDocument(world); copy.terrain.heightStamps[0]!.delta = 99; copy.terrain.layers[0]!.name = 'Changed'; copy.entities[0]!.position.x = 99;
    expect(world.terrain.heightStamps[0]!.delta).toBe(2); expect(world.terrain.layers[0]!.name).toBe('Grass'); expect(world.entities[0]!.position.x).toBe(0);
  });

  it('duplicates ids for map content while preserving internal layer references', () => {
    const world = createWorldDocument('Forest'); world.entities.push(createWorldEntity({ id: 'one', assetId: 'a', assetName: 'Tree' })); world.terrain.heightStamps.push(createHeightStamp({ x: 0, z: 0, radius: 2, delta: 1, falloff: 'smooth', mode: 'add' }));
    const layerId = world.terrain.layers[0]!.id; const copy = duplicateWorldDocument(world); expect(copy.id).not.toBe(world.id); expect(copy.entities[0]?.id).not.toBe('one'); expect(copy.terrain.heightStamps[0]?.id).not.toBe(world.terrain.heightStamps[0]?.id); expect(copy.terrain.layers[0]?.id).toBe(layerId);
  });

  it('rejects duplicate entity ids', () => {
    expect(() => parseWorldDocument({ version: 4, id: 'broken', name: 'Broken', entities: [{ id: 'same', assetId: 'a', assetName: 'A' }, { id: 'same', assetId: 'b', assetName: 'B' }] })).toThrow(/duplicado/i);
  });

  it('bounds imported documents to the same limits enforced by live editing', () => {
    const entities = Array.from({ length: MAX_WORLD_ENTITIES + 1 }, (_, index) => ({ id: `entity-${index}`, assetId: 'tree', assetName: 'Tree' }));
    const heightStamps = Array.from({ length: MAX_TERRAIN_HEIGHT_STAMPS + 1 }, (_, index) => ({ id: `height-${index}`, x: index, z: 0, radius: 2, delta: 1, falloff: 'smooth', mode: 'add' }));
    const parsed = parseWorldDocument({ version: 4, id: 'bounded', name: 'Bounded', entities, terrain: { heightStamps } });
    expect(parsed.entities).toHaveLength(MAX_WORLD_ENTITIES);
    expect(parsed.terrain.heightStamps).toHaveLength(MAX_TERRAIN_HEIGHT_STAMPS);
  });
});
