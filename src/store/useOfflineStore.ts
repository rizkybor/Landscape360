import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Bounds } from '../utils/tileUtils';

export interface OfflineRegion {
  id: string;
  userId?: string; // Add userId to track ownership
  name: string;
  bounds: Bounds;
  minZoom: number;
  maxZoom: number;
  tileCount: number;
  sizeEstMB: number;
  createdAt: string;
  status: 'downloading' | 'completed' | 'error';
  progress: number;
}

interface OfflineState {
  regions: OfflineRegion[];
  addRegion: (region: OfflineRegion) => void;
  setRegions: (regions: OfflineRegion[]) => void;
  updateRegionProgress: (id: string, progress: number, status?: OfflineRegion['status']) => void;
  removeRegion: (id: string) => void;
  getRegion: (id: string) => OfflineRegion | undefined;
}

export const useOfflineStore = create<OfflineState>()(
  persist(
    (set, get) => ({
      regions: [],
      addRegion: (region) => set((state) => ({ regions: [...state.regions, region] })),
      setRegions: (regions) => set({ regions }),
      updateRegionProgress: (id, progress, status) => set((state) => ({
        regions: state.regions.map((r) => 
          r.id === id 
            ? { ...r, progress, status: status || r.status } 
            : r
        )
      })),
      removeRegion: (id) => set((state) => ({
        regions: state.regions.filter((r) => r.id !== id)
      })),
      getRegion: (id) => get().regions.find((r) => r.id === id),
    }),
    {
      name: 'landscape360-offline-store',
    }
  )
);
