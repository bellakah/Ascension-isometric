import type { TerrainHeightStamp, TerrainPaintStamp, WorldDocument } from './WorldDocument';

export interface TerrainRegion { minX: number; minZ: number; maxX: number; maxZ: number; }

export function stampInfluence(distance: number, radius: number, flat = false): number {
  if (radius <= 0 || distance >= radius) return 0;
  if (flat) return 1;
  const t = Math.max(0, Math.min(1, 1 - distance / radius));
  return t * t * (3 - 2 * t);
}

export function sampleTerrainHeight(document: Pick<WorldDocument, 'terrain'>, x: number, z: number): number {
  let height = 0;
  for (const stamp of document.terrain.heightStamps) {
    const distance = Math.hypot(x - stamp.x, z - stamp.z);
    const influence = stampInfluence(distance, stamp.radius, stamp.falloff === 'flat');
    if (influence <= 0) continue;
    if (stamp.mode === 'level') height += (stamp.delta - height) * influence;
    else height += stamp.delta * influence;
  }
  return height;
}

export function averageTerrainHeight(document: Pick<WorldDocument, 'terrain'>, x: number, z: number, radius: number): number {
  const h = Math.max(0.25, radius * 0.5);
  const points = [[x, z], [x + h, z], [x - h, z], [x, z + h], [x, z - h]] as const;
  let total = 0;
  for (const [px, pz] of points) total += sampleTerrainHeight(document, px, pz);
  return total / points.length;
}

export function terrainLayerWeights(document: Pick<WorldDocument, 'terrain'>, x: number, z: number): [number, number, number, number] {
  const weights: [number, number, number, number] = [1, 0, 0, 0];
  for (const stamp of document.terrain.paintStamps) {
    const influence = stampInfluence(Math.hypot(x - stamp.x, z - stamp.z), stamp.radius) * stamp.strength;
    if (influence <= 0) continue;
    for (let index = 0; index < 4; index += 1) weights[index] *= 1 - influence;
    weights[Math.max(0, Math.min(3, stamp.layer))] += influence;
    const total = weights[0] + weights[1] + weights[2] + weights[3];
    if (total > 0) for (let index = 0; index < 4; index += 1) weights[index] /= total;
  }
  return weights;
}

export function stampRegion(stamp: Pick<TerrainHeightStamp | TerrainPaintStamp, 'x' | 'z' | 'radius'>): TerrainRegion {
  return { minX: stamp.x - stamp.radius, minZ: stamp.z - stamp.radius, maxX: stamp.x + stamp.radius, maxZ: stamp.z + stamp.radius };
}

export function unionTerrainRegion(a: TerrainRegion | null, b: TerrainRegion): TerrainRegion {
  if (!a) return { ...b };
  return { minX: Math.min(a.minX, b.minX), minZ: Math.min(a.minZ, b.minZ), maxX: Math.max(a.maxX, b.maxX), maxZ: Math.max(a.maxZ, b.maxZ) };
}

export function pointInStamp(stamp: Pick<TerrainHeightStamp | TerrainPaintStamp, 'x' | 'z' | 'radius'>, x: number, z: number): boolean {
  const dx = x - stamp.x; const dz = z - stamp.z;
  return dx * dx + dz * dz <= stamp.radius * stamp.radius;
}

export function latestHeightStampIndex(stamps: readonly TerrainHeightStamp[], x: number, z: number): number {
  for (let index = stamps.length - 1; index >= 0; index -= 1) if (pointInStamp(stamps[index]!, x, z)) return index;
  return -1;
}

export function latestPaintStampIndex(stamps: readonly TerrainPaintStamp[], x: number, z: number): number {
  for (let index = stamps.length - 1; index >= 0; index -= 1) if (pointInStamp(stamps[index]!, x, z)) return index;
  return -1;
}
