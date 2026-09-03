export const ASCENSION_ASSET_ROOT = '/ascension' as const;

export const ASCENSION_ASSET_CATEGORIES = [
  'characters',
  'animations',
  'models',
  'textures',
  'audio',
  'maps',
  'ui',
  'vfx',
  'data',
] as const;

export type AscensionAssetCategory = (typeof ASCENSION_ASSET_CATEGORIES)[number];

export type AscensionAssetRef = Readonly<{
  category: AscensionAssetCategory;
  path: string;
}>;

export function isAscensionAssetCategory(category: string): category is AscensionAssetCategory {
  return (ASCENSION_ASSET_CATEGORIES as readonly string[]).includes(category);
}

function assertSafeRelativePath(relativePath: string): void {
  if (relativePath.trim().length === 0) {
    throw new Error('Ascension asset path must not be empty.');
  }
  if (relativePath.startsWith('/') || relativePath.includes('\\')) {
    throw new Error(`Ascension asset path must be relative and use forward slashes: ${relativePath}`);
  }
  if (relativePath.includes('?') || relativePath.includes('#')) {
    throw new Error(`Ascension asset path must not contain a query or hash: ${relativePath}`);
  }

  const segments = relativePath.split('/');
  for (const segment of segments) {
    if (segment.length === 0 || segment === '.' || segment === '..') {
      throw new Error(`Ascension asset path contains an unsafe segment: ${relativePath}`);
    }

    let decoded: string;
    try {
      decoded = decodeURIComponent(segment);
    } catch {
      throw new Error(`Ascension asset path contains malformed percent encoding: ${relativePath}`);
    }

    if (decoded === '.' || decoded === '..' || decoded.includes('/') || decoded.includes('\\')) {
      throw new Error(`Ascension asset path contains an encoded unsafe segment: ${relativePath}`);
    }
  }
}

export function ascensionAssetPath(
  category: AscensionAssetCategory,
  relativePath: string,
): string {
  if (!isAscensionAssetCategory(category)) {
    throw new Error(`Unknown Ascension asset category: ${category}`);
  }
  assertSafeRelativePath(relativePath);
  return `${ASCENSION_ASSET_ROOT}/${category}/${relativePath}`;
}

export function ascensionAssetUrl(ref: AscensionAssetRef): string {
  return ascensionAssetPath(ref.category, ref.path);
}
