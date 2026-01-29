import { create } from 'zustand';

export interface SurveyPoint {
  id: string;
  lng: number;
  lat: number;
  elevation: number; // Surface elevation
}

export interface SurveyGroup {
  id: string;
  name: string;
  points: SurveyPoint[];
  color: string;
}

interface SurveyState {
  isPlotMode: boolean;
  groups: SurveyGroup[];
  activeGroupId: string | null;
  
  togglePlotMode: () => void;
  setPlotMode: (active: boolean) => void;
  
  // Group actions
  createGroup: () => void;
  deleteGroup: (id: string) => void;
  setActiveGroup: (id: string) => void;
  updateGroupName: (id: string, name: string) => void;

  // Point actions (affects active group)
  addPoint: (point: Omit<SurveyPoint, 'id'>) => void;
  removePoint: (groupId: string, pointId: string) => void;
  clearPoints: (groupId: string) => void;
}

const COLORS = ['#FFD700', '#00FF7F', '#00BFFF', '#FF69B4', '#FFA500'];

export const useSurveyStore = create<SurveyState>((set) => ({
  isPlotMode: false,
  groups: [],
  activeGroupId: null,

  togglePlotMode: () => set((state) => ({ isPlotMode: !state.isPlotMode })),
  setPlotMode: (active) => set({ isPlotMode: active }),

  createGroup: () => set((state) => {
    const id = crypto.randomUUID();
    const newGroup: SurveyGroup = {
      id,
      name: `Survey ${state.groups.length + 1}`,
      points: [],
      color: COLORS[state.groups.length % COLORS.length]
    };
    return { 
      groups: [...state.groups, newGroup],
      activeGroupId: id,
      isPlotMode: true
    };
  }),

  deleteGroup: (id) => set((state) => {
    const newGroups = state.groups.filter(g => g.id !== id);
    return {
      groups: newGroups,
      activeGroupId: state.activeGroupId === id 
        ? (newGroups.length > 0 ? newGroups[newGroups.length - 1].id : null)
        : state.activeGroupId
    };
  }),

  setActiveGroup: (id) => set({ activeGroupId: id }),

  updateGroupName: (id, name) => set((state) => ({
    groups: state.groups.map(g => g.id === id ? { ...g, name } : g)
  })),
  
  addPoint: (point) => set((state) => {
    if (!state.activeGroupId && state.groups.length === 0) {
      // Auto-create first group if none exists
      const id = crypto.randomUUID();
      const newGroup: SurveyGroup = {
        id,
        name: 'Survey 1',
        points: [{ ...point, id: crypto.randomUUID() }],
        color: COLORS[0]
      };
      return { groups: [newGroup], activeGroupId: id };
    }

    const activeId = state.activeGroupId || state.groups[0]?.id;
    if (!activeId) return state;

    const newPoint = { ...point, id: crypto.randomUUID() };
    return {
      groups: state.groups.map(g => 
        g.id === activeId ? { ...g, points: [...g.points, newPoint] } : g
      )
    };
  }),

  removePoint: (groupId, pointId) => set((state) => ({
    groups: state.groups.map(g => 
      g.id === groupId ? { ...g, points: g.points.filter(p => p.id !== pointId) } : g
    )
  })),

  clearPoints: (groupId) => set((state) => ({
    groups: state.groups.map(g => 
      g.id === groupId ? { ...g, points: [] } : g
    )
  })),
}));
