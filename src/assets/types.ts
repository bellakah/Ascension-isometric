export type AssetFormat = 'glb' | 'gltf';

export type AssetCategory =
  | 'characters'
  | 'nature'
  | 'buildings'
  | 'weapons'
  | 'resources'
  | 'tools'
  | 'monsters'
  | 'props'
  | 'uncategorized';

export interface StoredAssetFile {
  name: string;
  relativePath: string;
  type: string;
  size: number;
  blob: Blob;
}

export interface AssetRecord {
  id: string;
  name: string;
  format: AssetFormat;
  category: AssetCategory;
  entryFile: string;
  files: StoredAssetFile[];
  thumbnail: string;
  animations: string[];
  source: string;
  license: string;
  createdAt: number;
}

export interface AssetImportFailure {
  file: string;
  reason: string;
}

export interface AssetImportResult {
  imported: AssetRecord[];
  failures: AssetImportFailure[];
}
