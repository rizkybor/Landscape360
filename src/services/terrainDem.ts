import type { LngLat } from '../types/markedArea';
import type { ElevationGrid } from '../utils/contourGeo';

// Elevation grid (DEM) for a Marked Area, from the open AWS Terrain Tiles: SRTM (NASA, ~30 m)
// over Indonesia, with other public sources elsewhere. Open data, so the contours and the
// DEM can be downloaded and used freely (Mapbox's own terrain may not be exported).
// Tiles are 256 px in Web Mercator, "terrarium" encoding.

export const DEM_SOURCE = 'SRTM (NASA) and other public data via AWS Terrain Tiles';

const TILE = 256;
const MAX_ZOOM = 14; // ~10 m per pixel near the equator, finer than SRTM itself
const MIN_ZOOM = 9;
const MAX_CELLS = 1600 * 1600;
const PADDING_CELLS = 3;
const CONCURRENCY = 6;

const tileUrl = (z: number, x: number, y: number) =>
  `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;

/** Terrarium encoding: height = R * 256 + G + B / 256 - 32768 */
export const decodeTerrarium = (r: number, g: number, b: number) => r * 256 + g + b / 256 - 32768;

const mercX = (lng: number, z: number) => ((lng + 180) / 360) * 2 ** z * TILE;
const mercY = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z * TILE;
};

export interface AreaDem extends ElevationGrid {
  west: number;
  north: number;
  /** Cell size in degrees */
  resX: number;
  resY: number;
  zoom: number;
}

/** Cell size and grid size for the area at each zoom, finest that fits */
export const planGrid = (ring: LngLat[]) => {
  const lngs = ring.map((p) => p[0]);
  const lats = ring.map((p) => p[1]);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  for (let zoom = MAX_ZOOM; zoom >= MIN_ZOOM; zoom--) {
    const resX = 360 / (2 ** zoom * TILE);
    // Square cells on the ground: a degree of latitude is longer than one of longitude
    const resY = resX * Math.cos((midLat * Math.PI) / 180);
    const west = Math.min(...lngs) - PADDING_CELLS * resX;
    const north = Math.max(...lats) + PADDING_CELLS * resY;
    const width = Math.ceil((Math.max(...lngs) + PADDING_CELLS * resX - west) / resX);
    const height = Math.ceil((north - (Math.min(...lats) - PADDING_CELLS * resY)) / resY);
    if (width * height <= MAX_CELLS) return { zoom, resX, resY, west, north, width, height };
  }
  return null;
};

// Heights of one tile, row by row; NaN where it has no data
const loadTile = async (z: number, x: number, y: number): Promise<Float32Array | null> => {
  const res = await fetch(tileUrl(z, x, y));
  if (res.status === 404 || res.status === 403) return null; // no data there (open sea)
  if (!res.ok) throw new Error(`Elevation tile ${z}/${x}/${y}: ${res.status}`);
  // The RGB values are data, not colours: no colour management or premultiplying
  const bitmap = await createImageBitmap(await res.blob(), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D is not available');
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const { data } = ctx.getImageData(0, 0, TILE, TILE);
  const heights = new Float32Array(TILE * TILE);
  for (let i = 0; i < heights.length; i++) {
    const h = decodeTerrarium(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
    heights[i] = h < -12000 ? NaN : h;
  }
  return heights;
};

const SPIKE_M = 200;

/**
 * Removes one-pixel spikes: the open tiles have bad rows and columns (thousands of metres
 * off) where two 1° SRTM files meet, e.g. along 107° E. A pixel far from the average of
 * its left and right (or upper and lower) neighbours, while those two agree, takes their
 * average. Real slopes do not do that at ~10 m per pixel.
 */
export const removeSpikes = (get: (gx: number, gy: number) => number, gx: number, gy: number) => {
  const h = get(gx, gy);
  if (Number.isNaN(h)) return h;
  for (const [a, b] of [
    [get(gx - 1, gy), get(gx + 1, gy)],
    [get(gx, gy - 1), get(gx, gy + 1)],
  ]) {
    if (Number.isNaN(a) || Number.isNaN(b) || Math.abs(a - b) > SPIKE_M) continue;
    const mean = (a + b) / 2;
    if (Math.abs(h - mean) > SPIKE_M) return mean;
  }
  return h;
};

/**
 * Elevation grid in WGS84 (EPSG:4326) covering the ring plus a few cells around it, at the
 * finest zoom that keeps the grid under ~2.5 million cells.
 */
export const fetchAreaDem = async (
  ring: LngLat[],
  onProgress?: (done: number, total: number) => void,
): Promise<AreaDem> => {
  const plan = planGrid(ring);
  if (!plan) throw new Error('This area is too large for a contour download. Split it into smaller areas.');
  const { zoom, resX, resY, west, north, width, height } = plan;

  const south = north - height * resY;
  const east = west + width * resX;
  const x0 = Math.floor(mercX(west, zoom) / TILE);
  const x1 = Math.floor(mercX(east, zoom) / TILE);
  const y0 = Math.floor(mercY(north, zoom) / TILE);
  const y1 = Math.floor(mercY(south, zoom) / TILE);
  const keys: [number, number][] = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) keys.push([x, y]);

  const tiles = new Map<string, Float32Array | null>();
  let done = 0;
  let next = 0;
  const worker = async () => {
    while (next < keys.length) {
      const [x, y] = keys[next++];
      tiles.set(`${x}/${y}`, await loadTile(zoom, x, y));
      onProgress?.(++done, keys.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, keys.length) }, worker));

  // Height at a global pixel, NaN where there is no tile
  const raw = (gx: number, gy: number) => {
    const tx = Math.floor(gx / TILE);
    const ty = Math.floor(gy / TILE);
    const heights = tiles.get(`${tx}/${ty}`);
    return heights ? heights[(gy - ty * TILE) * TILE + (gx - tx * TILE)] : NaN;
  };
  const pixel = (gx: number, gy: number) => removeSpikes(raw, gx, gy);

  // Bilinear sample at each cell centre
  const values = new Float32Array(width * height);
  for (let row = 0; row < height; row++) {
    const lat = north - (row + 0.5) * resY;
    const py = mercY(lat, zoom) - 0.5;
    const gy = Math.floor(py);
    const fy = py - gy;
    for (let col = 0; col < width; col++) {
      const px = mercX(west + (col + 0.5) * resX, zoom) - 0.5;
      const gx = Math.floor(px);
      const fx = px - gx;
      const top = pixel(gx, gy) * (1 - fx) + pixel(gx + 1, gy) * fx;
      const bottom = pixel(gx, gy + 1) * (1 - fx) + pixel(gx + 1, gy + 1) * fx;
      values[row * width + col] = top * (1 - fy) + bottom * fy;
    }
  }

  return {
    width,
    height,
    values,
    west,
    north,
    resX,
    resY,
    zoom,
    toLngLat: (x, y) => [west + x * resX, north - y * resY],
  };
};
