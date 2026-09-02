export interface CapacityClampResult<T> {
  accepted: readonly T[];
  truncated: boolean;
}

export function capacityRoom(currentCount: number, limit: number): number {
  return Math.max(0, limit - currentCount);
}

export function clampToCapacity<T>(
  items: readonly T[],
  currentCount: number,
  limit: number,
): CapacityClampResult<T> {
  const room = capacityRoom(currentCount, limit);
  if (items.length <= room) return { accepted: items, truncated: false };
  return { accepted: items.slice(0, room), truncated: true };
}
