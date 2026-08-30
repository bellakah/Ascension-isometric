import { describe, expect, it } from 'vitest';
import {
  cloneWorldDocument,
  createWorldDocument,
  createWorldEntity,
  duplicateWorldDocument,
  parseWorldDocument,
} from '../src/world/WorldDocument';

describe('WorldDocument v2', () => {
  it('creates map metadata and stable entity defaults', () => {
    const world = createWorldDocument('Village');
    expect(world.version).toBe(2);
    expect(world.name).toBe('Village');
    expect(world.spawn).toEqual({ x: 0, y: 0, z: 0 });
    expect(world.environment.groundSize).toBe(100);
    const entity = createWorldEntity({ id: 'tree-1', assetId: 'user/tree', assetName: 'Tree', position: { x: 2.5, z: -4 } });
    expect(entity.position).toEqual({ x: 2.5, y: 0, z: -4 });
  });

  it('migrates v1 documents into v2 without losing entities', () => {
    const parsed = parseWorldDocument({
      version: 1,
      name: 'Legacy',
      entities: [{ id: 'rat', assetId: 'user/rat', assetName: 'Rat', scale: { x: 0, y: -2, z: 3 } }],
      updatedAt: 123,
    });
    expect(parsed.version).toBe(2);
    expect(parsed.id).toMatch(/^legacy-/);
    expect(parsed.entities[0]?.scale).toEqual({ x: 0.001, y: 2, z: 3 });
  });

  it('normalizes environment values and colors', () => {
    const parsed = parseWorldDocument({
      version: 2,
      id: 'world-a',
      name: 'A',
      entities: [],
      environment: { groundSize: 5000, groundColor: 'invalid', backgroundColor: '#ABCDEF' },
      spawn: { x: 1, y: 2, z: 3 },
      createdAt: 1,
      updatedAt: 2,
    });
    expect(parsed.environment.groundSize).toBe(1000);
    expect(parsed.environment.groundColor).toBe('#71955f');
    expect(parsed.environment.backgroundColor).toBe('#abcdef');
    expect(parsed.spawn).toEqual({ x: 1, y: 2, z: 3 });
  });

  it('duplicates a map with a new map id and entity ids', () => {
    const world = createWorldDocument('Forest');
    world.entities.push(createWorldEntity({ id: 'one', assetId: 'a', assetName: 'Tree' }));
    const copy = duplicateWorldDocument(world);
    expect(copy.id).not.toBe(world.id);
    expect(copy.entities[0]?.id).not.toBe('one');
    expect(copy.entities[0]?.assetId).toBe('a');
  });

  it('deep clones map metadata and transforms', () => {
    const world = createWorldDocument();
    world.entities.push(createWorldEntity({ id: 'one', assetId: 'a', assetName: 'Tree' }));
    const copy = cloneWorldDocument(world);
    copy.spawn.x = 50;
    copy.environment.groundSize = 20;
    copy.entities[0]!.position.x = 99;
    expect(world.spawn.x).toBe(0);
    expect(world.environment.groundSize).toBe(100);
    expect(world.entities[0]!.position.x).toBe(0);
  });

  it('rejects duplicate entity ids', () => {
    expect(() => parseWorldDocument({
      version: 2,
      id: 'broken',
      name: 'Broken',
      entities: [{ id: 'same', assetId: 'a', assetName: 'A' }, { id: 'same', assetId: 'b', assetName: 'B' }],
    })).toThrow(/duplicado/i);
  });
});
