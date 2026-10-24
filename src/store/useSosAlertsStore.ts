import { create } from 'zustand';
import { listSosAlerts, type SosAlert } from '../lib/sosAlerts';

interface SosAlertsState {
  active: SosAlert[];
  error: string | null;
  loadedAt: number | null;
  panelOpen: boolean;
  loadActive: () => Promise<void>;
  openPanel: () => void;
  closePanel: () => void;
}

// Admin: active S.O.S alerts, shared by the map banner, the markers and the panel
export const useSosAlertsStore = create<SosAlertsState>((set) => ({
  active: [],
  error: null,
  loadedAt: null,
  panelOpen: false,
  loadActive: async () => {
    try {
      const active = await listSosAlerts(true);
      set({ active, error: null, loadedAt: Date.now() });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },
  openPanel: () => set({ panelOpen: true }),
  closePanel: () => set({ panelOpen: false }),
}));
