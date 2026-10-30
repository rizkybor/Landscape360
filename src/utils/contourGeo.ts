import { contours as d3Contours } from 'd3-contour';
import type { LngLat } from '../types/markedArea';

// Contour lines for a Marked Area: made from an elevation grid (DEM), or read from a file,
// then cut to the area's outline. Used by the download and upload in AreaContourBox.

export interface ContourLine {
  elevation: number | null; // metres; null when the uploaded file has no height for the line
  coords: LngLat[];
}

/** A grid of elevations (metres). NaN = no data. Cell (0, 0) is the top-left corner. */
export interface ElevationGrid {
  width: number;
  height: number;
  values: Float32Array;
  /** Map position of a grid point; x / y run 0..width / 0..height, cell centres sit at +0.5 */
  toLngLat: (x: number, y: number) => LngLat;
}

export const CONTOUR_INTERVALS = [5, 10, 12.5, 25, 50, 100];
const MAX_LEVELS = 400;

/** Interval of the thicker index lines (cartographic 1:4, as on the map's contour layer) */
export const indexIntervalFor = (interval: number) => {
  if (interval === 12.5) return 50;
  if (interval === 25) return 100;
  if (interval === 50) return 200;
  if (interval === 125) return 500;
  return interval * (interval === 5 || interval === 10 || interval === 100 ? 5 : 4);
};

export const isIndexLine = (elevation: number | null, interval: number | null) =>
  elevation !== null && interval !== null && Math.abs(elevation % indexIntervalFor(interval)) < 1e-6;

const yieldToBrowser = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * Contour lines of the grid every `interval` metres. Lines stop at the edge of the grid and
 * at cells without data, so neither shows up as a fake contour.
 */
export const gridToContours = async (
  grid: ElevationGrid,
  interval: number,
  onProgress?: (done: number, total: number) => void,
): Promise<ContourLine[]> => {
  const { width, height, values } = grid;
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (Number.isNaN(v)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (min === Infinity) throw new Error('The elevation data for this area is empty.');

  const levels: number[] = [];
  for (let e = Math.ceil(min / interval) * interval; e <= max; e += interval) levels.push(Number(e.toFixed(3)));
  if (levels.length > MAX_LEVELS) {
    throw new Error(`That gives ${levels.length} contour levels. Choose a larger interval.`);
  }

  // Cells without data get a value below every level; the lines that makes around them are dropped below
  const hasGaps = values.some((v) => Number.isNaN(v));
  const filled = hasGaps ? Float64Array.from(values, (v) => (Number.isNaN(v) ? min - 1 : v)) : Array.from(values);
  const valid = (cx: number, cy: number) =>
    cx >= 0 && cy >= 0 && cx < width && cy < height && !Number.isNaN(values[cy * width + cx]);
  // A vertex is usable when it is inside the grid and every cell around it has data
  const usable = (x: number, y: number) => {
    if (x <= 0 || y <= 0 || x >= width || y >= height) return false;
    if (!hasGaps) return true;
    const cx = Math.floor(x - 0.5);
    const cy = Math.floor(y - 0.5);
    return valid(cx, cy) && valid(cx + 1, cy) && valid(cx, cy + 1) && valid(cx + 1, cy + 1);
  };

  const generator = d3Contours().size([width, height]).smooth(true);
  const lines: ContourLine[] = [];
  for (let i = 0; i < levels.length; i++) {
    const elevation = levels[i];
    const shape = generator.contour(filled as number[], elevation);
    for (const polygon of shape.coordinates) {
      for (const ring of polygon) {
        // Split the ring wherever it touches the grid edge or a gap
        const runs: LngLat[][] = [[]];
        for (const [x, y] of ring) {
          if (usable(x, y)) runs[runs.length - 1].push(grid.toLngLat(x, y));
          else if (runs[runs.length - 1].length) runs.push([]);
        }
        // The ring is closed: when it was cut, its last piece continues into its first
        const [x0, y0] = ring[0];
        if (runs.length > 1 && usable(x0, y0)) {
          const last = runs.pop()!;
          runs[0] = [...last.slice(0, -1), ...runs[0]];
        }
        for (const run of runs) if (run.length >= 2) lines.push({ elevation, coords: run });
      }
    }
    onProgress?.(i + 1, levels.length);
    if (i % 4 === 3) await yieldToBrowser();
  }
  return lines;
};

// --- Cutting lines to the area outline --------------------------------------------------

/** Point-in-polygon test for one ring, with the edges bucketed by latitude so it stays fast */
export const ringTester = (ring: LngLat[]) => {
  const n = ring.length;
  let south = Infinity;
  let north = -Infinity;
  let west = Infinity;
  let east = -Infinity;
  for (const [lng, lat] of ring) {
    south = Math.min(south, lat);
    north = Math.max(north, lat);
    west = Math.min(west, lng);
    east = Math.max(east, lng);
  }
  const BANDS = Math.max(1, Math.min(512, n * 2));
  const span = north - south || 1e-12;
  const bandOf = (lat: number) => Math.min(BANDS - 1, Math.max(0, Math.floor(((lat - south) / span) * BANDS)));
  const bands: number[][] = Array.from({ length: BANDS }, () => []);
  for (let i = 0; i < n; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % n];
    const from = bandOf(Math.min(a[1], b[1]));
    const to = bandOf(Math.max(a[1], b[1]));
    for (let k = from; k <= to; k++) bands[k].push(i);
  }
  return (p: LngLat) => {
    const [x, y] = p;
    if (x < west || x > east || y < south || y > north) return false;
    let inside = false;
    for (const i of bands[bandOf(y)]) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[(i + 1) % n];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
};

// Where segment a-b first crosses the ring (closest to a), or null
const crossing = (a: LngLat, b: LngLat, ring: LngLat[]): LngLat | null => {
  let best: number | null = null;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  for (let i = 0; i < ring.length; i++) {
    const c = ring[i];
    const d = ring[(i + 1) % ring.length];
    const ex = d[0] - c[0];
    const ey = d[1] - c[1];
    const denom = dx * ey - dy * ex;
    if (denom === 0) continue;
    const t = ((c[0] - a[0]) * ey - (c[1] - a[1]) * ex) / denom;
    const u = ((c[0] - a[0]) * dy - (c[1] - a[1]) * dx) / denom;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1 && (best === null || t < best)) best = t;
  }
  return best === null ? null : [a[0] + dx * best, a[1] + dy * best];
};

/** Keeps only the parts of the lines inside the ring, ending exactly on its edge */
export const clipLinesToRing = (lines: ContourLine[], ring: LngLat[]): ContourLine[] => {
  const inside = ringTester(ring);
  const out: ContourLine[] = [];
  for (const line of lines) {
    let run: LngLat[] = [];
    const flush = () => {
      if (run.length >= 2) out.push({ elevation: line.elevation, coords: run });
      run = [];
    };
    let prev: LngLat | null = null;
    let prevIn = false;
    for (const p of line.coords) {
      const isIn = inside(p);
      if (prev && isIn !== prevIn) {
        const edge = prevIn ? crossing(prev, p, ring) : crossing(p, prev, ring);
        if (prevIn) {
          if (edge) run.push(edge);
          flush();
        } else if (edge) {
          run.push(edge);
        }
      }
      if (isIn) run.push(p);
      prev = p;
      prevIn = isIn;
    }
    flush();
  }
  return out;
};

// --- Size ------------------------------------------------------------------------------

// Douglas-Peucker on one line (tolerance in degrees)
const simplifyCoords = (coords: LngLat[], tolerance: number): LngLat[] => {
  if (coords.length <= 2 || tolerance <= 0) return coords;
  const keep = new Uint8Array(coords.length);
  keep[0] = keep[coords.length - 1] = 1;
  const stack: [number, number][] = [[0, coords.length - 1]];
  const t2 = tolerance * tolerance;
  while (stack.length) {
    const [first, last] = stack.pop()!;
    const [ax, ay] = coords[first];
    const [bx, by] = coords[last];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let maxD = -1;
    let index = -1;
    for (let i = first + 1; i < last; i++) {
      const [px, py] = coords[i];
      let d2: number;
      if (len2 === 0) d2 = (px - ax) ** 2 + (py - ay) ** 2;
      else {
        const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
        d2 = (px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2;
      }
      if (d2 > maxD) {
        maxD = d2;
        index = i;
      }
    }
    if (maxD > t2) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  return coords.filter((_, i) => keep[i]);
};

const round6 = (v: number) => Math.round(v * 1e6) / 1e6;

/** Simplifies, rounds to ~0.1 m and drops lines too short to matter */
export const tidyLines = (lines: ContourLine[], tolerance: number): ContourLine[] =>
  lines
    .map((l) => ({
      elevation: l.elevation === null ? null : Math.round(l.elevation * 100) / 100,
      coords: simplifyCoords(l.coords, tolerance).map(([x, y]) => [round6(x), round6(y)] as LngLat),
    }))
    .filter((l) => l.coords.length >= 2);

export const vertexCount = (lines: ContourLine[]) => lines.reduce((n, l) => n + l.coords.length, 0);

export const elevationRange = (lines: ContourLine[]) => {
  let min: number | null = null;
  let max: number | null = null;
  for (const { elevation } of lines) {
    if (elevation === null) continue;
    min = min === null ? elevation : Math.min(min, elevation);
    max = max === null ? elevation : Math.max(max, elevation);
  }
  return { min, max };
};

/** The smallest gap between contour levels (the interval of an uploaded file), or null */
export const guessInterval = (lines: ContourLine[]): number | null => {
  const levels = [...new Set(lines.map((l) => l.elevation).filter((e): e is number => e !== null))].sort((a, b) => a - b);
  let best: number | null = null;
  for (let i = 1; i < levels.length; i++) {
    const gap = Number((levels[i] - levels[i - 1]).toFixed(3));
    if (gap > 0 && (best === null || gap < best)) best = gap;
  }
  return best;
};

// --- Attributes ----------------------------------------------------------------------------

// Attribute names that hold a contour's height in common files (BIG / RBI, QGIS, ArcGIS, GPS apps)
const ELEVATION_KEYS = ['elevation', 'elev', 'ele', 'contour', 'kontur', 'height', 'altitude', 'alt', 'z', 'level', 'value', 'hgt', 'tinggi', 'ketinggian', 'mdpl'];

const toNumber = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  const m = v.replace(',', '.').match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
};

/** The elevation in a feature's attributes, or null */
export const elevationFromProperties = (props: Record<string, unknown> | null | undefined): number | null => {
  if (!props) return null;
  const byKey = new Map(Object.entries(props).map(([k, v]) => [k.toLowerCase(), v]));
  for (const key of ELEVATION_KEYS) {
    if (!byKey.has(key)) continue;
    const n = toNumber(byKey.get(key));
    if (n !== null) return n;
  }
  for (const [k, v] of byKey) {
    if (/elev|kontur|contour|height|tinggi/.test(k)) {
      const n = toNumber(v);
      if (n !== null) return n;
    }
  }
  // A name such as "1250" or "1250 m"
  const name = byKey.get('name');
  if (typeof name === 'string' && /^\s*-?\d+([.,]\d+)?\s*(m|mdpl|meter)?\s*$/i.test(name)) return toNumber(name);
  return null;
};
