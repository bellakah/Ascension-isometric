export type AssetFormat = 'glb' | 'gltf' | 'fbx';

export type AssetCategory =
  | 'characters'
  | 'nature'
  | 'buildings'
  | 'weapons'
  | 'resources'
  | 'tools'
  | 'monsters'
  | 'animations'
  | 'props'
  | 'uncategorized';

export interface StoredAssetFile {
  name: string;
  relativePath: string;
  type: string;
  size: number;
  blob: Blob;
}

export interface AssetDraft {
  name: string;
  format: AssetFormat;
  category: AssetCategory;
  entryFile: string;
  files: StoredAssetFile[];
  source: string;
  license: string;
  sourcePackId?: string;
  sourceArchive?: string;
}

export interface AssetRecord extends AssetDraft {
  id: string;
  thumbnail: string;
  animations: string[];
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
