import { create } from 'zustand';

export interface SurveyPoint {
  id: string;
  lng: number;
  lat: number;
  elevation: number; // Surface elevation
}

interface SurveyState {
  isPlotMode: boolean;
  points: SurveyPoint[];
  
  togglePlotMode: () => void;
  setPlotMode: (active: boolean) => void;
  addPoint: (point: Omit<SurveyPoint, 'id'>) => void;
  removePoint: (id: string) => void;
  clearPoints: () => void;
}

export const useSurveyStore = create<SurveyState>((set) => ({
  isPlotMode: false,
  points: [],

  togglePlotMode: () => set((state) => ({ isPlotMode: !state.isPlotMode })),
  setPlotMode: (active) => set({ isPlotMode: active }),
  
  addPoint: (point) => set((state) => {
    // Max 2 points for simple Point-to-Point as requested context, 
    // but structure allows array. Let's keep array but maybe limit logic later if needed.
    // User said: "max 2 points for simple azimuth, or an array for multi-segment"
    // We'll allow multiple, but the UI might focus on the last two for calculation.
    const newPoint = { ...point, id: crypto.randomUUID() };
    return { points: [...state.points, newPoint] };
  }),

  removePoint: (id) => set((state) => ({
    points: state.points.filter((p) => p.id !== id)
  })),

  clearPoints: () => set({ points: [] }),
}));
