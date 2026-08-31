export interface RegionPoint { x: number; z: number; }

export interface RegionBounds {
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
}

export interface ScatterSettings {
  assetIds: string[];
  count: number;
  seed: number;
  minScale: number;
  maxScale: number;
  minSpacing: number;
  randomRotation: boolean;
}

export interface ScatterCandidate {
  assetId: string;
  x: number;
  z: number;
  scale: number;
  rotationY: number;
}

export function regionBounds(a: RegionPoint, b: RegionPoint): RegionBounds {
  return {
    minX: Math.min(a.x, b.x),
    minZ: Math.min(a.z, b.z),
    maxX: Math.max(a.x, b.x),
    maxZ: Math.max(a.z, b.z),
  };
}

export function regionCenter(bounds: RegionBounds): RegionPoint {
  return { x: (bounds.minX + bounds.maxX) * 0.5, z: (bounds.minZ + bounds.maxZ) * 0.5 };
}

export function regionSize(bounds: RegionBounds): { width: number; depth: number } {
  return { width: Math.max(0, bounds.maxX - bounds.minX), depth: Math.max(0, bounds.maxZ - bounds.minZ) };
}

export function pointInRegion(bounds: RegionBounds, x: number, z: number): boolean {
  return x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ;
}

export function makeSeededRng(seed: number): () => number {
  let state = Math.floor(seed) >>> 0;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function scatterCandidates(
  settings: ScatterSettings,
  bounds: RegionBounds,
  reject?: (candidate: ScatterCandidate) => boolean,
): ScatterCandidate[] {
  const assetIds = settings.assetIds.filter(Boolean);
  const count = Math.max(0, Math.min(500, Math.floor(settings.count)));
  if (assetIds.length === 0 || count === 0) return [];

  const rng = makeSeededRng(settings.seed);
  const minScale = Math.max(0.05, Math.min(settings.minScale, settings.maxScale));
  const maxScale = Math.max(minScale, Math.max(settings.minScale, settings.maxScale));
  const spacing = Math.max(0, settings.minSpacing);
  const spanX = Math.max(0, bounds.maxX - bounds.minX);
  const spanZ = Math.max(0, bounds.maxZ - bounds.minZ);
  const out: ScatterCandidate[] = [];
  const maxAttempts = Math.max(64, count * 16);

  for (let attempt = 0; attempt < maxAttempts && out.length < count; attempt += 1) {
    const scale = minScale + rng() * (maxScale - minScale);
    const candidate: ScatterCandidate = {
      assetId: assetIds[Math.min(assetIds.length - 1, Math.floor(rng() * assetIds.length))]!,
      x: bounds.minX + rng() * spanX,
      z: bounds.minZ + rng() * spanZ,
      scale,
      rotationY: settings.randomRotation ? rng() * Math.PI * 2 : 0,
    };
    if (reject?.(candidate)) continue;
    if (spacing > 0 && out.some((previous) => Math.hypot(previous.x - candidate.x, previous.z - candidate.z) < spacing * Math.max(0.35, Math.min(previous.scale, candidate.scale)))) continue;
    out.push(candidate);
  }
  return out;
}
