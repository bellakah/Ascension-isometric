import { describe, expect, it } from 'vitest';
import { isOpenWorldOrbitGesture } from '../src/camera/OpenWorldCamera';

describe('open-world camera orbit input', () => {
  it('uses right mouse drag as the primary orbit gesture', () => {
    expect(isOpenWorldOrbitGesture(2, false)).toBe(true);
  });

  it('keeps middle mouse and Alt+left as orbit alternatives', () => {
    expect(isOpenWorldOrbitGesture(1, false)).toBe(true);
    expect(isOpenWorldOrbitGesture(0, true)).toBe(true);
  });

  it('does not steal a normal left click from combat', () => {
    expect(isOpenWorldOrbitGesture(0, false)).toBe(false);
  });
});
