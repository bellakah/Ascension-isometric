import type { WorldDocument, WorldEntityDocument } from './WorldDocument';

export function automaticCollisionRadius(entity: WorldEntityDocument): number {
  const scale = Math.max(entity.scale.x, entity.scale.z);
  return Math.max(0.35, Math.min(8, 0.65 * scale));
}

export function entityCollisionRadius(entity: WorldEntityDocument): number {
  if (entity.collision.mode === 'none') return 0;
  if (entity.collision.mode === 'radius') return Math.max(0.1, entity.collision.radius ?? 1);
  return automaticCollisionRadius(entity);
}

export function pointSegmentDistance(x: number, z: number, x1: number, z1: number, x2: number, z2: number): number {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const length2 = dx * dx + dz * dz;
  if (length2 <= 1e-8) return Math.hypot(x - x1, z - z1);
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (z - z1) * dz) / length2));
  return Math.hypot(x - (x1 + dx * t), z - (z1 + dz * t));
}

export function isPositionBlocked(document: WorldDocument, x: number, z: number, radius = 0.45): boolean {
  const half = document.environment.groundSize / 2;
  if (x < -half + radius || x > half - radius || z < -half + radius || z > half - radius) return true;
  for (const entity of document.entities) {
    if (!entity.visible) continue;
    const entityRadius = entityCollisionRadius(entity);
    if (entityRadius > 0 && Math.hypot(x - entity.position.x, z - entity.position.z) < entityRadius + radius) return true;
  }
  for (const wall of document.blockers) {
    if (pointSegmentDistance(x, z, wall.x1, wall.z1, wall.x2, wall.z2) < radius + 0.12) return true;
  }
  return false;
}

export function resolveHorizontalMove(document: WorldDocument, fromX: number, fromZ: number, toX: number, toZ: number, radius = 0.45): { x: number; z: number } {
  if (!isPositionBlocked(document, toX, toZ, radius)) return { x: toX, z: toZ };
  if (!isPositionBlocked(document, toX, fromZ, radius)) return { x: toX, z: fromZ };
  if (!isPositionBlocked(document, fromX, toZ, radius)) return { x: fromX, z: toZ };
  return { x: fromX, z: fromZ };
}
