import { OFFICIAL_ASSET_PACKS } from './officialPacks';
import { AssetDatabase } from './AssetDatabase';
import { loadStoredAsset } from './AssetLoader';
import { collectExternalGltfUris, inferAssetCategory, normalizedFileKey, sha256Hex, stripExtension } from './assetUtils';
import { renderAssetThumbnail } from './ThumbnailRenderer';
import type { AssetImportFailure, AssetImportResult, AssetRecord, StoredAssetFile } from './types';

function relativePath(file: File): string {
  return file.webkitRelativePath || file.name;
}

function inferSource(path: string): { source: string; license: string } {
  const normalized = path.toLowerCase().replace(/[^a-z0-9]+/g, ' ');
  const pack = OFFICIAL_ASSET_PACKS.find((candidate) => {
    const tokens = candidate.name.toLowerCase().split(/\s+/).filter((token) => token.length >= 4);
    return tokens.some((token) => normalized.includes(token));
  });
  if (pack) return { source: `KayKit · ${pack.name}`, license: pack.license };
  if (normalized.includes('kaykit')) return { source: 'KayKit', license: 'CC0-1.0' };
  return { source: 'Importação local', license: 'Licença não informada' };
}

function storeFile(file: File): StoredAssetFile {
  return {
    name: file.name,
    relativePath: relativePath(file),
    type: file.type,
    size: file.size,
    blob: file,
  };
}

export class AssetImporter {
  constructor(private readonly database: AssetDatabase) {}

  async importFiles(inputFiles: Iterable<File>): Promise<AssetImportResult> {
    const files = [...inputFiles];
    const lookup = new Map<string, File>();
    for (const file of files) {
      lookup.set(normalizedFileKey(file.name), file);
      lookup.set(normalizedFileKey(relativePath(file)), file);
    }

    const primaries = files.filter((file) => /\.(glb|gltf)$/i.test(file.name));
    const imported: AssetRecord[] = [];
    const failures: AssetImportFailure[] = [];

    if (primaries.length === 0) {
      return { imported, failures: [{ file: 'seleção', reason: 'Selecione pelo menos um arquivo .glb ou .gltf.' }] };
    }

    for (const primary of primaries) {
      try {
        const format = primary.name.toLowerCase().endsWith('.glb') ? 'glb' : 'gltf';
        const related = [primary];

        if (format === 'gltf') {
          const uris = collectExternalGltfUris(await primary.text());
          const missing: string[] = [];
          for (const uri of uris) {
            const companion = lookup.get(normalizedFileKey(uri));
            if (companion && !related.includes(companion)) related.push(companion);
            else if (!companion) missing.push(uri);
          }
          if (missing.length > 0) {
            throw new Error(`Arquivos relacionados ausentes: ${missing.join(', ')}. Selecione o .gltf junto com .bin e texturas.`);
          }
        }

        const primaryBytes = await primary.arrayBuffer();
        const hash = await sha256Hex(primaryBytes);
        const path = relativePath(primary);
        const source = inferSource(path);
        const asset: AssetRecord = {
          id: `user/${hash}`,
          name: stripExtension(primary.name),
          format,
          category: inferAssetCategory(path),
          entryFile: primary.name,
          files: related.map(storeFile),
          thumbnail: '',
          animations: [],
          source: source.source,
          license: source.license,
          createdAt: Date.now(),
        };

        const loaded = await loadStoredAsset(asset);
        asset.animations = loaded.animations.map((clip) => clip.name || 'Unnamed animation');
        asset.thumbnail = renderAssetThumbnail(loaded.scene);
        await this.database.put(asset);
        imported.push(asset);
      } catch (error) {
        failures.push({
          file: primary.name,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { imported, failures };
  }
}
