import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabaseClient';
import type { User } from '@supabase/supabase-js';
import { useMapStore } from './useMapStore';

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

export interface SavedSurvey {
  id: string;
  name: string;
  updated_at: string;
}

interface SurveyState {
  isPlotMode: boolean;
  groups: SurveyGroup[];
  activeGroupId: string | null;
  
  // Auth & Sync
  user: User | null;
  currentSurveyId: string | null;
  savedSurveys: SavedSurvey[];
  isSyncing: boolean;
  subscriptionStatus: 'Free' | 'Pro' | 'Ultimate';
  
  setUser: (user: User | null) => void;
  loadSubscriptionStatus: () => Promise<void>;
  loadSavedSurveys: () => Promise<void>;
  loadSurvey: (id: string) => Promise<void>;
  saveCurrentSurvey: (name?: string) => Promise<void>;
  deleteSurvey: (id: string) => Promise<void>;
  createNewSurvey: () => void;

  togglePlotMode: () => void;
  setPlotMode: (active: boolean) => void;
  
  // Group actions
  createGroup: () => void;
  deleteGroup: (id: string) => void;
  setActiveGroup: (id: string) => void;
  updateGroupName: (id: string, name: string) => void;

  // Point actions (affects active group)
  addPoint: (point: Omit<SurveyPoint, 'id'>) => void;
  updatePointPosition: (groupId: string, pointId: string, lat: number, lng: number, elevation?: number) => void;
  removePoint: (groupId: string, pointId: string) => void;
  clearPoints: (groupId: string) => void;
}

const COLORS = ['#FFD700', '#00FF7F', '#00BFFF', '#FF69B4', '#FFA500'];

export const useSurveyStore = create<SurveyState>()(
  persist(
    (set, get) => ({
  isPlotMode: false,
  groups: [],
  activeGroupId: null,
  
  user: null,
  currentSurveyId: null,
  savedSurveys: [],
  isSyncing: false,
  subscriptionStatus: 'Free',

  setUser: (user) => {
    set({ user });
    if (user) {
      get().loadSubscriptionStatus();
      get().loadSavedSurveys();
    } else {
      set({ 
        savedSurveys: [], 
        currentSurveyId: null, 
        subscriptionStatus: 'Free',
        // Clear survey data on logout
        groups: [],
        activeGroupId: null,
        isPlotMode: false
      });
    }
  },

  loadSubscriptionStatus: async () => {
    const { user } = get();
    if (!user) return;
    
    const { data } = await supabase
      .from('profiles')
      .select('status_subscribe')
      .eq('id', user.id)
      .single();
      
    if (data && data.status_subscribe) {
      set({ subscriptionStatus: data.status_subscribe as 'Free' | 'Pro' | 'Ultimate' });
    }
  },

  loadSavedSurveys: async () => {
    // Always get fresh user from supabase session to ensure we are not using stale state
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;

    // Update user state if needed
    if (user && get().user?.id !== user.id) {
        set({ user });
    }

    if (!user) {
        set({ savedSurveys: [] });
        return;
    }
    
    set({ isSyncing: true });
    const { data, error } = await supabase
      .from('surveys')
      .select('id, name, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error loading surveys:', error);
      set({ isSyncing: false });
      return;
    }

    set({ savedSurveys: data || [], isSyncing: false });
  },

  loadSurvey: async (id) => {
    set({ isSyncing: true });
    
    // First check if it's the currently loaded survey in memory/persist
    const { currentSurveyId, groups } = get();
    if (currentSurveyId === id && groups.length > 0) {
       // Already loaded, just fly to it
       // ... (fly logic below)
    }

    const { data, error } = await supabase
      .from('surveys')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error loading survey:', error);
      // If offline, we might be stuck. 
      // Ideally we would cache full survey details in savedSurveys or a separate cache.
      // For now, if it's the *current* survey, we are good. If it's a different one, we might fail offline.
      set({ isSyncing: false });
      
      // Fallback: Check if we happen to have it in state (unlikely if we just switched)
      return;
    }

    if (data) {
      // Parse groups from data jsonb
      const groups = data.data as SurveyGroup[];
      set({ 
        groups, 
        currentSurveyId: id, 
        activeGroupId: groups.length > 0 ? groups[0].id : null,
        isSyncing: false,
        isPlotMode: true // Enable plot mode to show panel
      });

      // Calculate bounds and fly to survey
      let minLng = 180;
      let maxLng = -180;
      let minLat = 90;
      let maxLat = -90;
      let hasPoints = false;

      groups.forEach(g => {
        g.points.forEach(p => {
            hasPoints = true;
            minLng = Math.min(minLng, p.lng);
            maxLng = Math.max(maxLng, p.lng);
            minLat = Math.min(minLat, p.lat);
            maxLat = Math.max(maxLat, p.lat);
        });
      });

      if (hasPoints) {
          const centerLng = (minLng + maxLng) / 2;
          const centerLat = (minLat + maxLat) / 2;
          
          // Trigger flyTo via MapStore
          useMapStore.getState().triggerFlyTo({
              center: [centerLng, centerLat],
              zoom: 16, // Close up for survey details
              duration: 2000
          });
      }
    }
  },

  saveCurrentSurvey: async (name) => {
    const { user, groups, currentSurveyId, savedSurveys, subscriptionStatus } = get();
    if (!user) {
        console.warn("Cannot save survey: No user logged in.");
        return;
    }

    // Check Limits for NEW surveys (when currentSurveyId is null)
    if (!currentSurveyId) {
      const limits = {
        'Free': 2,
        'Pro': 5,
        'Ultimate': 10
      };
      
      const limit = limits[subscriptionStatus] || 2;
      
      // Filter saved surveys by current user to ensure accurate count
      // Although savedSurveys should already be filtered by loadSavedSurveys, double check is safer
      // Wait, savedSurveys in store is already user-specific from loadSavedSurveys.
      
      if (savedSurveys.length >= limit) {
        // We can't use alert() here easily without blocking or being ugly.
        // Ideally we should throw an error or set an error state that UI consumes.
        // For now, let's console error and maybe the UI can check this condition too.
        console.error(`Survey limit reached for ${subscriptionStatus} plan (${limit}).`);
        
        // Prevent saving if limit reached
        // We allow editing current in-memory group, but NOT persisting to DB as a new entry
        return;
      }
    }

    set({ isSyncing: true });

    const surveyData = {
      user_id: user.id, // Explicitly set user_id
      data: groups,
      name: name || (groups.length > 0 ? groups[0].name : 'Untitled Survey'),
      updated_at: new Date().toISOString()
    };

    let result;
    if (currentSurveyId) {
      // Update existing
      result = await supabase
        .from('surveys')
        .update(surveyData)
        .eq('id', currentSurveyId)
        .select();
    } else {
      // Insert new
      result = await supabase
        .from('surveys')
        .insert(surveyData)
        .select();
    }

    if (result.error) {
      console.error('Error saving survey (offline?):', result.error);
      // If offline, we still have the data in 'groups' state which is persisted.
      // But we won't get a new ID if it was an insert.
    } else if (result.data && result.data.length > 0) {
      const saved = result.data[0];
      set({ currentSurveyId: saved.id });
      
      // Update savedSurveys list immediately without waiting for re-fetch
      set((state) => {
        const otherSurveys = state.savedSurveys.filter(s => s.id !== saved.id);
        return {
          savedSurveys: [
            { id: saved.id, name: saved.name, updated_at: saved.updated_at },
            ...otherSurveys
          ]
        };
      });
    }

    set({ isSyncing: false });
  },

  deleteSurvey: async (id) => {
    const { user } = get();
    if (!user) return;

    const { error } = await supabase
        .from('surveys')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

    if (error) {
        console.error('Error deleting survey:', error);
    } else {
        // Remove from local state
        set((state) => ({
            savedSurveys: state.savedSurveys.filter(s => s.id !== id),
            // If the deleted survey is currently loaded, clear it? 
            // Optional: let's keep it in memory but remove ID so it treats as new if saved again
            currentSurveyId: state.currentSurveyId === id ? null : state.currentSurveyId
        }));
    }
  },

  createNewSurvey: () => {
    set({ 
      groups: [], 
      activeGroupId: null, 
      currentSurveyId: null 
    });
  },

  togglePlotMode: () => set((state) => ({ isPlotMode: !state.isPlotMode })),
  setPlotMode: (active) => set({ isPlotMode: active }),

  createGroup: () => {
    set((state) => {
      const id = crypto.randomUUID();
      const newGroup: SurveyGroup = {
        id,
        name: `Survey ${state.groups.length + 1}`,
        points: [],
        color: COLORS[state.groups.length % COLORS.length]
      };
      const newState = { 
        groups: [...state.groups, newGroup],
        activeGroupId: id,
        isPlotMode: true
      };
      return newState;
    });
    // Auto-save
    get().saveCurrentSurvey();
  },

  deleteGroup: (id) => {
    set((state) => {
      const newGroups = state.groups.filter(g => g.id !== id);
      return {
        groups: newGroups,
        activeGroupId: state.activeGroupId === id 
          ? (newGroups.length > 0 ? newGroups[newGroups.length - 1].id : null)
          : state.activeGroupId
      };
    });
    get().saveCurrentSurvey();
  },

  setActiveGroup: (id) => set({ activeGroupId: id }),

  updateGroupName: (id, name) => {
    set((state) => ({
      groups: state.groups.map(g => g.id === id ? { ...g, name } : g)
    }));
    get().saveCurrentSurvey();
  },
  
  addPoint: (point) => {
    set((state) => {
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
    });
    get().saveCurrentSurvey();
  },

  updatePointPosition: (groupId, pointId, lat, lng, elevation) => {
    set((state) => ({
      groups: state.groups.map(g => 
        g.id === groupId 
          ? { 
              ...g, 
              points: g.points.map(p => 
                p.id === pointId ? { 
                  ...p, 
                  lat, 
                  lng,
                  elevation: elevation !== undefined ? elevation : p.elevation 
                } : p
              ) 
            } 
          : g
      )
    }));
    // Debounce save? Or save immediately. For dragging, maybe we should save on dragEnd only.
    // But store update happens on drag. 
    // Let's assume the UI calls this on dragEnd for performance, or we just save.
    get().saveCurrentSurvey();
  },

  removePoint: (groupId, pointId) => {
    set((state) => ({
      groups: state.groups.map(g => 
        g.id === groupId ? { ...g, points: g.points.filter(p => p.id !== pointId) } : g
      )
    }));
    get().saveCurrentSurvey();
  },

  clearPoints: (groupId) => {
    set((state) => ({
      groups: state.groups.map(g => 
        g.id === groupId ? { ...g, points: [] } : g
      )
    }));
    get().saveCurrentSurvey();
  },
    }),
    {
      name: 'landscape360-survey-store',
      partialize: (state) => ({ 
        // Only persist these fields
        groups: state.groups, 
        activeGroupId: state.activeGroupId,
        currentSurveyId: state.currentSurveyId,
        subscriptionStatus: state.subscriptionStatus
      }),
    }
  )
);
