import { describe, expect, it } from 'vitest';
import { calculateOrthographicFrustum, ISOMETRIC_ELEVATION_RADIANS } from '../src/camera/isometricMath';

describe('isometric camera math', () => {
  it('uses the classic isometric elevation', () => {
    expect(ISOMETRIC_ELEVATION_RADIANS * (180 / Math.PI)).toBeCloseTo(35.2643897, 5);
  });

  it('preserves viewport aspect ratio in the orthographic frustum', () => {
    const frustum = calculateOrthographicFrustum(1920, 1080, 20);
    expect(frustum.top).toBe(10);
    expect(frustum.bottom).toBe(-10);
    expect(frustum.right / frustum.top).toBeCloseTo(1920 / 1080, 5);
    expect(frustum.left).toBe(-frustum.right);
  });
});
