import type { Map as MapboxMap } from "mapbox-gl";
import { MAPBOX_TOKEN } from "../config";

/**
 * Retrieves the elevation at a specific coordinate with a robust retry strategy.
 * 
 * Strategy:
 * 1. Direct Client-Side Query: Fast, uses loaded terrain tiles.
 * 2. Offset Client-Side Query: Handles tile boundary edge cases.
 * 3. Async Retry: Waits for potential render/load completion.
 * 4. API Fallback: Fetches directly from Mapbox Tilequery API (ultimate source of truth).
 */
export async function getElevationAtPoint(
    map: MapboxMap, 
    lng: number, 
    lat: number
): Promise<number> {
    // 1. Helper for Local Query
    const queryLocal = () => {
        if (!map.isStyleLoaded()) return null;
        
        // Get current terrain exaggeration to normalize the result
        // map.queryTerrainElevation returns the *exaggerated* height (e.g. 100m * 1.5 = 150m)
        // We must divide by exaggeration to get the real world elevation.
        const terrain = map.getTerrain();
        const exaggeration = (terrain && typeof terrain.exaggeration === 'number') ? terrain.exaggeration : 1;
        
        // Helper to query and normalize
        const getRealElev = (lng: number, lat: number) => {
            const raw = map.queryTerrainElevation({ lng, lat });
            if (raw === null || raw === undefined) return null;
            return raw / exaggeration;
        }

        // Direct
        let elev = getRealElev(lng, lat);
        
        // Offset (if 0 or null)
        if (elev === null || elev === 0) {
             const offset = 0.00001;
             const elevOffset = getRealElev(lng + offset, lat + offset);
             if (elevOffset !== null && elevOffset !== 0) {
                 elev = elevOffset;
             }
        }
        return elev;
    };

    // Attempt 1: Immediate
    let elevation = queryLocal();

    // Attempt 2: Short delay (Async Retry)
    if (elevation === null || elevation === 0) {
        await new Promise(resolve => setTimeout(resolve, 50));
        elevation = queryLocal();
    }

    // Attempt 3: read the Terrain-RGB elevation tile directly. Used when the map has no
    // terrain loaded (2D on phones skips it to save data). The old Tilequery fallback asked a
    // raster tileset, which Tilequery rejects, so those points were saved at 0 m.
    if ((elevation === null || elevation === 0) && navigator.onLine) {
        try {
            elevation = await fetchTerrainRgbElevation(lng, lat);
        } catch (err) {
            console.warn("Terrain tile elevation failed:", err);
        }
    }

    // Final check: if everything failed, return 0 (sea level) but ensure it's a number
    return (elevation !== null && elevation !== undefined) ? elevation : 0;
}

// --- Terrain-RGB tile lookup -------------------------------------------------------------

const DEM_ZOOM = 14; // ~5 m per pixel at the equator with 512 px tiles
const TILE_SIZE = 512;
const tileCache = new Map<string, Promise<ImageData>>();
const MAX_CACHED_TILES = 12;

/** Tile x/y and the pixel inside it for a coordinate (Web Mercator) */
export function tilePixelFor(lng: number, lat: number, z = DEM_ZOOM, size = TILE_SIZE) {
    const n = 2 ** z;
    const xt = ((lng + 180) / 360) * n;
    const latRad = (lat * Math.PI) / 180;
    const yt = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
    const x = Math.floor(xt);
    const y = Math.floor(yt);
    return {
        x,
        y,
        z,
        px: Math.min(size - 1, Math.floor((xt - x) * size)),
        py: Math.min(size - 1, Math.floor((yt - y) * size)),
    };
}

/** Mapbox Terrain-RGB encoding: height = -10000 + (R * 65536 + G * 256 + B) * 0.1 */
export const decodeTerrainRgb = (r: number, g: number, b: number) =>
    Math.round((-10000 + (r * 65536 + g * 256 + b) * 0.1) * 10) / 10;

const loadTile = (z: number, x: number, y: number): Promise<ImageData> => {
    const key = `${z}/${x}/${y}`;
    let tile = tileCache.get(key);
    if (!tile) {
        tile = (async () => {
            const res = await fetch(
                `https://api.mapbox.com/v4/mapbox.mapbox-terrain-dem-v1/${z}/${x}/${y}@2x.pngraw?access_token=${MAPBOX_TOKEN}`
            );
            if (!res.ok) throw new Error(`Terrain tile ${key}: ${res.status}`);
            // No colour management or premultiplying: the RGB values are data, not colours
            const bitmap = await createImageBitmap(await res.blob(), {
                colorSpaceConversion: "none",
                premultiplyAlpha: "none",
            });
            const canvas = document.createElement("canvas");
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;
            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            if (!ctx) throw new Error("Canvas 2D is not available");
            ctx.drawImage(bitmap, 0, 0);
            bitmap.close();
            return ctx.getImageData(0, 0, canvas.width, canvas.height);
        })();
        tile.catch(() => tileCache.delete(key)); // retry a failed tile next time
        tileCache.set(key, tile);
        if (tileCache.size > MAX_CACHED_TILES) tileCache.delete(tileCache.keys().next().value as string);
    }
    return tile;
};

/** Elevation in meters from the Mapbox Terrain-RGB tile under the coordinate */
export async function fetchTerrainRgbElevation(lng: number, lat: number): Promise<number> {
    const { z, x, y, px, py } = tilePixelFor(lng, lat);
    const image = await loadTile(z, x, y);
    const scale = image.width / TILE_SIZE;
    const i = (Math.floor(py * scale) * image.width + Math.floor(px * scale)) * 4;
    return decodeTerrainRgb(image.data[i], image.data[i + 1], image.data[i + 2]);
}
