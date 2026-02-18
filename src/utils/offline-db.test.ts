import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initDB, saveTile, getTile, hasTile, clearAllTiles, saveTilesBulk } from './offline-db';
import { openDB } from 'idb';

// Mock idb
vi.mock('idb', () => ({
  openDB: vi.fn(),
}));

describe('Offline Mode (IndexedDB)', () => {
  let mockDB: any;
  let mockTx: any;
  let mockStore: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockStore = {
      put: vi.fn().mockResolvedValue('ok'),
      get: vi.fn(),
      count: vi.fn(),
      delete: vi.fn().mockResolvedValue('ok'),
      clear: vi.fn().mockResolvedValue('ok'),
    };

    mockTx = {
      objectStore: vi.fn().mockReturnValue(mockStore),
      done: Promise.resolve(),
    };

    mockDB = {
      transaction: vi.fn().mockReturnValue(mockTx),
      put: vi.fn().mockResolvedValue('ok'),
      get: vi.fn(),
      count: vi.fn(),
      delete: vi.fn().mockResolvedValue('ok'),
      clear: vi.fn().mockResolvedValue('ok'),
      objectStoreNames: { contains: vi.fn() },
      createObjectStore: vi.fn(),
    };

    (openDB as any).mockResolvedValue(mockDB);
  });

  it('should initialize DB correctly', async () => {
    await initDB();
    expect(openDB).toHaveBeenCalledWith('landscape360-offline-db', 1, expect.any(Object));
  });

  it('should save tile to offline storage', async () => {
    const url = 'https://api.mapbox.com/styles/v1/mapbox/satellite-v9/tiles/1/1/1';
    const blob = new Blob(['fake-image'], { type: 'image/png' });

    await saveTile(url, blob);

    expect(mockDB.put).toHaveBeenCalledWith('tiles', expect.objectContaining({
      url,
      blob,
      key: '/styles/v1/mapbox/satellite-v9/tiles/1/1/1' // Normalized key
    }));
  });

  it('should retrieve tile from offline storage', async () => {
    const url = 'https://api.mapbox.com/styles/v1/mapbox/satellite-v9/tiles/1/1/1';
    const mockEntry = { blob: new Blob(['data']), timestamp: Date.now() };
    
    mockDB.get.mockResolvedValue(mockEntry);

    const result = await getTile(url);

    expect(mockDB.get).toHaveBeenCalledWith('tiles', '/styles/v1/mapbox/satellite-v9/tiles/1/1/1');
    expect(result).toBe(mockEntry.blob);
  });

  it('should return undefined if tile not found', async () => {
    mockDB.get.mockResolvedValue(undefined);
    const result = await getTile('https://unknown.url');
    expect(result).toBeUndefined();
  });

  it('should check if tile exists', async () => {
    mockDB.count.mockResolvedValue(1);
    const exists = await hasTile('https://url');
    expect(exists).toBe(true);

    mockDB.count.mockResolvedValue(0);
    const notExists = await hasTile('https://url');
    expect(notExists).toBe(false);
  });

  it('should bulk save tiles', async () => {
    const items = [
      { url: 'https://a.com/1.png', blob: new Blob(['1']) },
      { url: 'https://b.com/2.png', blob: new Blob(['2']) }
    ];

    await saveTilesBulk(items);

    expect(mockTx.objectStore).toHaveBeenCalledWith('tiles');
    expect(mockStore.put).toHaveBeenCalledTimes(2);
  });

  it('should clear all offline tiles', async () => {
    await clearAllTiles();
    expect(mockDB.clear).toHaveBeenCalledWith('tiles');
  });
});
