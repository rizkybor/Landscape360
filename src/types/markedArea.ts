import type { FeatureCollection, LineString } from 'geojson';

export type LngLat = [number, number];

// A polygon drawn on the map (table marked_areas, 20261026000019)
export interface MarkedArea {
  id: string;
  userId: string;
  name: string;
  color: string; // #rrggbb
  notes: string | null;
  ring: LngLat[]; // outer ring, not closed (the first point is not repeated)
  areaM2: number;
  perimeterM: number;
  createdAt: number;
  updatedAt: number;
}

export interface MarkedAreaInput {
  name: string;
  color: string;
  notes: string | null;
  ring: LngLat[];
}

// An area opened from a share link (no sign-in)
export interface LinkedArea {
  name: string;
  color: string;
  notes: string | null;
  ring: LngLat[];
  areaM2: number;
  perimeterM: number;
  updatedAt: number;
  ownerName: string | null;
}

// Contours uploaded to an area (table marked_area_contours, 20261030000021): GeoJSON lines
// with an "elevation" property (metres, or null when the file had none)
export type AreaContourData = FeatureCollection<LineString, { elevation: number | null }>;

export interface AreaContourMeta {
  areaId: string;
  sourceName: string;
  sourceFormat: 'shp' | 'geotiff' | 'geojson' | 'kml' | 'kmz';
  intervalM: number | null;
  lineCount: number;
  minElevation: number | null;
  maxElevation: number | null;
  updatedAt: number;
}

export interface AreaContourInput {
  areaId: string;
  sourceName: string;
  sourceFormat: AreaContourMeta['sourceFormat'];
  intervalM: number | null;
  minElevation: number | null;
  maxElevation: number | null;
  data: AreaContourData;
}
