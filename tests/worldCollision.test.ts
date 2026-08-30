import { describe, expect, it } from 'vitest';
import { entityCollisionRadius, isPositionBlocked, pointSegmentDistance, resolveHorizontalMove } from '../src/world/WorldCollision';
import { createBlocker, createWorldDocument, createWorldEntity } from '../src/world/WorldDocument';

describe('WorldCollision', () => {
  it('derives automatic radius from XZ scale', () => {
    const entity = createWorldEntity({ assetId: 'tree', assetName: 'Tree' }); entity.collision = { mode: 'auto' }; entity.scale = { x: 2, y: 8, z: 3 };
    expect(entityCollisionRadius(entity)).toBeCloseTo(1.95);
  });

  it('blocks colliding placements and blocker segments', () => {
    const world = createWorldDocument(); const tree = createWorldEntity({ assetId: 'tree', assetName: 'Tree', position: { x: 2, z: 2 } }); tree.collision = { mode: 'radius', radius: 1 }; world.entities.push(tree); world.blockers.push(createBlocker({ x1: -2, z1: 0, x2: 2, z2: 0 }));
    expect(isPositionBlocked(world, 2.2, 2)).toBe(true); expect(isPositionBlocked(world, 0, 0.2)).toBe(true); expect(isPositionBlocked(world, -10, -10)).toBe(false);
  });

  it('slides along one axis when diagonal movement is blocked', () => {
    const world = createWorldDocument(); const tree = createWorldEntity({ assetId: 'tree', assetName: 'Tree', position: { x: 1, z: 1 } }); tree.collision = { mode: 'radius', radius: 0.7 }; world.entities.push(tree);
    const move = resolveHorizontalMove(world, 0, 0, 0.8, 0.8, 0.2); expect(move.x === 0 || move.z === 0).toBe(true);
  });

  it('computes distance to blocker segments', () => { expect(pointSegmentDistance(1, 1, 0, 0, 2, 0)).toBeCloseTo(1); });
});
