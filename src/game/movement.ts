export interface MovementInput {
  x: number;
  z: number;
}

export function normalizeMovementInput(x: number, z: number): MovementInput {
  const length = Math.hypot(x, z);
  if (length <= 1) return { x, z };
  return { x: x / length, z: z / length };
}

export function cameraRelativeMovement(strafe: number, forward: number, yaw: number): MovementInput {
  const local = normalizeMovementInput(strafe, forward);
  return {
    x: local.x * -Math.cos(yaw) + local.z * Math.sin(yaw),
    z: local.x * Math.sin(yaw) + local.z * Math.cos(yaw),
  };
}
