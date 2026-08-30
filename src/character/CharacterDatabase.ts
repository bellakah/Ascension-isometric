import { parseCharacterPreset, type CharacterPreset } from './CharacterPreset';

const DB_NAME = 'ascension-isometric-characters';
const DB_VERSION = 1;
const PRESETS_STORE = 'presets';
const SETTINGS_STORE = 'settings';
const ACTIVE_KEY = 'active-preset-id';

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result));
    request.addEventListener('error', () => reject(request.error ?? new Error('IndexedDB request failed.')));
  });
}

export class CharacterDatabase {
  private databasePromise: Promise<IDBDatabase> | null = null;

  async list(): Promise<CharacterPreset[]> {
    const db = await this.open();
    const transaction = db.transaction(PRESETS_STORE, 'readonly');
    const records = await requestToPromise(transaction.objectStore(PRESETS_STORE).getAll() as IDBRequest<CharacterPreset[]>);
    return records.map(parseCharacterPreset).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async get(id: string): Promise<CharacterPreset | undefined> {
    const db = await this.open();
    const transaction = db.transaction(PRESETS_STORE, 'readonly');
    const record = await requestToPromise(transaction.objectStore(PRESETS_STORE).get(id) as IDBRequest<CharacterPreset | undefined>);
    return record ? parseCharacterPreset(record) : undefined;
  }

  async put(preset: CharacterPreset): Promise<void> {
    const db = await this.open();
    const transaction = db.transaction(PRESETS_STORE, 'readwrite');
    await requestToPromise(transaction.objectStore(PRESETS_STORE).put(parseCharacterPreset(preset)));
  }

  async delete(id: string): Promise<void> {
    const db = await this.open();
    const transaction = db.transaction([PRESETS_STORE, SETTINGS_STORE], 'readwrite');
    await requestToPromise(transaction.objectStore(PRESETS_STORE).delete(id));
    const active = await requestToPromise(transaction.objectStore(SETTINGS_STORE).get(ACTIVE_KEY) as IDBRequest<{ key: string; value: string } | undefined>);
    if (active?.value === id) await requestToPromise(transaction.objectStore(SETTINGS_STORE).delete(ACTIVE_KEY));
  }

  async getActiveId(): Promise<string | null> {
    const db = await this.open();
    const transaction = db.transaction(SETTINGS_STORE, 'readonly');
    const record = await requestToPromise(transaction.objectStore(SETTINGS_STORE).get(ACTIVE_KEY) as IDBRequest<{ key: string; value: string } | undefined>);
    return record?.value ?? null;
  }

  async setActiveId(id: string | null): Promise<void> {
    const db = await this.open();
    const transaction = db.transaction(SETTINGS_STORE, 'readwrite');
    if (!id) {
      await requestToPromise(transaction.objectStore(SETTINGS_STORE).delete(ACTIVE_KEY));
      return;
    }
    await requestToPromise(transaction.objectStore(SETTINGS_STORE).put({ key: ACTIVE_KEY, value: id }));
  }

  async getActive(): Promise<CharacterPreset | undefined> {
    const id = await this.getActiveId();
    return id ? this.get(id) : undefined;
  }

  private open(): Promise<IDBDatabase> {
    if (this.databasePromise) return this.databasePromise;
    this.databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.addEventListener('upgradeneeded', () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(PRESETS_STORE)) db.createObjectStore(PRESETS_STORE, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(SETTINGS_STORE)) db.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
      });
      request.addEventListener('success', () => resolve(request.result));
      request.addEventListener('error', () => reject(request.error ?? new Error('Could not open character database.')));
    });
    return this.databasePromise;
  }
}
