import { describe, it, expect, vi, beforeEach } from 'vitest';
import { saveTile, getTile } from './offline-db';
import { openDB } from 'idb';

// Mock idb
vi.mock('idb', () => ({
  openDB: vi.fn(),
}));

describe('offline-db', () => {
  const mockPut = vi.fn();
  const mockGet = vi.fn();
  const mockDb = {
    put: mockPut,
    get: mockGet,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (openDB as any).mockResolvedValue(mockDb);
  });

  it('saveTile should normalize URL and save blob', async () => {
    const url = 'https://api.mapbox.com/styles/v1/mapbox/satellite-v9/tiles/512/14/10/10?access_token=pk.xxx';
    const blob = new Blob(['test'], { type: 'image/png' });

    await saveTile(url, blob);

    expect(mockPut).toHaveBeenCalledWith(
        'tiles', 
        expect.objectContaining({
            key: '/styles/v1/mapbox/satellite-v9/tiles/512/14/10/10',
            url: url,
            blob: blob,
            timestamp: expect.any(Number)
        })
    );
  });

  it('getTile should retrieve blob using normalized key', async () => {
    const url = 'https://api.mapbox.com/styles/v1/mapbox/satellite-v9/tiles/512/14/10/10?access_token=pk.yyy'; // Different token
    const mockBlob = new Blob(['cached'], { type: 'image/png' });
    // Mock the full object stored in DB
    mockGet.mockResolvedValue({
        key: '/styles/v1/mapbox/satellite-v9/tiles/512/14/10/10',
        blob: mockBlob
    });

    const result = await getTile(url);

    expect(mockGet).toHaveBeenCalledWith(
        'tiles',
        '/styles/v1/mapbox/satellite-v9/tiles/512/14/10/10'
    );
    expect(result).toBe(mockBlob);
  });

  it('getTile should return undefined if not found', async () => {
    mockGet.mockResolvedValue(undefined);
    const result = await getTile('https://example.com/tile.png');
    expect(result).toBeUndefined();
  });
});
