import { create } from "zustand";

export type RouteMode = "driving_toll" | "driving_no_toll" | "walking";

type LngLat = { lng: number; lat: number };

interface RouteStore {
  isRoutePlannerEnabled: boolean;
  mode: RouteMode;
  start: LngLat | null;
  end: LngLat | null;
  routeGeoJSON: GeoJSON.FeatureCollection | null;
  distanceM: number;
  durationS: number;
  isLoading: boolean;
  error: string | null;
  setRoutePlannerEnabled: (enabled: boolean) => void;
  toggleRoutePlanner: () => void;
  setMode: (mode: RouteMode) => void;
  setStart: (p: LngLat | null) => void;
  setEnd: (p: LngLat | null) => void;
  clearRoute: () => void;
  swapStartEnd: () => void;
  computeRoute: (token: string) => Promise<void>;
}

const toCoordStr = (p: LngLat) => `${p.lng},${p.lat}`;

const buildDirectionsUrl = ({
  token,
  mode,
  start,
  end,
}: {
  token: string;
  mode: RouteMode;
  start: LngLat;
  end: LngLat;
}) => {
  const profile = mode === "walking" ? "walking" : "driving";
  const exclude = mode === "driving_no_toll" ? "toll" : null;
  const params = new URLSearchParams();
  params.set("geometries", "geojson");
  params.set("overview", "full");
  params.set("alternatives", "false");
  params.set("steps", "false");
  if (exclude) params.set("exclude", exclude);
  params.set("access_token", token);
  return `https://api.mapbox.com/directions/v5/mapbox/${profile}/${toCoordStr(start)};${toCoordStr(end)}?${params.toString()}`;
};

export const useRouteStore = create<RouteStore>((set, get) => ({
  isRoutePlannerEnabled: false,
  mode: "driving_toll",
  start: null,
  end: null,
  routeGeoJSON: null,
  distanceM: 0,
  durationS: 0,
  isLoading: false,
  error: null,
  setRoutePlannerEnabled: (enabled) =>
    set(() => ({
      isRoutePlannerEnabled: enabled,
      ...(enabled
        ? {}
        : {
            start: null,
            end: null,
            routeGeoJSON: null,
            distanceM: 0,
            durationS: 0,
            isLoading: false,
            error: null,
          }),
    })),
  toggleRoutePlanner: () =>
    set((state) => ({
      isRoutePlannerEnabled: !state.isRoutePlannerEnabled,
      ...(!state.isRoutePlannerEnabled
        ? {}
        : {
            start: null,
            end: null,
            routeGeoJSON: null,
            distanceM: 0,
            durationS: 0,
            isLoading: false,
            error: null,
          }),
    })),
  setMode: (mode) => set({ mode }),
  setStart: (p) => set({ start: p }),
  setEnd: (p) => set({ end: p }),
  clearRoute: () =>
    set({
      start: null,
      end: null,
      routeGeoJSON: null,
      distanceM: 0,
      durationS: 0,
      isLoading: false,
      error: null,
    }),
  swapStartEnd: () =>
    set((state) => ({
      start: state.end,
      end: state.start,
      routeGeoJSON: null,
      distanceM: 0,
      durationS: 0,
      error: null,
    })),
  computeRoute: async (token) => {
    const { start, end, mode } = get();
    if (!start || !end) return;
    if (!token || token === "YOUR_MAPBOX_TOKEN_HERE") {
      set({ error: "Mapbox token belum dikonfigurasi.", routeGeoJSON: null });
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const url = buildDirectionsUrl({ token, mode, start, end });
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Directions API error (${res.status})`);
      }
      const json = await res.json();
      const route = json?.routes?.[0];
      if (!route?.geometry) {
        throw new Error("Rute tidak ditemukan.");
      }

      const routeGeoJSON: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: route.geometry,
            properties: {
              mode,
            },
          } as any,
        ],
      };

      set({
        routeGeoJSON,
        distanceM: typeof route.distance === "number" ? route.distance : 0,
        durationS: typeof route.duration === "number" ? route.duration : 0,
      });
    } catch (e) {
      set({
        routeGeoJSON: null,
        distanceM: 0,
        durationS: 0,
        error: e instanceof Error ? e.message : "Gagal mengambil rute.",
      });
    } finally {
      set({ isLoading: false });
    }
  },
}));

