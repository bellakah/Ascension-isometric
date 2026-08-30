import { parseWorldDocument, type WorldDocument } from './WorldDocument';

export const PLAYTEST_STORAGE_KEY = 'ascension-isometric-playtest-world-v1';

export function storePlaytestWorld(document: WorldDocument): void {
  localStorage.setItem(PLAYTEST_STORAGE_KEY, JSON.stringify(document));
}

export function readPlaytestWorld(): WorldDocument | null {
  const value = localStorage.getItem(PLAYTEST_STORAGE_KEY);
  if (!value) return null;
  try {
    return parseWorldDocument(JSON.parse(value));
  } catch {
    return null;
  }
}
