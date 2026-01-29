import { create } from 'zustand';

interface MapState {
  center: [number, number];
  zoom: number;
  pitch: number;
  bearing: number;
  contourInterval: number;
  activeView: '2D' | '3D';
  elevationExaggeration: number;
  opacity: number;
  mouseControlMode: 'camera' | 'map';
  
  setCenter: (center: [number, number]) => void;
  setZoom: (zoom: number) => void;
  setPitch: (pitch: number) => void;
  setBearing: (bearing: number) => void;
  setContourInterval: (interval: number) => void;
  setElevationExaggeration: (factor: number) => void;
  setOpacity: (opacity: number) => void;
  setActiveView: (view: '2D' | '3D') => void;
  setMouseControlMode: (mode: 'camera' | 'map') => void;
  setMapState: (state: Partial<Omit<MapState, 'actions'>>) => void;
}

export const useMapStore = create<MapState>((set) => ({
  center: [-122.4194, 37.7749], // San Francisco default
  zoom: 14,
  pitch: 60, // Start with a tilted 3D view
  bearing: 0,
  contourInterval: 50,
  activeView: '3D', // Default to 3D mode
  elevationExaggeration: 1.5, // Slightly exaggerate terrain for better effect
  opacity: 0.8,
  mouseControlMode: 'camera', // Default to Camera Mode (Left=Rotate)

  setCenter: (center) => set({ center }),
  setZoom: (zoom) => set({ zoom }),
  setPitch: (pitch) => set({ pitch }),
  setBearing: (bearing) => set({ bearing }),
  setContourInterval: (contourInterval) => set({ contourInterval }),
  setElevationExaggeration: (elevationExaggeration) => set({ elevationExaggeration }),
  setOpacity: (opacity) => set({ opacity }),
  setActiveView: (activeView) => set({ activeView }),
  setMouseControlMode: (mouseControlMode) => set({ mouseControlMode }),
  setMapState: (newState) => set((state) => ({ ...state, ...newState })),
}));
