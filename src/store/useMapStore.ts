import { create } from 'zustand';
import type { Bounds } from '../utils/tileUtils';

interface MapState {
  center: [number, number];
  zoom: number;
  pitch: number;
  bearing: number;
  bounds: Bounds | null;
  contourInterval: number;
  activeView: '2D' | '3D';
  elevationExaggeration: number;
  opacity: number;
  mouseControlMode: 'camera' | 'map';
  interactionMode: 'default' | 'draw_region';
  regionPoints: [number, number][];
  showContours: boolean;
  showSearch: boolean;
  flyToDestination: { center: [number, number]; zoom: number; duration?: number } | null;
  
  setCenter: (center: [number, number]) => void;
  setZoom: (zoom: number) => void;
  setPitch: (pitch: number) => void;
  setBearing: (bearing: number) => void;
  setBounds: (bounds: Bounds) => void;
  setContourInterval: (interval: number) => void;
  setElevationExaggeration: (factor: number) => void;
  setOpacity: (opacity: number) => void;
  setShowContours: (show: boolean) => void;
  setShowSearch: (show: boolean) => void;
  setActiveView: (view: '2D' | '3D') => void;
  setMouseControlMode: (mode: 'camera' | 'map') => void;
  setInteractionMode: (mode: 'default' | 'draw_region') => void;
  setRegionPoints: (points: [number, number][]) => void;
  addRegionPoint: (point: [number, number]) => void;
  clearRegionPoints: () => void;
  setMapState: (state: Partial<Omit<MapState, 'actions'>>) => void;
  triggerFlyTo: (destination: { center: [number, number]; zoom: number; duration?: number } | null) => void;
}

export const useMapStore = create<MapState>((set) => ({
  center: [-122.4194, 37.7749], // San Francisco default
  zoom: 14,
  pitch: 60, // Start with a tilted 3D view
  bearing: 0,
  bounds: null,
  contourInterval: 50,
  activeView: '3D', // Default to 3D mode
  elevationExaggeration: 1.5, // Slightly exaggerate terrain for better effect
  opacity: 0.8,
  mouseControlMode: 'camera', // Default to Camera Mode (Left=Rotate)
  interactionMode: 'default',
  regionPoints: [],
  showContours: true,
  showSearch: false,
  flyToDestination: null,

  setCenter: (center) => set({ center }),
  setZoom: (zoom) => set({ zoom }),
  setPitch: (pitch) => set({ pitch }),
  setBearing: (bearing) => set({ bearing }),
  setBounds: (bounds) => set({ bounds }),
  setContourInterval: (contourInterval) => set({ contourInterval }),
  setElevationExaggeration: (elevationExaggeration) => set({ elevationExaggeration }),
  setOpacity: (opacity) => set({ opacity }),
  setShowContours: (showContours) => set({ showContours }),
  setShowSearch: (showSearch) => set({ showSearch }),
  setActiveView: (activeView) => set({ activeView }),
  setMouseControlMode: (mouseControlMode) => set({ mouseControlMode }),
  setInteractionMode: (interactionMode) => set({ interactionMode }),
  setRegionPoints: (regionPoints) => set({ regionPoints }),
  addRegionPoint: (point) => set((state) => ({ regionPoints: [...state.regionPoints, point] })),
  clearRegionPoints: () => set({ regionPoints: [] }),
  setMapState: (newState) => set((state) => ({ ...state, ...newState })),
  triggerFlyTo: (flyToDestination) => set({ flyToDestination }),
}));
