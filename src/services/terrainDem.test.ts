import { describe, expect, it } from 'vitest';
import { decodeTerrarium, planGrid, removeSpikes } from './terrainDem';

describe('terrainDem', () => {
  it('decodes terrarium pixels', () => {
    expect(decodeTerrarium(128, 0, 0)).toBe(0);
    expect(decodeTerrarium(135, 202, 128)).toBeCloseTo(1994.5, 5);
  });

  it('repairs the bad column where two SRTM files meet, keeps real slopes', () => {
    // Column 1 is a seam (-7720 m) between 2040 m and 2035 m, as in the tile at 107° E
    const rows = [
      [2043, -7720, 2035],
      [2048, -7718, 2038],
      [2074, -7708, 2052],
    ];
    const get = (x: number, y: number) => rows[y]?.[x] ?? NaN;
    expect(removeSpikes(get, 1, 1)).toBe(2043);
    // A steep but real slope is left alone
    const slope = [[1000, 1100, 1200]];
    expect(removeSpikes((x, y) => slope[y]?.[x] ?? NaN, 1, 0)).toBe(1100);
  });

  it('picks the finest zoom that fits, and refuses huge areas', () => {
    const small = planGrid([[106.96, -6.81], [107.0, -6.81], [107.0, -6.77]]);
    expect(small?.zoom).toBe(14);
    expect(planGrid([[100, -8], [115, -8], [115, 5]])).toBeNull();
  });
});
