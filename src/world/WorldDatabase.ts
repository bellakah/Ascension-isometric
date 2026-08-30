import { cloneWorldDocument, parseWorldDocument, type WorldDocument } from './WorldDocument';

const DB_NAME = 'ascension-isometric-worlds';
const DB_VERSION = 1;
const WORLD_STORE = 'worlds';
const SETTINGS_STORE = 'settings';
const CURRENT_WORLD_KEY = 'current-world-id';

export interface WorldSummary {
  id: string;
  name: string;
  description: string;
  entityCount: number;
  updatedAt: number;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result));
    request.addEventListener('error', () => reject(request.error ?? new Error('IndexedDB request failed.')));
  });
}

export class WorldDatabase {
  private databasePromise: Promise<IDBDatabase> | null = null;

  async list(): Promise<WorldSummary[]> {
    const db = await this.open();
    const records = await requestToPromise(db.transaction(WORLD_STORE, 'readonly').objectStore(WORLD_STORE).getAll() as IDBRequest<WorldDocument[]>);
    return records
      .map((value) => parseWorldDocument(value))
      .map((world) => ({
        id: world.id,
        name: world.name,
        description: world.description,
        entityCount: world.entities.length,
        updatedAt: world.updatedAt,
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async get(id: string): Promise<WorldDocument | undefined> {
    const db = await this.open();
    const value = await requestToPromise(db.transaction(WORLD_STORE, 'readonly').objectStore(WORLD_STORE).get(id) as IDBRequest<WorldDocument | undefined>);
    return value ? parseWorldDocument(value) : undefined;
  }

  async put(document: WorldDocument): Promise<void> {
    const db = await this.open();
    const transaction = db.transaction(WORLD_STORE, 'readwrite');
    await requestToPromise(transaction.objectStore(WORLD_STORE).put(cloneWorldDocument(document)));
  }

  async delete(id: string): Promise<void> {
    const db = await this.open();
    await requestToPromise(db.transaction(WORLD_STORE, 'readwrite').objectStore(WORLD_STORE).delete(id));
  }

  async getCurrentId(): Promise<string | null> {
    const db = await this.open();
    const value = await requestToPromise(db.transaction(SETTINGS_STORE, 'readonly').objectStore(SETTINGS_STORE).get(CURRENT_WORLD_KEY) as IDBRequest<{ key: string; value: string } | undefined>);
    return value?.value ?? null;
  }

  async setCurrentId(id: string): Promise<void> {
    const db = await this.open();
    await requestToPromise(db.transaction(SETTINGS_STORE, 'readwrite').objectStore(SETTINGS_STORE).put({ key: CURRENT_WORLD_KEY, value: id }));
  }

  private open(): Promise<IDBDatabase> {
    if (this.databasePromise) return this.databasePromise;
    this.databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.addEventListener('upgradeneeded', () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(WORLD_STORE)) db.createObjectStore(WORLD_STORE, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(SETTINGS_STORE)) db.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
      });
      request.addEventListener('success', () => resolve(request.result));
      request.addEventListener('error', () => reject(request.error ?? new Error('Não foi possível abrir banco local de mapas.')));
    });
    return this.databasePromise;
  }
}
