import { describe, expect, it } from 'vitest';
import {
  clipLinesToRing,
  elevationFromProperties,
  gridToContours,
  guessInterval,
  isIndexLine,
  ringTester,
  tidyLines,
  type ElevationGrid,
} from './contourGeo';
import type { LngLat } from '../types/markedArea';

// A cone: highest (100 m) in the middle of a 41 x 41 grid, 1 unit per cell
const cone = (gap?: (col: number, row: number) => boolean): ElevationGrid => {
  const width = 41;
  const height = 41;
  const values = new Float32Array(width * height);
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const d = Math.hypot(col + 0.5 - 20.5, row + 0.5 - 20.5);
      values[row * width + col] = gap?.(col, row) ? NaN : 100 - d * 4;
    }
  }
  return { width, height, values, toLngLat: (x, y) => [x, -y] };
};

describe('gridToContours', () => {
  it('makes closed rings at each level, at the right distance from the peak', async () => {
    const lines = await gridToContours(cone(), 20);
    const levels = [...new Set(lines.map((l) => l.elevation))].sort((a, b) => a! - b!);
    // Corners dip below 0 m, the peak (100 m) is never reached
    expect(levels).toEqual([0, 20, 40, 60, 80]);
    const ring60 = lines.find((l) => l.elevation === 60)!;
    // 100 - d * 4 = 60  ->  d = 10 from the centre (20.5, -20.5)
    for (const [x, y] of ring60.coords) expect(Math.hypot(x - 20.5, y + 20.5)).toBeCloseTo(10, 0);
    // One unbroken closed ring
    expect(lines.filter((l) => l.elevation === 60)).toHaveLength(1);
    expect(ring60.coords[0]).toEqual(ring60.coords[ring60.coords.length - 1]);
  });

  it('never draws along the grid edge or around cells without data', async () => {
    const lines = await gridToContours(cone((col) => col < 15), 20);
    for (const l of lines) {
      for (const [x] of l.coords) expect(x).toBeGreaterThan(15);
    }
    expect(lines.length).toBeGreaterThan(0);
  });

  it('refuses intervals that give hundreds of levels', async () => {
    await expect(gridToContours(cone(), 0.1)).rejects.toThrow(/larger interval/);
  });
});

const square: LngLat[] = [
  [0, 0],
  [10, 0],
  [10, 10],
  [0, 10],
];

describe('clipping to the area', () => {
  it('tests points against the ring', () => {
    const inside = ringTester(square);
    expect(inside([5, 5])).toBe(true);
    expect(inside([11, 5])).toBe(false);
    expect(inside([-1, -1])).toBe(false);
  });

  it('cuts lines at the edge of the area', () => {
    const [line, ...rest] = clipLinesToRing(
      [{ elevation: 50, coords: [[-5, 5], [5, 5], [15, 5]] }],
      square,
    );
    expect(rest).toHaveLength(0);
    expect(line.coords).toEqual([[0, 5], [5, 5], [10, 5]]);
  });

  it('splits a line that leaves and comes back', () => {
    const lines = clipLinesToRing(
      [{ elevation: 50, coords: [[2, 2], [2, 12], [8, 12], [8, 2]] }],
      square,
    );
    expect(lines).toHaveLength(2);
  });

  it('drops lines outside', () => {
    expect(clipLinesToRing([{ elevation: 1, coords: [[20, 20], [30, 30]] }], square)).toEqual([]);
  });
});

describe('tidyLines', () => {
  it('drops points on a straight line and rounds coordinates', () => {
    const [line] = tidyLines([{ elevation: 12.3456, coords: [[0, 0], [0.5, 0.0000001], [1, 0]] }], 0.001);
    expect(line.coords).toEqual([[0, 0], [1, 0]]);
    expect(line.elevation).toBe(12.35);
  });
});

describe('attributes', () => {
  it('finds the elevation under common names', () => {
    expect(elevationFromProperties({ ELEV: '1250.00' })).toBe(1250);
    expect(elevationFromProperties({ KONTUR: 875 })).toBe(875);
    expect(elevationFromProperties({ Contour_m: '500' })).toBe(500);
    expect(elevationFromProperties({ name: '1500 m' })).toBe(1500);
    expect(elevationFromProperties({ name: 'Jalur 2' })).toBeNull();
    expect(elevationFromProperties(null)).toBeNull();
  });

  it('knows index lines and the interval of a file', () => {
    expect(isIndexLine(100, 25)).toBe(true);
    expect(isIndexLine(75, 25)).toBe(false);
    expect(isIndexLine(50, 12.5)).toBe(true);
    expect(
      guessInterval([
        { elevation: 100, coords: [] },
        { elevation: 125, coords: [] },
        { elevation: 175, coords: [] },
      ]),
    ).toBe(25);
  });
});
