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
    const influence = stampInfluence(Math.hypot(x - stamp.x, z - stamp.z), stamp.radius, stamp.falloff === 'flat');
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

function clamp01(value: number): number { return Math.max(0, Math.min(1, value)); }

export function terrainLayerWeights(document: Pick<WorldDocument, 'terrain'>, x: number, z: number): number[] {
  const layers = document.terrain.layers;
  const masks = layers.map((layer) => clamp01(layer.fill));
  const indexById = new Map(layers.map((layer, index) => [layer.id, index] as const));
  for (const stamp of document.terrain.paintStamps) {
    const index = indexById.get(stamp.layerId); if (index === undefined) continue;
    const influence = stampInfluence(Math.hypot(x - stamp.x, z - stamp.z), stamp.radius) * stamp.strength;
    if (influence <= 0) continue;
    if (stamp.mode === 'erase') masks[index] = clamp01(masks[index]! - influence);
    else masks[index] = clamp01(masks[index]! + influence * (1 - masks[index]!));
  }

  const solo = layers.findIndex((layer) => layer.solo && layer.visible);
  const weights = layers.map(() => 0);
  for (let index = 0; index < layers.length; index += 1) {
    const layer = layers[index]!;
    if (!layer.visible || (solo >= 0 && index !== solo)) continue;
    const alpha = clamp01(masks[index]! * layer.opacity);
    if (alpha <= 0) continue;
    for (let previous = 0; previous < index; previous += 1) weights[previous] *= 1 - alpha;
    weights[index] += alpha;
  }

  let total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0.0001) {
    const fallback = solo >= 0 ? solo : Math.max(0, layers.findIndex((layer) => layer.visible));
    if (weights[fallback] !== undefined) weights[fallback] = 1;
    total = 1;
  }
  if (total > 1.0001) for (let index = 0; index < weights.length; index += 1) weights[index] /= total;
  return weights;
}

export function dominantTerrainLayerId(document: Pick<WorldDocument, 'terrain'>, x: number, z: number): string | null {
  const weights = terrainLayerWeights(document, x, z);
  let best = -1; let bestWeight = -1;
  for (let index = 0; index < weights.length; index += 1) if (weights[index]! > bestWeight) { best = index; bestWeight = weights[index]!; }
  return document.terrain.layers[best]?.id ?? null;
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

export function latestPaintStampIndex(stamps: readonly TerrainPaintStamp[], x: number, z: number, layerId?: string): number {
  for (let index = stamps.length - 1; index >= 0; index -= 1) {
    const stamp = stamps[index]!;
    if ((!layerId || stamp.layerId === layerId) && pointInStamp(stamp, x, z)) return index;
  }
  return -1;
}
