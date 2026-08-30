export const ISOMETRIC_ELEVATION_RADIANS = Math.atan(1 / Math.sqrt(2));

export interface OrthographicFrustum {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export function calculateOrthographicFrustum(
  width: number,
  height: number,
  viewHeight: number,
): OrthographicFrustum {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const halfHeight = Math.max(1, viewHeight) / 2;
  const halfWidth = halfHeight * (safeWidth / safeHeight);

  return {
    left: -halfWidth,
    right: halfWidth,
    top: halfHeight,
    bottom: -halfHeight,
  };
}
