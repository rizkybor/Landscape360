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
