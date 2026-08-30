import { describe, expect, it } from 'vitest';
import {
  cloneWorldDocument,
  createWorldDocument,
  createWorldEntity,
  parseWorldDocument,
} from '../src/world/WorldDocument';

describe('WorldDocument', () => {
  it('creates serializable asset entities with stable defaults', () => {
    const entity = createWorldEntity({
      id: 'tree-1',
      assetId: 'user/tree',
      assetName: 'CommonTree_1',
      position: { x: 2.5, z: -4 },
    });
    expect(entity.id).toBe('tree-1');
    expect(entity.position).toEqual({ x: 2.5, y: 0, z: -4 });
    expect(entity.rotation).toEqual({ x: 0, y: 0, z: 0 });
    expect(entity.scale).toEqual({ x: 1, y: 1, z: 1 });
    expect(entity.visible).toBe(true);
  });

  it('normalizes imported transforms and protects against zero scale', () => {
    const parsed = parseWorldDocument({
      version: 1,
      name: 'Imported map',
      entities: [{
        id: 'enemy-1',
        name: 'Rat',
        assetId: 'user/rat',
        assetName: 'Rat',
        position: { x: 1, y: 2, z: 3 },
        rotation: { x: 0, y: 1, z: 0 },
        scale: { x: 0, y: -2, z: 3 },
        visible: false,
      }],
      updatedAt: 123,
    });
    expect(parsed.name).toBe('Imported map');
    expect(parsed.entities[0]?.scale).toEqual({ x: 0.001, y: 2, z: 3 });
    expect(parsed.entities[0]?.visible).toBe(false);
  });

  it('rejects duplicate entity ids', () => {
    expect(() => parseWorldDocument({
      version: 1,
      name: 'Broken',
      entities: [
        { id: 'same', assetId: 'a', assetName: 'A' },
        { id: 'same', assetId: 'b', assetName: 'B' },
      ],
    })).toThrow(/duplicado/i);
  });

  it('deep clones entity transforms for undo snapshots', () => {
    const document = createWorldDocument();
    document.entities.push(createWorldEntity({ id: 'one', assetId: 'a', assetName: 'Tree' }));
    const copy = cloneWorldDocument(document);
    copy.entities[0]!.position.x = 99;
    expect(document.entities[0]!.position.x).toBe(0);
  });
});
