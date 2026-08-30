import { AssetDatabase } from './AssetDatabase';
import { loadStoredAsset } from './AssetLoader';
import { collectExternalGltfUris, inferAssetCategory, normalizedFileKey, sha256Hex, stripExtension } from './assetUtils';
import { inferAssetOrigin } from './officialPacks';
import { renderAssetThumbnail } from './ThumbnailRenderer';
import type { AssetDraft, AssetImportFailure, AssetImportResult, AssetRecord, StoredAssetFile } from './types';

function relativePath(file: File): string {
  return file.webkitRelativePath || file.name;
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

  async importDraft(draft: AssetDraft): Promise<AssetRecord> {
    const entry = draft.files.find((file) =>
      file.relativePath === draft.entryFile || file.name === draft.entryFile,
    );
    if (!entry) throw new Error(`Arquivo principal ${draft.entryFile} não encontrado.`);

    const hash = await sha256Hex(await entry.blob.arrayBuffer());
    const asset: AssetRecord = {
      ...draft,
      id: `user/${hash}`,
      thumbnail: '',
      animations: [],
      createdAt: Date.now(),
    };

    const loaded = await loadStoredAsset(asset);
    asset.animations = loaded.animations.map((clip) => clip.name || 'Unnamed animation');
    asset.thumbnail = renderAssetThumbnail(loaded.scene);
    await this.database.put(asset);
    return asset;
  }

  async importFiles(inputFiles: Iterable<File>): Promise<AssetImportResult> {
    const files = [...inputFiles];
    const lookup = new Map<string, File>();
    for (const file of files) {
      lookup.set(normalizedFileKey(file.name), file);
      lookup.set(normalizedFileKey(relativePath(file)), file);
    }

    const primaries = files.filter((file) => /\.(glb|gltf|fbx)$/i.test(file.name));
    const imported: AssetRecord[] = [];
    const failures: AssetImportFailure[] = [];

    if (primaries.length === 0) {
      return { imported, failures: [{ file: 'seleção', reason: 'Selecione pelo menos um arquivo .glb, .gltf ou .fbx.' }] };
    }

    for (const primary of primaries) {
      try {
        const lower = primary.name.toLowerCase();
        const format = lower.endsWith('.glb') ? 'glb' : lower.endsWith('.gltf') ? 'gltf' : 'fbx';
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
        } else if (format === 'fbx') {
          for (const file of files) {
            if (/\.(png|jpe?g|webp|tga|bmp)$/i.test(file.name) && !related.includes(file)) related.push(file);
          }
        }

        const path = relativePath(primary);
        const origin = inferAssetOrigin(path);
        const asset = await this.importDraft({
          name: stripExtension(primary.name),
          format,
          category: inferAssetCategory(path),
          entryFile: primary.name,
          files: related.map(storeFile),
          source: origin.source,
          license: origin.license,
          sourcePackId: origin.sourcePackId,
        });
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
