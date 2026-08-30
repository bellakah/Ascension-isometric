import { unzipSync } from 'fflate';

export type TerrainTextureMap = 'color' | 'normal' | 'roughness' | 'ao' | 'height';

export interface TerrainTextureFile {
  name: string;
  type: string;
  blob: Blob;
}

export interface TerrainMaterialRecord {
  id: string;
  name: string;
  sourceArchive: string;
  files: Partial<Record<TerrainTextureMap, TerrainTextureFile>>;
  createdAt: number;
}

const DB_NAME = 'ascension-isometric-terrain-materials';
const DB_VERSION = 1;
const STORE = 'materials';

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result));
    request.addEventListener('error', () => reject(request.error ?? new Error('IndexedDB request failed.')));
  });
}

function materialId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `terrain-material-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function cleanName(value: string): string {
  return value.replace(/\.[^.]+$/, '').replace(/[_-](1k|2k|4k|8k)$/i, '').replace(/[_-]+/g, ' ').trim() || 'Terrain Material';
}

function mapRole(path: string): TerrainTextureMap | null {
  const name = path.toLowerCase();
  if (!/\.(png|jpe?g|webp)$/i.test(name)) return null;
  if (/(^|[_-])(color|albedo|basecolor|base_color|diffuse)([_-.]|$)/i.test(name)) return 'color';
  if (/(^|[_-])normal[_-]?gl([_-.]|$)/i.test(name)) return 'normal';
  if (/(^|[_-])normal([_-.]|$)/i.test(name) && !/normal[_-]?dx/i.test(name)) return 'normal';
  if (/(^|[_-])(roughness|rough)([_-.]|$)/i.test(name)) return 'roughness';
  if (/(^|[_-])(ambient[_-]?occlusion|ao)([_-.]|$)/i.test(name)) return 'ao';
  if (/(^|[_-])(height|displacement)([_-.]|$)/i.test(name)) return 'height';
  return null;
}

function mimeFor(name: string): string {
  if (/\.jpe?g$/i.test(name)) return 'image/jpeg';
  if (/\.webp$/i.test(name)) return 'image/webp';
  return 'image/png';
}

function bytesToBlob(bytes: Uint8Array, name: string): Blob {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy.buffer], { type: mimeFor(name) });
}

export class TerrainMaterialDatabase {
  private databasePromise: Promise<IDBDatabase> | null = null;

  async list(): Promise<TerrainMaterialRecord[]> {
    const db = await this.open();
    const tx = db.transaction(STORE, 'readonly');
    const records = await requestToPromise(tx.objectStore(STORE).getAll() as IDBRequest<TerrainMaterialRecord[]>);
    return records.sort((a, b) => b.createdAt - a.createdAt);
  }

  async get(id: string): Promise<TerrainMaterialRecord | undefined> {
    const db = await this.open();
    const tx = db.transaction(STORE, 'readonly');
    return requestToPromise(tx.objectStore(STORE).get(id) as IDBRequest<TerrainMaterialRecord | undefined>);
  }

  async put(record: TerrainMaterialRecord): Promise<void> {
    const db = await this.open();
    const tx = db.transaction(STORE, 'readwrite');
    await requestToPromise(tx.objectStore(STORE).put(record));
  }

  async delete(id: string): Promise<void> {
    const db = await this.open();
    const tx = db.transaction(STORE, 'readwrite');
    await requestToPromise(tx.objectStore(STORE).delete(id));
  }

  async importZip(file: File): Promise<TerrainMaterialRecord> {
    const archive = unzipSync(new Uint8Array(await file.arrayBuffer()));
    const files: TerrainMaterialRecord['files'] = {};
    const entries = Object.entries(archive).filter(([name]) => !name.endsWith('/'));
    const normalGl = entries.find(([name]) => /normal[_-]?gl/i.test(name));
    for (const [name, bytes] of entries) {
      let role = mapRole(name);
      if (/normal[_-]?dx/i.test(name) && normalGl) role = null;
      if (!role || files[role]) continue;
      const leaf = name.split('/').pop() ?? name;
      files[role] = { name: leaf, type: mimeFor(leaf), blob: bytesToBlob(bytes, leaf) };
    }
    if (!files.color) throw new Error('O ZIP não possui mapa de cor/albedo reconhecível.');
    const colorName = files.color.name;
    const record: TerrainMaterialRecord = {
      id: materialId(),
      name: cleanName(colorName.replace(/[_-](color|albedo|basecolor|base_color|diffuse).*$/i, '')),
      sourceArchive: file.name,
      files,
      createdAt: Date.now(),
    };
    await this.put(record);
    return record;
  }

  private open(): Promise<IDBDatabase> {
    if (this.databasePromise) return this.databasePromise;
    this.databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.addEventListener('upgradeneeded', () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      });
      request.addEventListener('success', () => resolve(request.result));
      request.addEventListener('error', () => reject(request.error ?? new Error('Could not open terrain material database.')));
    });
    return this.databasePromise;
  }
}
