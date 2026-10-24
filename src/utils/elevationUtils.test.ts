import { describe, it, expect } from 'vitest';
import { decodeTerrainRgb, tilePixelFor } from './elevationUtils';

describe('Terrain-RGB lookup', () => {
  it('finds the zoom 14 tile and pixel under a coordinate', () => {
    // Checked against a real tile request for this point on the slopes of Gunung Gede
    const t = tilePixelFor(106.9811, -6.7813);
    expect(t.z).toBe(14);
    expect([t.px, t.py]).toEqual([424, 177]);
    expect(t.x).toBe(Math.floor(((106.9811 + 180) / 360) * 2 ** 14));
  });

  it('decodes Mapbox Terrain-RGB heights', () => {
    // 0 m is (R, G, B) = (1, 134, 160) since -10000 + 100000 * 0.1 = 0
    expect(decodeTerrainRgb(1, 134, 160)).toBe(0);
    // +0.1 m per step of the blue channel
    expect(decodeTerrainRgb(1, 134, 170)).toBe(1);
    expect(decodeTerrainRgb(1, 0, 0)).toBe(-3446.4);
  });
});
