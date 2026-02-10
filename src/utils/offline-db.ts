import { openDB, type DBSchema } from 'idb';

interface OfflineMapDB extends DBSchema {
  tiles: {
    key: string; // Normalized URL pathname (e.g. /v4/mapbox.satellite/...)
    value: {
      key: string;
      url: string; // Full URL (for reference)
      blob: Blob;
      timestamp: number;
    };
  };
}

const DB_NAME = 'landscape360-offline-db';
const DB_VERSION = 1;

/**
 * Normalize URL to use as a key.
 * Removes query parameters (like access_token) to ensure consistent cache hits.
 */
const normalizeKey = (url: string): string => {
  try {
    const urlObj = new URL(url);
    return urlObj.pathname;
  } catch (e) {
    console.error('Invalid URL for normalization:', url);
    return url;
  }
};

export const initDB = async () => {
  return openDB<OfflineMapDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('tiles')) {
        db.createObjectStore('tiles', { keyPath: 'key' });
      }
    },
  });
};

export const saveTile = async (url: string, blob: Blob) => {
  try {
    const db = await initDB();
    const key = normalizeKey(url);
    
    await db.put('tiles', {
      key,
      url,
      blob,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('Failed to save tile to IndexedDB:', error);
  }
};

export const saveTilesBulk = async (items: { url: string; blob: Blob }[]) => {
  try {
    const db = await initDB();
    const tx = db.transaction('tiles', 'readwrite');
    const store = tx.objectStore('tiles');
    
    await Promise.all([
      ...items.map(item => store.put({
        key: normalizeKey(item.url),
        url: item.url,
        blob: item.blob,
        timestamp: Date.now()
      })),
      tx.done
    ]);
  } catch (error) {
    console.error('Failed to bulk save tiles:', error);
  }
};

export const getTile = async (url: string): Promise<Blob | undefined> => {
  try {
    const db = await initDB();
    const key = normalizeKey(url);
    
    const entry = await db.get('tiles', key);
    return entry?.blob;
  } catch (error) {
    console.error('Failed to get tile from IndexedDB:', error);
    return undefined;
  }
};

export const hasTile = async (url: string): Promise<boolean> => {
  try {
    const db = await initDB();
    const key = normalizeKey(url);
    const keyCount = await db.count('tiles', key);
    return keyCount > 0;
  } catch {
    return false;
  }
};

export const deleteTile = async (url: string) => {
  try {
    const db = await initDB();
    const key = normalizeKey(url);
    await db.delete('tiles', key);
  } catch (error) {
    console.error('Failed to delete tile from IndexedDB:', error);
  }
};

export const deleteTilesBulk = async (urls: string[]) => {
  try {
    const db = await initDB();
    const tx = db.transaction('tiles', 'readwrite');
    const store = tx.objectStore('tiles');
    
    await Promise.all([
      ...urls.map(url => store.delete(normalizeKey(url))),
      tx.done
    ]);
  } catch (error) {
    console.error('Failed to bulk delete tiles:', error);
  }
};

export const clearAllTiles = async () => {
  try {
    const db = await initDB();
    await db.clear('tiles');
  } catch (error) {
    console.error('Failed to clear all tiles:', error);
  }
};
