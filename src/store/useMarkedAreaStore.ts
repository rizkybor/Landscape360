import { create } from 'zustand';
import * as cloud from '../services/markedAreaSync';
import type { LngLat, MarkedArea, MarkedAreaInput } from '../types/markedArea';

interface MarkedAreaStore {
  userId: string | null;
  isPanelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  togglePanel: () => void;

  areas: MarkedArea[];
  isLoading: boolean;
  error: string | null;
  clearError: () => void;

  // Drawing a new shape (or redrawing an area): points are added by tapping the map
  isDrawing: boolean;
  draft: LngLat[];
  startDrawing: (from?: LngLat[]) => void;
  addPoint: (p: LngLat) => void;
  undoPoint: () => void;
  stopDrawing: () => void;

  // Focus view: everything outside this area is darkened
  focusId: string | null;
  setFocus: (id: string | null) => void;
  selectedId: string | null;
  select: (id: string | null) => void;

  init: (userId: string) => Promise<void>;
  reset: () => void;
  load: () => Promise<void>;
  createArea: (input: MarkedAreaInput) => Promise<MarkedArea>;
  updateArea: (id: string, input: MarkedAreaInput) => Promise<MarkedArea>;
  deleteArea: (id: string) => Promise<void>;
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

export const useMarkedAreaStore = create<MarkedAreaStore>((set, get) => ({
  userId: null,
  isPanelOpen: false,
  setPanelOpen: (open) => set({ isPanelOpen: open }),
  togglePanel: () => set((s) => ({ isPanelOpen: !s.isPanelOpen })),

  areas: [],
  isLoading: false,
  error: null,
  clearError: () => set({ error: null }),

  isDrawing: false,
  draft: [],
  startDrawing: (from = []) => set({ isDrawing: true, draft: from, focusId: null }),
  addPoint: (p) => set((s) => (s.draft.length >= 500 ? s : { draft: [...s.draft, p] })),
  undoPoint: () => set((s) => ({ draft: s.draft.slice(0, -1) })),
  stopDrawing: () => set({ isDrawing: false }),

  focusId: null,
  setFocus: (id) => set({ focusId: id }),
  selectedId: null,
  select: (id) => set({ selectedId: id }),

  init: async (userId) => {
    if (get().userId === userId) return;
    set({ userId, areas: [], error: null });
    await get().load();
  },
  reset: () =>
    set({ userId: null, areas: [], isPanelOpen: false, isDrawing: false, draft: [], focusId: null, selectedId: null, error: null }),

  load: async () => {
    const userId = get().userId;
    if (!userId) return;
    set({ isLoading: true });
    try {
      set({ areas: await cloud.fetchMyAreas(userId), error: null });
    } catch (err) {
      set({ error: message(err) });
    } finally {
      set({ isLoading: false });
    }
  },

  createArea: async (input) => {
    const area = await cloud.createArea(input);
    set((s) => ({ areas: [area, ...s.areas] }));
    return area;
  },
  updateArea: async (id, input) => {
    const area = await cloud.updateArea(id, input);
    set((s) => ({ areas: s.areas.map((a) => (a.id === id ? area : a)) }));
    return area;
  },
  deleteArea: async (id) => {
    await cloud.deleteArea(id);
    set((s) => ({
      areas: s.areas.filter((a) => a.id !== id),
      focusId: s.focusId === id ? null : s.focusId,
      selectedId: s.selectedId === id ? null : s.selectedId,
    }));
  },
}));
