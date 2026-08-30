export interface MovementInput {
  x: number;
  z: number;
}

export function normalizeMovementInput(x: number, z: number): MovementInput {
  const length = Math.hypot(x, z);
  if (length <= 1) return { x, z };
  return { x: x / length, z: z / length };
}
