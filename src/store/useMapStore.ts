import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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
  showGridDMS: boolean;
  gridOpacity: number;
  gridStep: number | 'auto';
  showSearch: boolean;
  showWeather: boolean;
  mapStyle: string;
  flyToDestination: { center: [number, number]; zoom: number; duration?: number } | null;
  
  setCenter: (center: [number, number]) => void;
  setZoom: (zoom: number) => void;
  setPitch: (pitch: number) => void;
  setBearing: (bearing: number) => void;
  setBounds: (bounds: Bounds) => void;
  setContourInterval: (interval: number) => void;
  setElevationExaggeration: (factor: number) => void;
  setOpacity: (opacity: number) => void;
  setGridOpacity: (opacity: number) => void;
  setGridStep: (step: number | 'auto') => void;
  setShowContours: (show: boolean) => void;
  setShowGridDMS: (show: boolean) => void;
  setShowSearch: (show: boolean) => void;
  setShowWeather: (show: boolean) => void;
  setMapStyle: (style: string) => void;
  setActiveView: (view: '2D' | '3D') => void;
  setMouseControlMode: (mode: 'camera' | 'map') => void;
  setInteractionMode: (mode: 'default' | 'draw_region') => void;
  setRegionPoints: (points: [number, number][]) => void;
  addRegionPoint: (point: [number, number]) => void;
  clearRegionPoints: () => void;
  setMapState: (state: Partial<Omit<MapState, 'actions'>>) => void;
  triggerFlyTo: (destination: { center: [number, number]; zoom: number; duration?: number } | null) => void;
}

export const useMapStore = create<MapState>()(
  persist(
    (set) => ({
      center: [106.8456, -6.2088], // JAKARTA
      zoom: 14,
      pitch: 60, // Start with a tilted 3D view
      bearing: 0,
      bounds: null,
      contourInterval: 50,
      activeView: '3D', // Default to 3D mode
      elevationExaggeration: 1.5, // Slightly exaggerate terrain for better effect
      opacity: 0.8,
      mouseControlMode: 'map', // Default to Map Mode (Left=Pan)
      interactionMode: 'default',
      regionPoints: [],
      showContours: true,
      showGridDMS: false,
      gridOpacity: 0.5,
      gridStep: 'auto',
      showSearch: false,
      showWeather: false,
      mapStyle: 'mapbox://styles/mapbox/satellite-streets-v12',
      flyToDestination: null,

      setCenter: (center) => set({ center }),
      setZoom: (zoom) => set({ zoom }),
      setPitch: (pitch) => set({ pitch }),
      setBearing: (bearing) => set({ bearing }),
      setBounds: (bounds) => set({ bounds }),
      setContourInterval: (contourInterval) => set({ contourInterval }),
      setElevationExaggeration: (elevationExaggeration) => set({ elevationExaggeration }),
      setOpacity: (opacity) => set({ opacity }),
      setGridOpacity: (gridOpacity) => set({ gridOpacity }),
      setGridStep: (gridStep) => set({ gridStep }),
      setShowContours: (showContours) => set({ showContours }),
      setShowGridDMS: (showGridDMS) => set({ showGridDMS }),
      setShowSearch: (showSearch) => set({ showSearch }),
      setShowWeather: (showWeather) => set({ showWeather }),
      setMapStyle: (mapStyle) => set({ mapStyle }),
      setActiveView: (activeView) => set({ activeView }),
      setMouseControlMode: (mouseControlMode) => set({ mouseControlMode }),
      setInteractionMode: (interactionMode) => set({ interactionMode }),
      setRegionPoints: (regionPoints) => set({ regionPoints }),
      addRegionPoint: (point) => set((state) => ({ regionPoints: [...state.regionPoints, point] })),
      clearRegionPoints: () => set({ regionPoints: [] }),
      setMapState: (newState) => set((state) => ({ ...state, ...newState })),
      triggerFlyTo: (flyToDestination) => set({ flyToDestination }),
    }),
    {
      name: 'map-storage', // unique name
      partialize: (state) => ({
        center: state.center,
        zoom: state.zoom,
        pitch: state.pitch,
        bearing: state.bearing,
        mapStyle: state.mapStyle,
        activeView: state.activeView,
        showContours: state.showContours,
        showGridDMS: state.showGridDMS,
        gridOpacity: state.gridOpacity,
        gridStep: state.gridStep,
        showWeather: state.showWeather,
        contourInterval: state.contourInterval,
        elevationExaggeration: state.elevationExaggeration,
        opacity: state.opacity,
        // Don't persist transient state like flyToDestination or temporary measurement points (unless desired)
      }),
    }
  )
);
