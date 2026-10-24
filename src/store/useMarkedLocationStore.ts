import { create } from 'zustand';
import * as cloud from '../services/markedLocationSync';
import type {
  AdminMarkedLocation,
  MarkedLocation,
  MarkedLocationInput,
  MarkedLocationShare,
  SharedMarkedLocation,
  ShareResult,
} from '../types/markedLocation';

export interface PickedPoint {
  lng: number;
  lat: number;
  elevationM: number | null;
}

interface MarkedLocationStore {
  userId: string | null;
  isPanelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  togglePanel: () => void;

  locations: MarkedLocation[];
  sharedLocations: SharedMarkedLocation[];
  adminLocations: AdminMarkedLocation[];
  isLoading: boolean;
  error: string | null;
  clearError: () => void;

  // Map interaction
  selectedId: string | null;
  select: (id: string | null) => void;
  isPicking: boolean;
  pickedPoint: PickedPoint | null;
  startPicking: () => void;
  stopPicking: () => void;
  setPickedPoint: (point: PickedPoint | null) => void;
  showAllOnMap: boolean; // admin: also draw every account's locations
  setShowAllOnMap: (show: boolean) => void;

  init: (userId: string) => Promise<void>;
  reset: () => void;
  loadLocations: () => Promise<void>;
  loadShared: () => Promise<void>;
  loadAll: () => Promise<void>;

  createLocation: (input: MarkedLocationInput) => Promise<MarkedLocation>;
  updateLocation: (id: string, input: MarkedLocationInput) => Promise<MarkedLocation>;
  deleteLocation: (id: string) => Promise<void>;

  shareLocations: (ids: string[], recipient: string) => Promise<ShareResult>;
  listShares: (id: string) => Promise<MarkedLocationShare[]>;
  revokeShare: (id: string, recipientId: string) => Promise<void>;
  leaveShared: (id: string) => Promise<void>;
}

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err));

const emptyState = {
  locations: [],
  sharedLocations: [],
  adminLocations: [],
  isLoading: false,
  error: null,
  selectedId: null,
  isPicking: false,
  pickedPoint: null,
  showAllOnMap: false,
};

// Replace a location wherever it is listed (mine, and the admin list)
const replaceIn = <T extends MarkedLocation>(list: T[], updated: MarkedLocation): T[] =>
  list.map((l) => (l.id === updated.id ? { ...l, ...updated } : l));

export const useMarkedLocationStore = create<MarkedLocationStore>((set, get) => {
  // Runs a load and stores its error; a newer user (logout/login) discards stale results
  const load = async (task: () => Promise<Partial<MarkedLocationStore>>) => {
    const userId = get().userId;
    if (!userId) return;
    set({ isLoading: true, error: null });
    try {
      const result = await task();
      if (get().userId === userId) set(result);
    } catch (err) {
      if (get().userId === userId) set({ error: errorMessage(err) });
    } finally {
      if (get().userId === userId) set({ isLoading: false });
    }
  };

  return {
    userId: null,
    isPanelOpen: false,
    setPanelOpen: (open) => set(open ? { isPanelOpen: true } : { isPanelOpen: false, isPicking: false }),
    togglePanel: () => get().setPanelOpen(!get().isPanelOpen),

    ...emptyState,
    clearError: () => set({ error: null }),

    select: (id) => set({ selectedId: id }),
    startPicking: () => set({ isPicking: true, selectedId: null }),
    stopPicking: () => set({ isPicking: false }),
    setPickedPoint: (point) => set({ pickedPoint: point, isPicking: false }),
    setShowAllOnMap: (show) => set({ showAllOnMap: show }),

    init: async (userId) => {
      if (get().userId === userId) return;
      set({ ...emptyState, userId });
      await Promise.all([get().loadLocations(), get().loadShared()]);
    },

    reset: () => set({ ...emptyState, userId: null, isPanelOpen: false }),

    loadLocations: () => load(async () => ({ locations: await cloud.fetchMyLocations(get().userId!) })),
    loadShared: () => load(async () => ({ sharedLocations: await cloud.fetchSharedWithMe() })),
    loadAll: () => load(async () => ({ adminLocations: await cloud.fetchAllLocations() })),

    createLocation: async (input) => {
      const created = await cloud.createLocation(input);
      set((state) => ({ locations: [created, ...state.locations], pickedPoint: null }));
      return created;
    },

    updateLocation: async (id, input) => {
      const updated = await cloud.updateLocation(id, input);
      set((state) => ({
        locations: replaceIn(state.locations, updated),
        adminLocations: replaceIn(state.adminLocations, updated),
        pickedPoint: null,
      }));
      return updated;
    },

    deleteLocation: async (id) => {
      await cloud.deleteLocation(id);
      set((state) => ({
        locations: state.locations.filter((l) => l.id !== id),
        adminLocations: state.adminLocations.filter((l) => l.id !== id),
        selectedId: state.selectedId === id ? null : state.selectedId,
      }));
    },

    shareLocations: (ids, recipient) => cloud.shareLocations(ids, recipient),
    listShares: (id) => cloud.listShares(id),
    revokeShare: (id, recipientId) => cloud.removeShare(id, recipientId),

    leaveShared: async (id) => {
      const userId = get().userId;
      if (!userId) return;
      await cloud.removeShare(id, userId);
      set((state) => ({
        sharedLocations: state.sharedLocations.filter((l) => l.id !== id),
        selectedId: state.selectedId === id ? null : state.selectedId,
      }));
    },
  };
});

export interface VisibleLocation {
  location: MarkedLocation;
  kind: 'mine' | 'shared' | 'other';
  owner: string | null; // name or email of the owner, for shared/other locations
}

// Every location this account can see on the map, without duplicates. Builds a new array:
// call it inside useMemo, not as a store selector.
export const getVisibleLocations = (
  state: Pick<MarkedLocationStore, 'locations' | 'sharedLocations' | 'adminLocations' | 'showAllOnMap'>,
) => {
  const byId = new Map<string, VisibleLocation>();
  if (state.showAllOnMap) {
    for (const l of state.adminLocations) {
      byId.set(l.id, { location: l, kind: 'other', owner: l.ownerName ?? l.ownerEmail });
    }
  }
  for (const l of state.sharedLocations) {
    byId.set(l.id, { location: l, kind: 'shared', owner: l.ownerName ?? l.ownerEmailMasked });
  }
  for (const l of state.locations) byId.set(l.id, { location: l, kind: 'mine', owner: null });
  return [...byId.values()];
};
