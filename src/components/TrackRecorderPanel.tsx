import { useEffect, useMemo, useState } from "react";
import {
  Circle,
  CloudUpload,
  Download,
  Eye,
  EyeOff,
  Loader2,
  Pause,
  Pencil,
  Play,
  RefreshCw,
  Square,
  Trash2,
  Wifi,
  WifiOff,
  X,
  Check,
  Footprints,
  Lock,
  Share2,
  LogOut,
} from "lucide-react";
import { useSurveyStore } from "../store/useSurveyStore";
import { canRecordTracks, canRenameCloudTracks, useTrackRecorderStore } from "../store/useTrackRecorderStore";
import { TrackShareManager } from "./TrackShareManager";
import { NativeAppNotice, NATIVE_REASONS } from "./NativeAppNotice";
import { CONTACT_ADMIN_LABEL } from "../config";
import {
  formatDistance,
  formatDuration,
  getElapsedMs,
} from "../utils/trackRecorderGeo";
import type { GpsStatus, RecordedTrack, TrackSyncStatus } from "../types/trackRecorder";

const SYNC_BADGES: Record<TrackSyncStatus, { label: string; className: string }> = {
  local: { label: "Device only", className: "bg-sand-100 text-sand-700 border-sand-300" },
  pending: { label: "Waiting to sync", className: "bg-gold-50 text-gold-700 border-gold-200" },
  synced: { label: "Synced", className: "bg-forest-50 text-forest-700 border-forest-200" },
  error: { label: "Sync failed", className: "bg-brick-50 text-brick-600 border-brick-200" },
  remote: { label: "Cloud", className: "bg-forest-50 text-forest-700 border-forest-200" },
};

const GPS_LABELS: Record<GpsStatus, string> = {
  idle: "GPS idle",
  searching: "Searching for GPS signal...",
  ok: "GPS locked",
  denied: "Location permission denied. Allow location access in your browser settings, then press Resume.",
  unavailable: "GPS unavailable on this device",
  error: "GPS error",
};

const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return isOnline;
};

// Re-render every second while a recording runs so the timer stays live
const useNow = (active: boolean) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
};

const avgSpeedKmh = (track: Pick<RecordedTrack, "distanceM" | "movingTimeMs">) =>
  track.movingTimeMs > 0 ? (track.distanceM / (track.movingTimeMs / 1000)) * 3.6 : 0;

const downloadFile = (filename: string, content: string, type: string) => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="bg-sand-50 border border-sand-100 rounded-lg p-2">
    <div className="text-[9px] uppercase tracking-wider text-sand-500 font-bold">{label}</div>
    <div className="text-sm font-bold font-mono text-ink">{value}</div>
  </div>
);

export const TrackRecorderPanel = () => {
  const { user, subscriptionStatus, isAdmin } = useSurveyStore();
  const canRecord = canRecordTracks({ hasUser: !!user, subscriptionStatus, isAdmin });
  const canRenameCloud = canRenameCloudTracks({ hasUser: !!user, subscriptionStatus, isAdmin });

  const {
    isPanelOpen,
    setPanelOpen,
    activeTrack,
    currentFix,
    gpsStatus,
    tracks,
    isLoadingTracks,
    viewing,
    error,
    clearError,
    pauseTrack,
    resumeTrack,
    stopTrack,
    discardTrack,
    syncTrack,
    loadTracks,
    viewTrack,
    closeView,
    renameTrack,
    deleteTrack,
    exportGpx,
    sharedTracks,
    isLoadingShared,
    loadSharedTracks,
    leaveSharedTrack,
  } = useTrackRecorderStore();

  const isOnline = useOnlineStatus();
  const isRecording = activeTrack?.status === "recording";
  const now = useNow(!!activeTrack);

  const [tab, setTab] = useState<"record" | "tracks" | "shared">("record");
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [confirmLeaveId, setConfirmLeaveId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"stop" | "discard" | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // The list shows live stats for the track being recorded
  const listedTracks = useMemo(
    () => tracks.map((t) => (t.id === activeTrack?.id ? activeTrack : t)),
    [tracks, activeTrack],
  );

  // Everyone signed in can view own and shared tracks; recording is Enterprise/admin only
  if (!user) return null;

  const runBusy = async (id: string, action: () => Promise<unknown>) => {
    setBusyId(id);
    try {
      await action();
    } finally {
      setBusyId(null);
    }
  };

  const handleExport = (id: string) =>
    runBusy(id, async () => {
      try {
        const { filename, content } = await exportGpx(id);
        downloadFile(filename, content, "application/gpx+xml");
      } catch (err) {
        useTrackRecorderStore.setState({ error: `Export failed: ${(err as Error).message}` });
      }
    });

  const elapsed = activeTrack ? getElapsedMs(activeTrack, now) : 0;

  // Compact indicator while the panel is closed during a recording
  if (!isPanelOpen) {
    if (!activeTrack) return null;
    return (
      <button
        onClick={() => setPanelOpen(true)}
        className="cursor-pointer fixed z-[60] bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full bg-white/95 backdrop-blur-md border border-ember-300 text-ink text-xs font-mono shadow-2xl"
        title="Open Track Recorder"
      >
        <Circle
          size={10}
          className={isRecording ? "fill-brick-500 text-brick-600 animate-pulse" : "fill-gold-400 text-gold-700"}
        />
        <span className="font-bold">{isRecording ? "REC" : "PAUSED"}</span>
        <span>{formatDuration(elapsed)}</span>
        <span className="text-sand-600">·</span>
        <span>{formatDistance(activeTrack.distanceM)}</span>
      </button>
    );
  }

  return (
    <div className="fixed z-[60] left-3 right-3 bottom-3 md:left-1/2 md:right-auto md:-translate-x-1/2 md:bottom-6 md:w-[400px] max-h-[70vh] flex flex-col bg-white/95 md:bg-white/95 backdrop-blur-md border border-ember-200 rounded-xl text-ink shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-sand-200 shrink-0">
        <div className="flex items-center gap-2">
          <Footprints size={16} className="text-ember-700" />
          <h3 className="text-sm font-bold">Track Recorder</h3>
          <span
            className={`flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full border ${
              isOnline
                ? "bg-forest-50 text-forest-700 border-forest-200"
                : "bg-brick-50 text-brick-600 border-brick-200"
            }`}
          >
            {isOnline ? <Wifi size={10} /> : <WifiOff size={10} />}
            {isOnline ? "Online" : "No signal"}
          </span>
        </div>
        <button
          onClick={() => setPanelOpen(false)}
          className="cursor-pointer p-1.5 rounded-lg hover:bg-sand-100 text-sand-600 hover:text-ink transition-colors"
          title={activeTrack ? "Hide (recording continues)" : "Close"}
        >
          <X size={16} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-2 border-b border-sand-100 shrink-0">
        {(["record", "tracks", "shared"] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              if (t === "tracks") loadTracks();
              if (t === "shared") loadSharedTracks();
            }}
            className={`cursor-pointer flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
              tab === t ? "bg-ember-50 text-ember-700" : "text-sand-600 hover:bg-sand-50"
            }`}
          >
            {t === "record"
              ? "Record"
              : t === "tracks"
                ? `My Tracks (${tracks.length})`
                : `Shared (${sharedTracks.length})`}
          </button>
        ))}
      </div>

      {error && (
        <div className="mx-3 mt-2 text-[11px] p-2 rounded-lg border bg-brick-50 border-brick-200 text-brick-600 flex justify-between items-start gap-2 shrink-0">
          <span>{error}</span>
          <button onClick={clearError} className="cursor-pointer text-brick-600 hover:text-ink shrink-0">
            <X size={12} />
          </button>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-3">
        {tab === "record" && !activeTrack && !canRecord && (
          <div className="py-6 px-2 text-center space-y-2">
            <div className="mx-auto w-10 h-10 rounded-xl bg-sand-50 border border-sand-200 flex items-center justify-center text-sand-600">
              <Lock size={18} />
            </div>
            <p className="text-xs text-sand-700">Recording tracks is available for Enterprise accounts.</p>
            <p className="text-[11px] text-sand-500">
              <strong className="text-ember-700">{CONTACT_ADMIN_LABEL}</strong> to enable recording. You can still view your
              tracks and tracks shared with you.
            </p>
          </div>
        )}

        {/* Recording runs in the mobile app (GPS with the screen off); the web views tracks */}
        {tab === "record" && !activeTrack && canRecord && (
          <NativeAppNotice feature="Track recording" reason={NATIVE_REASONS.track} />
        )}

        {tab === "record" && activeTrack && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Circle
                    size={10}
                    className={isRecording ? "fill-brick-500 text-brick-600 animate-pulse" : "fill-gold-400 text-gold-700"}
                  />
                  <span className="text-xs font-bold">{isRecording ? "Recording" : "Paused"}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-sand-100 text-sand-700 uppercase">
                    {activeTrack.mode}
                  </span>
                </div>
                <div className="text-[11px] text-sand-600 truncate">{activeTrack.name}</div>
              </div>
              <div className="text-2xl font-bold font-mono">{formatDuration(elapsed)}</div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Stat label="Distance" value={formatDistance(activeTrack.distanceM)} />
              <Stat label="Moving" value={formatDuration(activeTrack.movingTimeMs)} />
              <Stat label="Avg speed" value={`${avgSpeedKmh(activeTrack).toFixed(1)} km/h`} />
              <Stat label="Gain" value={`↑ ${Math.round(activeTrack.elevationGainM)} m`} />
              <Stat label="Loss" value={`↓ ${Math.round(activeTrack.elevationLossM)} m`} />
              <Stat
                label="Altitude"
                value={currentFix?.alt != null ? `${Math.round(currentFix.alt)} m` : "—"}
              />
            </div>

            <div className="text-[10px] text-sand-600 space-y-0.5">
              <div className={gpsStatus === "denied" || gpsStatus === "unavailable" ? "text-brick-600" : ""}>
                {GPS_LABELS[gpsStatus]}
                {gpsStatus === "ok" && currentFix && ` · ±${Math.round(currentFix.accuracy)} m`}
                {` · ${activeTrack.pointCount} points`}
              </div>
              <div>
                {activeTrack.mode === "offline"
                  ? "Saved on this device"
                  : activeTrack.syncStatus === "synced" && activeTrack.syncedAt
                    ? `Synced to cloud at ${new Date(activeTrack.syncedAt).toLocaleTimeString()}`
                    : activeTrack.syncStatus === "error"
                      ? `Cloud sync failed, will retry: ${activeTrack.syncError ?? ""}`
                      : isOnline
                        ? "Syncing to cloud periodically"
                        : "Saved on device · will sync when back online"}
              </div>
            </div>

            {confirm ? (
              <div className="p-3 rounded-xl bg-sand-50 border border-sand-200 space-y-2">
                <p className="text-xs">
                  {confirm === "stop"
                    ? "Finish and save this track?"
                    : "Discard this recording? All points will be deleted."}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirm(null)}
                    className="cursor-pointer flex-1 py-2 rounded-lg bg-sand-50 hover:bg-sand-100 text-xs text-sand-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      setConfirm(null);
                      if (confirm === "stop") {
                        await stopTrack();
                        setTab("tracks");
                      } else {
                        await discardTrack();
                      }
                    }}
                    className={`cursor-pointer flex-1 py-2 rounded-lg text-xs font-bold text-ink transition-colors ${
                      confirm === "stop" ? "bg-forest-800 hover:bg-forest-700" : "bg-brick-600 hover:bg-brick-500"
                    }`}
                  >
                    {confirm === "stop" ? "Save Track" : "Discard"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={isRecording ? pauseTrack : resumeTrack}
                  disabled={!isRecording && !canRecord}
                  title={!isRecording && !canRecord ? `Recording requires Enterprise. ${CONTACT_ADMIN_LABEL}` : undefined}
                  className="cursor-pointer flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-sand-100 hover:bg-sand-200 text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isRecording ? <Pause size={14} /> : <Play size={14} />}
                  {isRecording ? "Pause" : "Resume"}
                </button>
                <button
                  onClick={() => setConfirm("stop")}
                  className="cursor-pointer flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-forest-800 hover:bg-forest-700 text-xs font-bold transition-colors"
                >
                  <Square size={12} className="fill-white" /> Finish
                </button>
                <button
                  onClick={() => setConfirm("discard")}
                  className="cursor-pointer flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-brick-50 hover:bg-brick-50 text-brick-600 border border-brick-200 text-xs font-bold transition-colors"
                >
                  <Trash2 size={14} /> Discard
                </button>
              </div>
            )}
          </div>
        )}

        {tab === "tracks" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-sand-500">
                {isOnline ? "Device and cloud tracks" : "Device tracks (offline)"}
              </span>
              <button
                onClick={loadTracks}
                disabled={isLoadingTracks}
                className="cursor-pointer p-1.5 rounded-lg hover:bg-sand-100 text-sand-600 hover:text-ink transition-colors disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCw size={14} className={isLoadingTracks ? "animate-spin" : ""} />
              </button>
            </div>

            {listedTracks.length === 0 ? (
              <div className="py-8 text-center text-xs text-sand-500">
                {isLoadingTracks ? "Loading tracks..." : "No tracks yet. Start your first recording."}
              </div>
            ) : (
              listedTracks.map((t, index) => {
                const isActive = t.id === activeTrack?.id;
                const isViewing = viewing?.track.id === t.id;
                const isBusy = busyId === t.id;
                const canUpload =
                  canRecord &&
                  !isActive &&
                  isOnline &&
                  (t.syncStatus === "local" || t.syncStatus === "pending" || t.syncStatus === "error");
                const badge = SYNC_BADGES[t.syncStatus];
                // Same rule as renameTrack in the store: a track that reached the cloud is renamed there
                const isInCloud = t.syncStatus === "remote" || !!t.syncedAt;
                const canRename = !isInCloud || canRenameCloud;
                return (
                  <div
                    key={t.id}
                    className={`p-2.5 rounded-xl border transition-colors ${
                      isViewing ? "bg-forest-50 border-forest-200" : "bg-sand-50 border-sand-100"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="shrink-0 w-6 h-6 rounded-md bg-sand-50 border border-sand-200 flex items-center justify-center text-[10px] font-mono text-sand-600">
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        {renamingId === t.id ? (
                          <input
                            autoFocus
                            value={renameValue}
                            maxLength={120}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={async (e) => {
                              if (e.key === "Enter") {
                                await renameTrack(t.id, renameValue);
                                setRenamingId(null);
                              } else if (e.key === "Escape") {
                                setRenamingId(null);
                              }
                            }}
                            className="w-full bg-sand-100 border border-ember-300 rounded px-2 py-0.5 text-xs text-ink outline-none"
                          />
                        ) : (
                          <div className="text-xs font-bold truncate">{t.name}</div>
                        )}
                        <div className="text-[10px] text-sand-600">
                          {new Date(t.startedAt).toLocaleString()} · {formatDistance(t.distanceM)} ·{" "}
                          {formatDuration(isActive ? elapsed : t.elapsedMs)} · ↑ {Math.round(t.elevationGainM)} m
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                          {isActive ? (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full border bg-brick-50 text-brick-600 border-brick-200">
                              Recording
                            </span>
                          ) : (
                            <span
                              className={`text-[9px] px-1.5 py-0.5 rounded-full border ${badge.className}`}
                              title={t.syncError ?? undefined}
                            >
                              {badge.label}
                            </span>
                          )}
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-sand-50 text-sand-600 uppercase">
                            {t.mode}
                          </span>
                        </div>
                      </div>
                    </div>

                    {!isActive && (
                      <div className="flex items-center justify-end gap-1 mt-2">
                        {isBusy && <Loader2 size={14} className="animate-spin text-sand-600 mr-1" />}
                        {renamingId === t.id ? (
                          <button
                            onClick={async () => {
                              await renameTrack(t.id, renameValue);
                              setRenamingId(null);
                            }}
                            className="cursor-pointer p-1.5 rounded-lg hover:bg-sand-100 text-forest-700 transition-colors"
                            title="Save name"
                          >
                            <Check size={14} />
                          </button>
                        ) : confirmDeleteId === t.id ? (
                          <>
                            <span className="text-[10px] text-brick-600 mr-1">
                              Delete{t.syncStatus === "local" ? "" : " (also from cloud)"}?
                            </span>
                            <button
                              onClick={() =>
                                runBusy(t.id, async () => {
                                  await deleteTrack(t.id);
                                  setConfirmDeleteId(null);
                                })
                              }
                              className="cursor-pointer p-1.5 rounded-lg bg-brick-50 hover:bg-brick-100 text-brick-600 transition-colors"
                              title="Confirm delete"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="cursor-pointer p-1.5 rounded-lg hover:bg-sand-100 text-sand-600 transition-colors"
                              title="Cancel"
                            >
                              <X size={14} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => (isViewing ? closeView() : runBusy(t.id, () => viewTrack(t.id)))}
                              disabled={isBusy}
                              className="cursor-pointer p-1.5 rounded-lg hover:bg-sand-100 text-sand-700 transition-colors disabled:opacity-50"
                              title={isViewing ? "Hide from map" : "Show on map"}
                            >
                              {isViewing ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                            <button
                              onClick={() => handleExport(t.id)}
                              disabled={isBusy || (t.syncStatus === "remote" && !isOnline)}
                              className="cursor-pointer p-1.5 rounded-lg hover:bg-sand-100 text-sand-700 transition-colors disabled:opacity-50"
                              title="Export GPX"
                            >
                              <Download size={14} />
                            </button>
                            {canRecord && (
                              <button
                                onClick={() => setSharingId(sharingId === t.id ? null : t.id)}
                                disabled={isBusy || !isOnline}
                                className={`cursor-pointer p-1.5 rounded-lg hover:bg-sand-100 transition-colors disabled:opacity-50 ${
                                  sharingId === t.id ? "text-ember-700 bg-sand-100" : "text-sand-700"
                                }`}
                                title={isOnline ? "Share" : "Connect to the internet to share"}
                              >
                                <Share2 size={14} />
                              </button>
                            )}
                            {canUpload && (
                              <button
                                onClick={() => runBusy(t.id, () => syncTrack(t.id))}
                                disabled={isBusy}
                                className="cursor-pointer p-1.5 rounded-lg hover:bg-sand-100 text-forest-700 transition-colors disabled:opacity-50"
                                title="Upload to cloud"
                              >
                                <CloudUpload size={14} />
                              </button>
                            )}
                            {canRename && (
                              <button
                                onClick={() => {
                                  setRenamingId(t.id);
                                  setRenameValue(t.name);
                                }}
                                disabled={isBusy}
                                className="cursor-pointer p-1.5 rounded-lg hover:bg-sand-100 text-sand-700 transition-colors disabled:opacity-50"
                                title="Rename"
                              >
                                <Pencil size={14} />
                              </button>
                            )}
                            <button
                              onClick={() => setConfirmDeleteId(t.id)}
                              disabled={isBusy}
                              className="cursor-pointer p-1.5 rounded-lg hover:bg-brick-50 text-brick-600 transition-colors disabled:opacity-50"
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    )}

                    {sharingId === t.id && !isActive && (
                      <TrackShareManager trackId={t.id} onClose={() => setSharingId(null)} />
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {tab === "shared" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-sand-500">Tracks other accounts shared with you (view only)</span>
              <button
                onClick={loadSharedTracks}
                disabled={isLoadingShared || !isOnline}
                className="cursor-pointer p-1.5 rounded-lg hover:bg-sand-100 text-sand-600 hover:text-ink transition-colors disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCw size={14} className={isLoadingShared ? "animate-spin" : ""} />
              </button>
            </div>

            {!isOnline && (
              <p className="text-[10px] text-gold-700">Shared tracks need an internet connection.</p>
            )}

            {sharedTracks.length === 0 ? (
              <div className="py-8 text-center text-xs text-sand-500">
                {isLoadingShared ? "Loading shared tracks..." : "No tracks have been shared with you yet."}
              </div>
            ) : (
              sharedTracks.map((t, index) => {
                const isViewing = viewing?.track.id === t.id;
                const isBusy = busyId === t.id;
                const inProgress = t.status !== "completed";
                return (
                  <div
                    key={t.id}
                    className={`p-2.5 rounded-xl border transition-colors ${
                      isViewing ? "bg-forest-50 border-forest-200" : "bg-sand-50 border-sand-100"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="shrink-0 w-6 h-6 rounded-md bg-sand-50 border border-sand-200 flex items-center justify-center text-[10px] font-mono text-sand-600">
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold truncate">{t.name}</div>
                        <div className="text-[10px] text-ember-700 truncate">by {t.ownerEmail ?? "unknown"}</div>
                        <div className="text-[10px] text-sand-600">
                          {new Date(t.startedAt).toLocaleString()} · {formatDistance(t.distanceM)} ·{" "}
                          {formatDuration(t.elapsedMs)} · ↑ {Math.round(t.elevationGainM)} m
                        </div>
                        {inProgress && (
                          <span className="inline-block mt-1 text-[9px] px-1.5 py-0.5 rounded-full border bg-brick-50 text-brick-600 border-brick-200">
                            In progress · updated {new Date(t.updatedAt).toLocaleTimeString()}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-1 mt-2">
                      {isBusy && <Loader2 size={14} className="animate-spin text-sand-600 mr-1" />}
                      {confirmLeaveId === t.id ? (
                        <>
                          <span className="text-[10px] text-brick-600 mr-1">Remove from your list?</span>
                          <button
                            onClick={() =>
                              runBusy(t.id, async () => {
                                await leaveSharedTrack(t.id);
                                setConfirmLeaveId(null);
                              })
                            }
                            className="cursor-pointer p-1.5 rounded-lg bg-brick-50 hover:bg-brick-100 text-brick-600 transition-colors"
                            title="Confirm"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={() => setConfirmLeaveId(null)}
                            className="cursor-pointer p-1.5 rounded-lg hover:bg-sand-100 text-sand-600 transition-colors"
                            title="Cancel"
                          >
                            <X size={14} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => (isViewing ? closeView() : runBusy(t.id, () => viewTrack(t.id)))}
                            disabled={isBusy || !isOnline}
                            className="cursor-pointer p-1.5 rounded-lg hover:bg-sand-100 text-sand-700 transition-colors disabled:opacity-50"
                            title={isViewing ? "Hide from map" : "Show on map"}
                          >
                            {isViewing ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                          <button
                            onClick={() => handleExport(t.id)}
                            disabled={isBusy || !isOnline}
                            className="cursor-pointer p-1.5 rounded-lg hover:bg-sand-100 text-sand-700 transition-colors disabled:opacity-50"
                            title="Export GPX"
                          >
                            <Download size={14} />
                          </button>
                          <button
                            onClick={() => setConfirmLeaveId(t.id)}
                            disabled={isBusy}
                            className="cursor-pointer p-1.5 rounded-lg hover:bg-brick-50 text-brick-600 transition-colors disabled:opacity-50"
                            title="Remove from my list"
                          >
                            <LogOut size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};
