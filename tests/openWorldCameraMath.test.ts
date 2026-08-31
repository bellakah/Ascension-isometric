import { describe, expect, it } from 'vitest';
import {
  OPEN_WORLD_DEFAULT_DISTANCE,
  OPEN_WORLD_DEFAULT_PITCH,
  OPEN_WORLD_DEFAULT_YAW,
  clampOpenWorldDistance,
  clampOpenWorldPitch,
  createChasePivot,
  orbitPosition,
  stepChasePivot,
} from '../src/camera/openWorldCameraMath';

describe('open-world camera math', () => {
  it('matches the intended default third-person orbit', () => {
    const pose = orbitPosition(0, 1.8, 0, OPEN_WORLD_DEFAULT_YAW, OPEN_WORLD_DEFAULT_PITCH, OPEN_WORLD_DEFAULT_DISTANCE);
    expect(pose.x).toBeCloseTo(0, 8);
    expect(pose.y).toBeGreaterThan(1.8);
    expect(pose.z).toBeGreaterThan(0);
  });

  it('clamps pitch and zoom to the open-world camera envelope', () => {
    expect(clampOpenWorldPitch(-99)).toBeCloseTo(-0.4);
    expect(clampOpenWorldPitch(99)).toBeCloseTo(1.35);
    expect(clampOpenWorldDistance(-10)).toBe(3);
    expect(clampOpenWorldDistance(99)).toBe(22);
  });

  it('snaps on first target and trails subsequent movement without overshoot', () => {
    const state = createChasePivot();
    stepChasePivot(state, 0, 0, 0, 1 / 60);
    expect(state).toMatchObject({ x: 0, y: 0, z: 0, active: true });
    stepChasePivot(state, 1, 0, 0, 1 / 60);
    expect(state.x).toBeGreaterThan(0);
    expect(state.x).toBeLessThan(1);
  });

  it('snaps instead of dragging the camera across a teleport', () => {
    const state = createChasePivot();
    stepChasePivot(state, 0, 0, 0, 1 / 60);
    stepChasePivot(state, 20, 5, -10, 1 / 60);
    expect(state.x).toBe(20); expect(state.y).toBe(5); expect(state.z).toBe(-10);
  });
});
