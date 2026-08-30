import { describe, expect, it } from 'vitest';
import { normalizeMovementInput } from '../src/game/movement';

describe('movement input', () => {
  it('keeps cardinal movement unchanged', () => {
    expect(normalizeMovementInput(1, 0)).toEqual({ x: 1, z: 0 });
  });

  it('normalizes diagonal movement to prevent a speed boost', () => {
    const movement = normalizeMovementInput(1, 1);
    expect(Math.hypot(movement.x, movement.z)).toBeCloseTo(1, 8);
  });
});
