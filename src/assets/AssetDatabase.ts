import type { AssetRecord } from './types';

const DB_NAME = 'ascension-isometric-assets';
const DB_VERSION = 1;
const STORE = 'assets';

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result));
    request.addEventListener('error', () => reject(request.error ?? new Error('IndexedDB request failed.')));
  });
}

export class AssetDatabase {
  private databasePromise: Promise<IDBDatabase> | null = null;

  async list(): Promise<AssetRecord[]> {
    const db = await this.open();
    const transaction = db.transaction(STORE, 'readonly');
    const records = await requestToPromise(transaction.objectStore(STORE).getAll() as IDBRequest<AssetRecord[]>);
    return records.sort((a, b) => b.createdAt - a.createdAt);
  }

  async get(id: string): Promise<AssetRecord | undefined> {
    const db = await this.open();
    const transaction = db.transaction(STORE, 'readonly');
    return requestToPromise(transaction.objectStore(STORE).get(id) as IDBRequest<AssetRecord | undefined>);
  }

  async put(asset: AssetRecord): Promise<void> {
    const db = await this.open();
    const transaction = db.transaction(STORE, 'readwrite');
    await requestToPromise(transaction.objectStore(STORE).put(asset));
  }

  async delete(id: string): Promise<void> {
    const db = await this.open();
    const transaction = db.transaction(STORE, 'readwrite');
    await requestToPromise(transaction.objectStore(STORE).delete(id));
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
      request.addEventListener('error', () => reject(request.error ?? new Error('Could not open asset database.')));
    });
    return this.databasePromise;
  }
}
