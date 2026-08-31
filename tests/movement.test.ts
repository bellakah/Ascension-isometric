import { describe, expect, it } from 'vitest';
import { cameraRelativeMovement, normalizeMovementInput } from '../src/game/movement';

describe('movement input', () => {
  it('keeps cardinal movement unchanged', () => {
    expect(normalizeMovementInput(1, 0)).toEqual({ x: 1, z: 0 });
  });

  it('normalizes diagonal movement to prevent a speed boost', () => {
    const movement = normalizeMovementInput(1, 1);
    expect(Math.hypot(movement.x, movement.z)).toBeCloseTo(1, 8);
  });

  it('keeps the old world orientation at the default chase yaw', () => {
    const forward = cameraRelativeMovement(0, 1, Math.PI);
    const right = cameraRelativeMovement(1, 0, Math.PI);
    expect(forward.x).toBeCloseTo(0, 8); expect(forward.z).toBeCloseTo(-1, 8);
    expect(right.x).toBeCloseTo(1, 8); expect(right.z).toBeCloseTo(0, 8);
  });

  it('rotates WASD movement with the camera yaw', () => {
    const forward = cameraRelativeMovement(0, 1, Math.PI / 2);
    expect(forward.x).toBeCloseTo(1, 8); expect(forward.z).toBeCloseTo(0, 8);
  });
});
