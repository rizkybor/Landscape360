import { useEffect, useRef } from 'react';
import { useSurveyStore } from '../store/useSurveyStore';
import { canRecordTracks, useTrackRecorderStore } from '../store/useTrackRecorderStore';
import { TRACK_RECORDER_CONFIG } from '../types/trackRecorder';

type WakeLockSentinel = {
  released: boolean;
  release: () => Promise<void>;
};

// Runs the Track Recorder in the background: account/access handling, the GPS watch while
// recording, screen wake lock, and automatic cloud sync for online-mode tracks.
// Mount once (MapBoxContainer).
export const useTrackRecorderService = () => {
  const { user, subscriptionStatus, isAdmin } = useSurveyStore();
  const userId = user?.id ?? null;
  const canRecord = canRecordTracks({ hasUser: !!user, subscriptionStatus, isAdmin });

  const activeId = useTrackRecorderStore((s) => s.activeTrack?.id ?? null);
  const activeStatus = useTrackRecorderStore((s) => s.activeTrack?.status ?? null);
  const activeMode = useTrackRecorderStore((s) => s.activeTrack?.mode ?? null);

  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const isRecording = activeStatus === 'recording';

  // Account changes: load this user's own and shared tracks, clear everything on logout
  useEffect(() => {
    const store = useTrackRecorderStore.getState();
    if (!userId) {
      store.reset();
      return;
    }
    store.init(userId);
  }, [userId]);

  // Losing recording access (plan change) pauses the recording instead of dropping data
  useEffect(() => {
    if (!canRecord && isRecording) useTrackRecorderStore.getState().pauseTrack();
  }, [canRecord, isRecording]);

  // GPS watch while recording
  useEffect(() => {
    if (!isRecording) return;
    const store = useTrackRecorderStore.getState();

    if (!('geolocation' in navigator)) {
      store.setGpsStatus('unavailable');
      store.pauseTrack();
      return;
    }

    store.setGpsStatus('searching');
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        useTrackRecorderStore.getState().recordFix({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          alt: pos.coords.altitude,
          accuracy: pos.coords.accuracy,
          speed: pos.coords.speed,
          timestamp: pos.timestamp,
        });
      },
      (err) => {
        const s = useTrackRecorderStore.getState();
        if (err.code === err.PERMISSION_DENIED) {
          s.setGpsStatus('denied');
          s.pauseTrack();
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          s.setGpsStatus('unavailable');
        } else {
          // Timeout: keep watching, the device is still looking for a fix
          s.setGpsStatus('searching');
        }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [isRecording, activeId]);

  // Keep the screen awake while recording (re-acquired when the tab becomes visible again)
  useEffect(() => {
    if (!isRecording) return;
    const wakeLock = (navigator as Navigator & {
      wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinel> };
    }).wakeLock;
    if (!wakeLock) return;

    const acquire = async () => {
      if (document.visibilityState !== 'visible') return;
      if (wakeLockRef.current && !wakeLockRef.current.released) return;
      try {
        wakeLockRef.current = await wakeLock.request('screen');
      } catch {
        // Not allowed (e.g. battery saver); recording continues without it
      }
    };

    acquire();
    document.addEventListener('visibilitychange', acquire);
    return () => {
      document.removeEventListener('visibilitychange', acquire);
      wakeLockRef.current?.release().catch(() => undefined);
      wakeLockRef.current = null;
    };
  }, [isRecording]);

  // Online mode: upload progress periodically while recording
  useEffect(() => {
    if (!isRecording || activeMode !== 'online' || !activeId) return;
    const interval = setInterval(() => {
      const { activeTrack, syncTrack } = useTrackRecorderStore.getState();
      if (navigator.onLine && activeTrack && activeTrack.syncStatus !== 'synced') {
        syncTrack(activeTrack.id);
      }
    }, TRACK_RECORDER_CONFIG.AUTO_SYNC_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isRecording, activeMode, activeId]);

  // Back online: retry pending uploads of online-mode tracks and refresh shared tracks
  useEffect(() => {
    if (!userId) return;
    const handleOnline = () => {
      const { activeTrack, syncTrack, syncPending, loadSharedTracks } = useTrackRecorderStore.getState();
      loadSharedTracks();
      if (!canRecord) return;
      syncPending();
      if (activeTrack?.mode === 'online') syncTrack(activeTrack.id);
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [userId, canRecord]);
};
