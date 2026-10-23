import { create } from 'zustand';
import type {
  GpsStatus,
  RecordedTrack,
  TrackMode,
  TrackPoint,
} from '../types/trackRecorder';
import {
  accumulatePoint,
  accumulatePoints,
  buildGpx,
  createAccumulator,
  emptyStats,
  shouldRejectPoint,
  type StatsAccumulator,
} from '../utils/trackRecorderGeo';
import * as localDb from '../utils/trackRecorderDb';
import * as cloud from '../services/trackRecorderSync';

// Pro, Enterprise and admin accounts may record tracks (also enforced by RLS).
export const canUseTrackRecorder = (params: {
  hasUser: boolean;
  subscriptionStatus: string;
  isAdmin: boolean;
}) =>
  params.hasUser &&
  (params.isAdmin || params.subscriptionStatus === 'Pro' || params.subscriptionStatus === 'Enterprise');

export type GpsFix = Omit<TrackPoint, 'segment'>;

interface TrackRecorderStore {
  userId: string | null;
  isPanelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  togglePanel: () => void;

  activeTrack: RecordedTrack | null;
  activePoints: TrackPoint[];
  accumulator: StatsAccumulator;
  currentSegment: number;
  currentFix: GpsFix | null;
  gpsStatus: GpsStatus;
  setGpsStatus: (status: GpsStatus) => void;

  tracks: RecordedTrack[];
  isLoadingTracks: boolean;
  viewing: { track: RecordedTrack; points: TrackPoint[] } | null;
  error: string | null;
  clearError: () => void;

  init: (userId: string) => Promise<void>;
  reset: () => void;
  startTrack: (name: string, mode: TrackMode) => Promise<void>;
  pauseTrack: () => Promise<void>;
  resumeTrack: () => Promise<void>;
  stopTrack: () => Promise<void>;
  discardTrack: () => Promise<void>;
  recordFix: (fix: GpsFix) => void;
  syncTrack: (trackId: string) => Promise<void>;
  syncPending: () => Promise<void>;
  loadTracks: () => Promise<void>;
  viewTrack: (trackId: string) => Promise<void>;
  closeView: () => void;
  renameTrack: (trackId: string, name: string) => Promise<void>;
  deleteTrack: (trackId: string) => Promise<void>;
  exportGpx: (trackId: string) => Promise<{ filename: string; content: string }>;
}

// Serialize IndexedDB writes so points are stored in order even when fixes arrive quickly
let writeQueue: Promise<unknown> = Promise.resolve();
const enqueue = <T>(task: () => Promise<T>): Promise<T> => {
  const next = writeQueue.then(task, task);
  writeQueue = next.catch(() => undefined);
  return next;
};

const isOnline = () => typeof navigator === 'undefined' || navigator.onLine;

const defaultTrackName = (date = new Date()) =>
  `Track ${date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })} ${date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err));

const idleState = {
  activeTrack: null,
  activePoints: [],
  accumulator: createAccumulator(),
  currentSegment: 0,
  currentFix: null,
  gpsStatus: 'idle' as GpsStatus,
  viewing: null,
};

export const useTrackRecorderStore = create<TrackRecorderStore>((set, get) => {
  // Persist a track and mirror it into the list
  const persistTrack = async (track: RecordedTrack) => {
    await enqueue(() => localDb.saveTrack(track));
    set((state) => ({
      activeTrack: state.activeTrack?.id === track.id ? track : state.activeTrack,
      tracks: [track, ...state.tracks.filter((t) => t.id !== track.id)].sort((a, b) => b.startedAt - a.startedAt),
    }));
  };

  const findTrack = async (trackId: string) => {
    const { activeTrack, tracks } = get();
    if (activeTrack?.id === trackId) return activeTrack;
    return (await localDb.getTrack(trackId)) ?? tracks.find((t) => t.id === trackId) ?? null;
  };

  const loadPoints = async (track: RecordedTrack) =>
    track.syncStatus === 'remote' ? cloud.fetchRemotePoints(track.id) : localDb.getPoints(track.id);

  return {
    userId: null,
    isPanelOpen: false,
    setPanelOpen: (open) => set({ isPanelOpen: open }),
    togglePanel: () => set((state) => ({ isPanelOpen: !state.isPanelOpen })),

    ...idleState,
    setGpsStatus: (status) => set({ gpsStatus: status }),

    tracks: [],
    isLoadingTracks: false,
    error: null,
    clearError: () => set({ error: null }),

    init: async (userId) => {
      if (get().userId === userId) return;
      set({ userId, ...idleState, tracks: [], error: null });

      // Recover a recording that was interrupted (reload, crash, app closed)
      const unfinished = await localDb.findUnfinishedTrack(userId);
      if (unfinished) {
        const points = await localDb.getPoints(unfinished.id);
        const accumulator = accumulatePoints(points);
        const lastPoint = points[points.length - 1];
        const interruptedRunMs =
          unfinished.status === 'recording' && unfinished.lastResumedAt && lastPoint
            ? Math.max(0, lastPoint.timestamp - unfinished.lastResumedAt)
            : 0;
        const recovered: RecordedTrack = {
          ...unfinished,
          ...accumulator.stats,
          status: 'paused',
          elapsedMs: unfinished.elapsedMs + interruptedRunMs,
          lastResumedAt: null,
          updatedAt: Date.now(),
        };
        set({
          activeTrack: recovered,
          activePoints: points,
          accumulator,
          currentSegment: lastPoint ? lastPoint.segment : 0,
          isPanelOpen: true,
        });
        await enqueue(() => localDb.saveTrack(recovered));
      }

      await get().loadTracks();
    },

    reset: () => set({ userId: null, ...idleState, tracks: [], isPanelOpen: false, error: null }),

    startTrack: async (name, mode) => {
      const { userId, activeTrack } = get();
      if (!userId || activeTrack) return;
      const now = Date.now();
      const track: RecordedTrack = {
        id: crypto.randomUUID(),
        userId,
        name: name.trim() || defaultTrackName(new Date(now)),
        mode,
        status: 'recording',
        startedAt: now,
        endedAt: null,
        elapsedMs: 0,
        lastResumedAt: now,
        ...emptyStats(),
        syncStatus: mode === 'online' ? 'pending' : 'local',
        syncError: null,
        syncedAt: null,
        updatedAt: now,
      };
      set({
        activeTrack: track,
        activePoints: [],
        accumulator: createAccumulator(),
        currentSegment: 0,
        viewing: null,
        error: null,
      });
      await persistTrack(track);
    },

    pauseTrack: async () => {
      const track = get().activeTrack;
      if (!track || track.status !== 'recording') return;
      const now = Date.now();
      const paused: RecordedTrack = {
        ...track,
        status: 'paused',
        elapsedMs: track.elapsedMs + (track.lastResumedAt ? now - track.lastResumedAt : 0),
        lastResumedAt: null,
        updatedAt: now,
      };
      await persistTrack(paused);
    },

    resumeTrack: async () => {
      const track = get().activeTrack;
      if (!track || track.status !== 'paused') return;
      const now = Date.now();
      // A new segment keeps the line and distance from bridging the pause
      set((state) => ({ currentSegment: state.activePoints.length > 0 ? state.currentSegment + 1 : state.currentSegment }));
      await persistTrack({ ...track, status: 'recording', lastResumedAt: now, updatedAt: now });
    },

    stopTrack: async () => {
      const track = get().activeTrack;
      if (!track) return;
      const now = Date.now();
      const completed: RecordedTrack = {
        ...track,
        status: 'completed',
        endedAt: now,
        elapsedMs: track.elapsedMs + (track.status === 'recording' && track.lastResumedAt ? now - track.lastResumedAt : 0),
        lastResumedAt: null,
        updatedAt: now,
      };
      await persistTrack(completed);
      set({ ...idleState, gpsStatus: 'idle' });
      if (completed.mode === 'online') await get().syncTrack(completed.id);
    },

    discardTrack: async () => {
      const track = get().activeTrack;
      if (!track) return;
      set({ ...idleState });
      await enqueue(() => localDb.deleteTrack(track.id));
      set((state) => ({ tracks: state.tracks.filter((t) => t.id !== track.id) }));
      // Online recordings may already have a partial cloud copy
      if (track.syncedAt) {
        try {
          await cloud.deleteRemoteTrack(track.id);
        } catch (err) {
          set({ error: `Track discarded on this device, but the cloud copy could not be removed: ${errorMessage(err)}` });
        }
      }
    },

    recordFix: (fix) => {
      const { activeTrack, accumulator, currentSegment } = get();
      set({ currentFix: fix, gpsStatus: 'ok' });
      if (!activeTrack || activeTrack.status !== 'recording') return;

      const point: TrackPoint = { ...fix, segment: currentSegment };
      if (shouldRejectPoint(accumulator.lastPoint, point)) return;

      const nextAcc = accumulatePoint(accumulator, point);
      const seq = nextAcc.stats.pointCount - 1;
      const updated: RecordedTrack = {
        ...activeTrack,
        ...nextAcc.stats,
        syncStatus: activeTrack.mode === 'online' ? 'pending' : activeTrack.syncStatus,
        updatedAt: point.timestamp,
      };

      set((state) => ({
        accumulator: nextAcc,
        activePoints: [...state.activePoints, point],
        activeTrack: updated,
      }));
      enqueue(async () => {
        await localDb.addPoint(updated.id, seq, point);
        // Save the latest in-memory state; skip if the track was stopped or discarded meanwhile
        const latest = get().activeTrack;
        if (latest?.id === updated.id) await localDb.saveTrack(latest);
      }).catch((err) => set({ error: `Failed to save GPS point on device: ${errorMessage(err)}` }));
    },

    syncTrack: async (trackId) => {
      const track = await findTrack(trackId);
      if (!track || track.syncStatus === 'remote') return;
      if (!isOnline()) {
        await persistTrack({ ...track, syncStatus: track.syncStatus === 'local' ? 'local' : 'pending' });
        return;
      }

      const snapshotUpdatedAt = track.updatedAt;
      try {
        await writeQueue;
        const points = await localDb.getPoints(track.id);
        await cloud.uploadTrack(track, points);
        const latest = (await findTrack(trackId)) ?? track;
        // Points recorded during the upload still need another sync
        const stillDirty = latest.updatedAt > snapshotUpdatedAt;
        await persistTrack({
          ...latest,
          syncStatus: stillDirty ? 'pending' : 'synced',
          syncError: null,
          syncedAt: Date.now(),
        });
      } catch (err) {
        const latest = (await findTrack(trackId)) ?? track;
        await persistTrack({ ...latest, syncStatus: 'error', syncError: errorMessage(err) });
      }
    },

    syncPending: async () => {
      const { tracks, activeTrack } = get();
      // Offline-mode tracks are only uploaded on request; online-mode tracks retry automatically.
      // The active recording is synced separately by the service.
      const pending = tracks.filter(
        (t) =>
          t.id !== activeTrack?.id &&
          t.mode === 'online' &&
          (t.syncStatus === 'pending' || t.syncStatus === 'error'),
      );
      for (const track of pending) await get().syncTrack(track.id);
    },

    loadTracks: async () => {
      const { userId } = get();
      if (!userId) return;
      set({ isLoadingTracks: true });
      try {
        const local = await localDb.listTracks(userId);
        let merged = local;
        if (isOnline()) {
          try {
            const remote = await cloud.fetchRemoteTracks(userId);
            const localIds = new Set(local.map((t) => t.id));
            merged = [...local, ...remote.filter((t) => !localIds.has(t.id))];
          } catch (err) {
            set({ error: `Could not load cloud tracks: ${errorMessage(err)}` });
          }
        }
        if (get().userId !== userId) return;
        set({ tracks: merged.sort((a, b) => b.startedAt - a.startedAt) });
      } finally {
        set({ isLoadingTracks: false });
      }
    },

    viewTrack: async (trackId) => {
      const track = await findTrack(trackId);
      if (!track) return;
      try {
        const points = await loadPoints(track);
        set({ viewing: { track, points } });
      } catch (err) {
        set({ error: `Could not load track: ${errorMessage(err)}` });
      }
    },

    closeView: () => set({ viewing: null }),

    renameTrack: async (trackId, name) => {
      const trimmed = name.trim().slice(0, 120);
      const track = await findTrack(trackId);
      if (!track || !trimmed || trimmed === track.name) return;
      try {
        if (track.syncStatus === 'remote' || track.syncedAt) await cloud.renameRemoteTrack(trackId, trimmed);
      } catch (err) {
        set({ error: `Could not rename cloud copy: ${errorMessage(err)}` });
        return;
      }
      const renamed = { ...track, name: trimmed };
      if (track.syncStatus === 'remote') {
        set((state) => ({ tracks: state.tracks.map((t) => (t.id === trackId ? renamed : t)) }));
      } else {
        await persistTrack(renamed);
      }
      set((state) => (state.viewing?.track.id === trackId ? { viewing: { ...state.viewing, track: renamed } } : {}));
    },

    deleteTrack: async (trackId) => {
      const track = await findTrack(trackId);
      if (!track || get().activeTrack?.id === trackId) return;
      // Remove the cloud copy first so a failed request never leaves an orphan behind
      if (track.syncStatus === 'remote' || track.syncedAt) {
        try {
          await cloud.deleteRemoteTrack(trackId);
        } catch (err) {
          set({ error: `Could not delete cloud copy (are you online?): ${errorMessage(err)}` });
          return;
        }
      }
      if (track.syncStatus !== 'remote') await enqueue(() => localDb.deleteTrack(trackId));
      set((state) => ({
        tracks: state.tracks.filter((t) => t.id !== trackId),
        viewing: state.viewing?.track.id === trackId ? null : state.viewing,
      }));
    },

    exportGpx: async (trackId) => {
      const track = await findTrack(trackId);
      if (!track) throw new Error('Track not found');
      const points = get().activeTrack?.id === trackId ? get().activePoints : await loadPoints(track);
      const safeName = track.name.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_') || 'track';
      return { filename: `${safeName}.gpx`, content: buildGpx(track, points) };
    },
  };
});
