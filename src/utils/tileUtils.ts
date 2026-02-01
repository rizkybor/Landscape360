
// Helper to convert lat/lon to tile coordinates
function long2tile(lon: number, zoom: number) {
  return (Math.floor((lon + 180) / 360 * Math.pow(2, zoom)));
}

function lat2tile(lat: number, zoom: number) {
  return (Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom)));
}

export interface Tile {
  x: number;
  y: number;
  z: number;
}

export interface Bounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export function getTilesInBounds(bounds: Bounds, minZoom: number, maxZoom: number): Tile[] {
  const tiles: Tile[] = [];

  for (let z = minZoom; z <= maxZoom; z++) {
    const minX = long2tile(bounds.west, z);
    const maxX = long2tile(bounds.east, z);
    const minY = lat2tile(bounds.north, z);
    const maxY = lat2tile(bounds.south, z);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        tiles.push({ x, y, z });
      }
    }
  }

  return tiles;
}

export function getMapboxTileUrl(x: number, y: number, z: number, token: string): string {
  // Use mapbox.mapbox-terrain-v2 or mapbox.satellite or whatever style is used
  // But wait, standard mapbox-gl uses vector tiles usually.
  // Ideally we should cache the style's sources.
  // For simplicity, we might just target the satellite-v9 raster tiles or mapbox-terrain-dem-v1
  
  // Actually, usually we need:
  // 1. Satellite Raster (mapbox.satellite)
  // 2. Terrain DEM (mapbox.mapbox-terrain-dem-v1)
  
  // We will cache both for robust offline 3D support.
  return `https://api.mapbox.com/v4/mapbox.satellite/${z}/${x}/${y}@2x.webp?access_token=${token}`;
}

export function getTerrainTileUrl(x: number, y: number, z: number, token: string): string {
  return `https://api.mapbox.com/raster/v1/mapbox.mapbox-terrain-dem-v1/${z}/${x}/${y}.webp?sku=101XzrMIdw3eL&access_token=${token}`;
}
