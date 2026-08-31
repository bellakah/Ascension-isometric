export interface ChasePivotState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  active: boolean;
}

export interface OrbitPose {
  x: number;
  y: number;
  z: number;
}

export const OPEN_WORLD_FOV = 60;
export const OPEN_WORLD_DEFAULT_YAW = Math.PI;
export const OPEN_WORLD_DEFAULT_PITCH = 0.32;
export const OPEN_WORLD_DEFAULT_DISTANCE = 12;
export const OPEN_WORLD_MIN_PITCH = -0.4;
export const OPEN_WORLD_MAX_PITCH = 1.35;
export const OPEN_WORLD_MIN_DISTANCE = 3;
export const OPEN_WORLD_MAX_DISTANCE = 22;

const HORIZONTAL_OMEGA = 12;
const VERTICAL_OMEGA = 6.5;
const HORIZONTAL_LEASH = 1.1;
const VERTICAL_LEASH = 1.6;
const SNAP_DISTANCE = 6;

export function createChasePivot(): ChasePivotState {
  return { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, active: false };
}

function dampAxis(position: number, velocity: number, target: number, omega: number, delta: number): { position: number; velocity: number } {
  const offset = position - target;
  const decay = Math.exp(-omega * delta);
  const impulse = (velocity + omega * offset) * delta;
  return {
    position: target + (offset + impulse) * decay,
    velocity: (velocity - omega * impulse) * decay,
  };
}

export function stepChasePivot(state: ChasePivotState, targetX: number, targetY: number, targetZ: number, delta: number): void {
  const dx = state.x - targetX;
  const dy = state.y - targetY;
  const dz = state.z - targetZ;
  if (!state.active || dx * dx + dy * dy + dz * dz > SNAP_DISTANCE * SNAP_DISTANCE) {
    state.x = targetX; state.y = targetY; state.z = targetZ;
    state.vx = 0; state.vy = 0; state.vz = 0; state.active = true;
    return;
  }

  const dt = Math.min(0.25, Math.max(0, delta));
  const x = dampAxis(state.x, state.vx, targetX, HORIZONTAL_OMEGA, dt);
  const y = dampAxis(state.y, state.vy, targetY, VERTICAL_OMEGA, dt);
  const z = dampAxis(state.z, state.vz, targetZ, HORIZONTAL_OMEGA, dt);
  state.x = x.position; state.vx = x.velocity;
  state.y = y.position; state.vy = y.velocity;
  state.z = z.position; state.vz = z.velocity;

  const trailX = state.x - targetX;
  const trailZ = state.z - targetZ;
  const horizontalTrail = Math.hypot(trailX, trailZ);
  if (horizontalTrail > HORIZONTAL_LEASH) {
    const scale = HORIZONTAL_LEASH / horizontalTrail;
    state.x = targetX + trailX * scale;
    state.z = targetZ + trailZ * scale;
  }
  state.y = Math.max(targetY - VERTICAL_LEASH, Math.min(targetY + VERTICAL_LEASH, state.y));
}

export function orbitPosition(pivotX: number, eyeY: number, pivotZ: number, yaw: number, pitch: number, distance: number): OrbitPose {
  const horizontal = Math.cos(pitch) * distance;
  return {
    x: pivotX - Math.sin(yaw) * horizontal,
    y: eyeY + Math.sin(pitch) * distance,
    z: pivotZ - Math.cos(yaw) * horizontal,
  };
}

export function clampOpenWorldPitch(value: number): number {
  return Math.max(OPEN_WORLD_MIN_PITCH, Math.min(OPEN_WORLD_MAX_PITCH, value));
}

export function clampOpenWorldDistance(value: number): number {
  return Math.max(OPEN_WORLD_MIN_DISTANCE, Math.min(OPEN_WORLD_MAX_DISTANCE, value));
}
