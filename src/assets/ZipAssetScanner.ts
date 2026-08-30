import { unzip } from 'fflate';
import { archiveDirname, assetFileAliases, collectExternalGltfUris, inferAssetCategory, normalizeArchivePath, normalizedFileKey, resolveArchiveDependency, stripExtension } from './assetUtils';
import { inferAssetOrigin, matchOfficialAssetPack } from './officialPacks';
import type { AssetCategory, AssetDraft, AssetFormat, StoredAssetFile } from './types';

const FORMAT_PRIORITY: Record<AssetFormat, number> = {
  glb: 0,
  gltf: 1,
  fbx: 2,
};

const IMAGE_PATTERN = /\.(png|jpe?g|webp|tga|bmp)$/i;

export interface ZipAssetCandidate {
  id: string;
  path: string;
  draft: AssetDraft;
}

export interface ZipScanResult {
  archiveName: string;
  totalFiles: number;
  candidates: ZipAssetCandidate[];
  hiddenDuplicateFormats: number;
  unsupportedModels: number;
  source: string;
  license: string;
}

interface ArchiveEntry {
  path: string;
  bytes: Uint8Array;
}

function unzipAsync(bytes: Uint8Array): Promise<Record<string, Uint8Array>> {
  return new Promise((resolve, reject) => {
    unzip(bytes, (error, data) => {
      if (error) reject(error);
      else resolve(data);
    });
  });
}

function mimeType(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith('.gltf')) return 'model/gltf+json';
  if (lower.endsWith('.glb')) return 'model/gltf-binary';
  if (lower.endsWith('.fbx')) return 'application/octet-stream';
  if (lower.endsWith('.bin')) return 'application/octet-stream';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'application/octet-stream';
}

function asStoredFile(entry: ArchiveEntry): StoredAssetFile {
  const parts = entry.path.split('/');
  const name = parts[parts.length - 1] ?? entry.path;
  const payload = entry.bytes.slice().buffer;
  const blob = new Blob([payload], { type: mimeType(entry.path) });
  return {
    name,
    relativePath: entry.path,
    type: blob.type,
    size: blob.size,
    blob,
  };
}

function modelFormat(path: string): AssetFormat | null {
  const lower = path.toLowerCase();
  if (lower.endsWith('.glb')) return 'glb';
  if (lower.endsWith('.gltf')) return 'gltf';
  if (lower.endsWith('.fbx')) return 'fbx';
  return null;
}

function basenameStem(path: string): string {
  const normalized = normalizeArchivePath(path);
  const name = normalized.split('/').pop() ?? normalized;
  return stripExtension(name).toLowerCase();
}

export function choosePreferredModelPaths(paths: readonly string[]): string[] {
  const supported = paths
    .map((path) => ({ path, format: modelFormat(path) }))
    .filter((entry): entry is { path: string; format: AssetFormat } => entry.format !== null);

  const byStem = new Map<string, Array<{ path: string; format: AssetFormat }>>();
  for (const entry of supported) {
    const stem = basenameStem(entry.path);
    const group = byStem.get(stem) ?? [];
    group.push(entry);
    byStem.set(stem, group);
  }

  const chosen: string[] = [];
  for (const group of byStem.values()) {
    const bestRank = Math.min(...group.map((entry) => FORMAT_PRIORITY[entry.format]));
    for (const entry of group) {
      if (FORMAT_PRIORITY[entry.format] === bestRank) chosen.push(entry.path);
    }
  }
  return chosen.sort((a, b) => a.localeCompare(b));
}

function findEntry(
  path: string,
  entriesByPath: Map<string, ArchiveEntry>,
  entriesByName: Map<string, ArchiveEntry[]>,
): ArchiveEntry | undefined {
  const normalizedPath = normalizeArchivePath(path);
  const exact = entriesByPath.get(normalizedPath.toLowerCase());
  if (exact) return exact;

  const directory = archiveDirname(normalizedPath);
  for (const alias of assetFileAliases(path)) {
    const sibling = entriesByPath.get(normalizeArchivePath(directory ? `${directory}/${alias}` : alias).toLowerCase());
    if (sibling) return sibling;
  }

  for (const alias of assetFileAliases(path)) {
    const matches = entriesByName.get(alias);
    if (matches?.length === 1) return matches[0];
  }
  return undefined;
}

function packCategoryFallback(archiveName: string): AssetCategory | undefined {
  const pack = matchOfficialAssetPack(archiveName);
  if (!pack) return undefined;
  switch (pack.category) {
    case 'environment': return 'nature';
    case 'characters': return 'characters';
    case 'monsters': return 'monsters';
    case 'animations': return 'animations';
    case 'buildings': return 'buildings';
    case 'weapons': return 'weapons';
    case 'resources': return 'resources';
    case 'tools': return 'tools';
    case 'props': return 'props';
  }
}

async function buildDraft(
  archiveName: string,
  entry: ArchiveEntry,
  entriesByPath: Map<string, ArchiveEntry>,
  entriesByName: Map<string, ArchiveEntry[]>,
  allImages: ArchiveEntry[],
): Promise<AssetDraft> {
  const format = modelFormat(entry.path);
  if (!format) throw new Error(`Formato não suportado: ${entry.path}`);

  const related: ArchiveEntry[] = [entry];
  if (format === 'gltf') {
    const text = new TextDecoder().decode(entry.bytes);
    for (const uri of collectExternalGltfUris(text)) {
      const dependencyPath = resolveArchiveDependency(entry.path, uri);
      const dependency = findEntry(dependencyPath, entriesByPath, entriesByName);
      if (!dependency) throw new Error(`Dependência ausente no ZIP: ${uri}`);
      if (!related.includes(dependency)) related.push(dependency);
    }
  } else if (format === 'fbx') {
    for (const image of allImages) {
      if (!related.includes(image)) related.push(image);
    }
  }

  const origin = inferAssetOrigin(`${archiveName}/${entry.path}`);
  const inferred = inferAssetCategory(`${archiveName}/${entry.path}`);
  const category = inferred === 'uncategorized'
    ? (packCategoryFallback(archiveName) ?? inferred)
    : inferred;

  return {
    name: stripExtension(entry.path.split('/').pop() ?? entry.path),
    format,
    category,
    entryFile: entry.path,
    files: related.map(asStoredFile),
    source: origin.source,
    license: origin.license,
    sourcePackId: origin.sourcePackId,
    sourceArchive: archiveName,
  };
}

export async function scanAssetZip(file: File): Promise<ZipScanResult> {
  const archive = await unzipAsync(new Uint8Array(await file.arrayBuffer()));
  const entries: ArchiveEntry[] = Object.entries(archive)
    .filter(([path]) => path && !path.endsWith('/') && !path.includes('__MACOSX/'))
    .map(([path, bytes]) => ({ path: normalizeArchivePath(path), bytes }));

  const entriesByPath = new Map(entries.map((entry) => [entry.path.toLowerCase(), entry]));
  const entriesByName = new Map<string, ArchiveEntry[]>();
  for (const entry of entries) {
    for (const key of assetFileAliases(entry.path)) {
      const list = entriesByName.get(key) ?? [];
      list.push(entry);
      entriesByName.set(key, list);
    }
  }

  const allModelPaths = entries
    .filter((entry) => /\.(glb|gltf|fbx|obj)$/i.test(entry.path))
    .map((entry) => entry.path);
  const preferredPaths = choosePreferredModelPaths(allModelPaths);
  const preferredSet = new Set(preferredPaths.map((path) => path.toLowerCase()));
  const hiddenDuplicateFormats = entries.filter((entry) =>
    /\.(glb|gltf|fbx)$/i.test(entry.path) && !preferredSet.has(entry.path.toLowerCase()),
  ).length;
  const unsupportedModels = entries.filter((entry) => /\.obj$/i.test(entry.path)).length;
  const allImages = entries.filter((entry) => IMAGE_PATTERN.test(entry.path));

  const candidates: ZipAssetCandidate[] = [];
  for (const path of preferredPaths) {
    const entry = entriesByPath.get(path.toLowerCase());
    if (!entry) continue;
    try {
      const draft = await buildDraft(file.name, entry, entriesByPath, entriesByName, allImages);
      candidates.push({
        id: `${file.name}:${entry.path}`,
        path: entry.path,
        draft,
      });
    } catch {
      // Invalid candidates are intentionally excluded from the selectable catalog.
      // The scanner still reports the archive-level counts to help diagnose odd packs.
    }
  }

  const origin = inferAssetOrigin(file.name);
  return {
    archiveName: file.name,
    totalFiles: entries.length,
    candidates,
    hiddenDuplicateFormats,
    unsupportedModels,
    source: origin.source,
    license: origin.license,
  };
}
