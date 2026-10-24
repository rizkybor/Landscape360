import { create } from 'zustand';
import { BUNDLED_POIS, listPublishedPois, toMapLocation, type MapLocation, type PointOfInterest } from '../lib/pointsOfInterest';

const CACHE_KEY = 'l360-points-of-interest';

const readCache = (): PointOfInterest[] | null => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const list = raw ? (JSON.parse(raw) as PointOfInterest[]) : null;
    return Array.isArray(list) ? list : null;
  } catch {
    return null;
  }
};

const writeCache = (list: PointOfInterest[]) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(list));
  } catch {
    // Storage full or blocked: the map still has the points for this visit
  }
};

interface PoiState {
  pois: PointOfInterest[];
  locations: MapLocation[];
  // bundled = the JSON shipped with the app, cache = last list from the server, live = fresh
  source: 'bundled' | 'cache' | 'live';
  load: () => Promise<void>;
}

const initial = readCache();

// Points of interest for the map and search: the last list seen (works offline), refreshed
// from the server, falling back to the bundled JSON before the table exists
export const usePoiStore = create<PoiState>((set) => ({
  pois: initial ?? BUNDLED_POIS,
  locations: (initial ?? BUNDLED_POIS).map(toMapLocation),
  source: initial ? 'cache' : 'bundled',
  load: async () => {
    try {
      const list = await listPublishedPois();
      writeCache(list);
      set({ pois: list, locations: list.map(toMapLocation), source: 'live' });
    } catch {
      // Offline or migration not run yet: keep what is shown
    }
  },
}));
