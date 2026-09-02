import { describe, expect, it } from 'vitest';
import { capacityRoom, clampToCapacity } from '../src/editor/EditCapacity';

describe('capacityRoom', () => {
  it('reports remaining room without becoming negative', () => {
    expect(capacityRoom(0, 10)).toBe(10);
    expect(capacityRoom(7, 10)).toBe(3);
    expect(capacityRoom(15, 10)).toBe(0);
  });
});

describe('clampToCapacity', () => {
  it('preserves a fitting batch and its reference', () => {
    const items = [1, 2, 3];
    const result = clampToCapacity(items, 4, 10);
    expect(result).toEqual({ accepted: items, truncated: false });
    expect(result.accepted).toBe(items);
  });

  it('accepts only the ordered prefix that fits', () => {
    expect(clampToCapacity([1, 2, 3, 4], 8, 10)).toEqual({
      accepted: [1, 2],
      truncated: true,
    });
  });

  it('rejects a non-empty batch when already at the limit', () => {
    expect(clampToCapacity(['tree'], 10, 10)).toEqual({
      accepted: [],
      truncated: true,
    });
  });
});
