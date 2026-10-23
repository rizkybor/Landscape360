import { useEffect, useMemo, useState } from "react";
import {
  Circle,
  CloudUpload,
  Cloud,
  Download,
  Eye,
  EyeOff,
  HardDrive,
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
import { canRecordTracks, useTrackRecorderStore } from "../store/useTrackRecorderStore";
import { TrackShareManager } from "./TrackShareManager";
import { CONTACT_ADMIN_LABEL } from "../config";
import {
  formatDistance,
  formatDuration,
  getElapsedMs,
} from "../utils/trackRecorderGeo";
import type { GpsStatus, RecordedTrack, TrackMode, TrackSyncStatus } from "../types/trackRecorder";

const SYNC_BADGES: Record<TrackSyncStatus, { label: string; className: string }> = {
  local: { label: "Device only", className: "bg-gray-500/20 text-gray-300 border-gray-500/20" },
  pending: { label: "Waiting to sync", className: "bg-yellow-500/20 text-yellow-300 border-yellow-500/20" },
  synced: { label: "Synced", className: "bg-green-500/20 text-green-300 border-green-500/20" },
  error: { label: "Sync failed", className: "bg-red-500/20 text-red-300 border-red-500/20" },
  remote: { label: "Cloud", className: "bg-blue-500/20 text-blue-300 border-blue-500/20" },
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
  <div className="bg-white/5 border border-white/5 rounded-lg p-2">
    <div className="text-[9px] uppercase tracking-wider text-gray-500 font-bold">{label}</div>
    <div className="text-sm font-bold font-mono text-white">{value}</div>
  </div>
);

export const TrackRecorderPanel = () => {
  const { user, subscriptionStatus, isAdmin } = useSurveyStore();
  const canRecord = canRecordTracks({ hasUser: !!user, subscriptionStatus, isAdmin });

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
    startTrack,
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
  const [name, setName] = useState("");
  const [mode, setMode] = useState<TrackMode>("online");
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

  const handleStart = async () => {
    await startTrack(name, mode);
    setName("");
    setConfirm(null);
  };

  const elapsed = activeTrack ? getElapsedMs(activeTrack, now) : 0;

  // Compact indicator while the panel is closed during a recording
  if (!isPanelOpen) {
    if (!activeTrack) return null;
    return (
      <button
        onClick={() => setPanelOpen(true)}
        className="cursor-pointer fixed z-[60] bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full bg-black/80 backdrop-blur-md border border-orange-500/40 text-white text-xs font-mono shadow-2xl"
        title="Open Track Recorder"
      >
        <Circle
          size={10}
          className={isRecording ? "fill-red-500 text-red-500 animate-pulse" : "fill-yellow-500 text-yellow-500"}
        />
        <span className="font-bold">{isRecording ? "REC" : "PAUSED"}</span>
        <span>{formatDuration(elapsed)}</span>
        <span className="text-gray-400">·</span>
        <span>{formatDistance(activeTrack.distanceM)}</span>
      </button>
    );
  }

  return (
    <div className="fixed z-[60] left-3 right-3 bottom-3 md:left-1/2 md:right-auto md:-translate-x-1/2 md:bottom-6 md:w-[400px] max-h-[70vh] flex flex-col bg-black/90 md:bg-black/80 backdrop-blur-md border border-orange-500/30 rounded-xl text-white shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          <Footprints size={16} className="text-orange-400" />
          <h3 className="text-sm font-bold">Track Recorder</h3>
          <span
            className={`flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full border ${
              isOnline
                ? "bg-green-500/10 text-green-300 border-green-500/20"
                : "bg-red-500/10 text-red-300 border-red-500/20"
            }`}
          >
            {isOnline ? <Wifi size={10} /> : <WifiOff size={10} />}
            {isOnline ? "Online" : "No signal"}
          </span>
        </div>
        <button
          onClick={() => setPanelOpen(false)}
          className="cursor-pointer p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          title={activeTrack ? "Hide (recording continues)" : "Close"}
        >
          <X size={16} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-2 border-b border-white/5 shrink-0">
        {(["record", "tracks", "shared"] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              if (t === "tracks") loadTracks();
              if (t === "shared") loadSharedTracks();
            }}
            className={`cursor-pointer flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
              tab === t ? "bg-orange-500/20 text-orange-300" : "text-gray-400 hover:bg-white/5"
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
        <div className="mx-3 mt-2 text-[11px] p-2 rounded-lg border bg-red-500/10 border-red-500/30 text-red-300 flex justify-between items-start gap-2 shrink-0">
          <span>{error}</span>
          <button onClick={clearError} className="cursor-pointer text-red-400 hover:text-white shrink-0">
            <X size={12} />
          </button>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-3">
        {tab === "record" && !activeTrack && !canRecord && (
          <div className="py-6 px-2 text-center space-y-2">
            <div className="mx-auto w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400">
              <Lock size={18} />
            </div>
            <p className="text-xs text-gray-300">Recording tracks is available for Enterprise accounts.</p>
            <p className="text-[11px] text-gray-500">
              <strong className="text-orange-300">{CONTACT_ADMIN_LABEL}</strong> to enable recording. You can still view your
              tracks and tracks shared with you.
            </p>
          </div>
        )}

        {tab === "record" && !activeTrack && canRecord && (
          <div className="space-y-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              placeholder="Track name (optional)"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-gray-500 outline-none focus:border-orange-500/50"
            />
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { value: "online", icon: Cloud, title: "Online", desc: "Saved on device and synced to the cloud automatically" },
                  { value: "offline", icon: HardDrive, title: "Offline", desc: "Saved on this device only. Upload later if needed" },
                ] as const
              ).map(({ value, icon: Icon, title, desc }) => (
                <button
                  key={value}
                  onClick={() => setMode(value)}
                  className={`cursor-pointer text-left p-3 rounded-xl border transition-all ${
                    mode === value
                      ? "bg-orange-500/15 border-orange-500/50 ring-1 ring-orange-500/50"
                      : "bg-white/5 border-white/10 hover:border-white/20"
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold mb-1">
                    <Icon size={14} className={mode === value ? "text-orange-400" : "text-gray-400"} />
                    {title}
                  </div>
                  <div className="text-[10px] text-gray-400 leading-snug">{desc}</div>
                </button>
              ))}
            </div>
            {mode === "online" && !isOnline && (
              <p className="text-[10px] text-yellow-300/80">
                No signal right now. Recording works anyway; it will sync when the connection returns.
              </p>
            )}
            <button
              onClick={handleStart}
              className="cursor-pointer w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-sm font-bold shadow-lg shadow-orange-900/30 transition-colors"
            >
              <Circle size={12} className="fill-white" /> Start Recording
            </button>
          </div>
        )}

        {tab === "record" && activeTrack && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Circle
                    size={10}
                    className={isRecording ? "fill-red-500 text-red-500 animate-pulse" : "fill-yellow-500 text-yellow-500"}
                  />
                  <span className="text-xs font-bold">{isRecording ? "Recording" : "Paused"}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/10 text-gray-300 uppercase">
                    {activeTrack.mode}
                  </span>
                </div>
                <div className="text-[11px] text-gray-400 truncate">{activeTrack.name}</div>
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

            <div className="text-[10px] text-gray-400 space-y-0.5">
              <div className={gpsStatus === "denied" || gpsStatus === "unavailable" ? "text-red-300" : ""}>
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
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-2">
                <p className="text-xs">
                  {confirm === "stop"
                    ? "Finish and save this track?"
                    : "Discard this recording? All points will be deleted."}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirm(null)}
                    className="cursor-pointer flex-1 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-gray-300 transition-colors"
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
                    className={`cursor-pointer flex-1 py-2 rounded-lg text-xs font-bold text-white transition-colors ${
                      confirm === "stop" ? "bg-green-600 hover:bg-green-500" : "bg-red-600 hover:bg-red-500"
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
                  className="cursor-pointer flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isRecording ? <Pause size={14} /> : <Play size={14} />}
                  {isRecording ? "Pause" : "Resume"}
                </button>
                <button
                  onClick={() => setConfirm("stop")}
                  className="cursor-pointer flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-xs font-bold transition-colors"
                >
                  <Square size={12} className="fill-white" /> Finish
                </button>
                <button
                  onClick={() => setConfirm("discard")}
                  className="cursor-pointer flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-bold transition-colors"
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
              <span className="text-[10px] text-gray-500">
                {isOnline ? "Device and cloud tracks" : "Device tracks (offline)"}
              </span>
              <button
                onClick={loadTracks}
                disabled={isLoadingTracks}
                className="cursor-pointer p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCw size={14} className={isLoadingTracks ? "animate-spin" : ""} />
              </button>
            </div>

            {listedTracks.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-500">
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
                return (
                  <div
                    key={t.id}
                    className={`p-2.5 rounded-xl border transition-colors ${
                      isViewing ? "bg-cyan-500/10 border-cyan-500/30" : "bg-white/5 border-white/5"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="shrink-0 w-6 h-6 rounded-md bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-mono text-gray-400">
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
                            className="w-full bg-white/10 border border-orange-500/50 rounded px-2 py-0.5 text-xs text-white outline-none"
                          />
                        ) : (
                          <div className="text-xs font-bold truncate">{t.name}</div>
                        )}
                        <div className="text-[10px] text-gray-400">
                          {new Date(t.startedAt).toLocaleString()} · {formatDistance(t.distanceM)} ·{" "}
                          {formatDuration(isActive ? elapsed : t.elapsedMs)} · ↑ {Math.round(t.elevationGainM)} m
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                          {isActive ? (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full border bg-red-500/20 text-red-300 border-red-500/20">
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
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/5 text-gray-400 uppercase">
                            {t.mode}
                          </span>
                        </div>
                      </div>
                    </div>

                    {!isActive && (
                      <div className="flex items-center justify-end gap-1 mt-2">
                        {isBusy && <Loader2 size={14} className="animate-spin text-gray-400 mr-1" />}
                        {renamingId === t.id ? (
                          <button
                            onClick={async () => {
                              await renameTrack(t.id, renameValue);
                              setRenamingId(null);
                            }}
                            className="cursor-pointer p-1.5 rounded-lg hover:bg-white/10 text-green-400 transition-colors"
                            title="Save name"
                          >
                            <Check size={14} />
                          </button>
                        ) : confirmDeleteId === t.id ? (
                          <>
                            <span className="text-[10px] text-red-300 mr-1">
                              Delete{t.syncStatus === "local" ? "" : " (also from cloud)"}?
                            </span>
                            <button
                              onClick={() =>
                                runBusy(t.id, async () => {
                                  await deleteTrack(t.id);
                                  setConfirmDeleteId(null);
                                })
                              }
                              className="cursor-pointer p-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/40 text-red-400 transition-colors"
                              title="Confirm delete"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="cursor-pointer p-1.5 rounded-lg hover:bg-white/10 text-gray-400 transition-colors"
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
                              className="cursor-pointer p-1.5 rounded-lg hover:bg-white/10 text-gray-300 transition-colors disabled:opacity-50"
                              title={isViewing ? "Hide from map" : "Show on map"}
                            >
                              {isViewing ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                            <button
                              onClick={() => handleExport(t.id)}
                              disabled={isBusy || (t.syncStatus === "remote" && !isOnline)}
                              className="cursor-pointer p-1.5 rounded-lg hover:bg-white/10 text-gray-300 transition-colors disabled:opacity-50"
                              title="Export GPX"
                            >
                              <Download size={14} />
                            </button>
                            {canRecord && (
                              <button
                                onClick={() => setSharingId(sharingId === t.id ? null : t.id)}
                                disabled={isBusy || !isOnline}
                                className={`cursor-pointer p-1.5 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50 ${
                                  sharingId === t.id ? "text-orange-300 bg-white/10" : "text-gray-300"
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
                                className="cursor-pointer p-1.5 rounded-lg hover:bg-white/10 text-blue-400 transition-colors disabled:opacity-50"
                                title="Upload to cloud"
                              >
                                <CloudUpload size={14} />
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setRenamingId(t.id);
                                setRenameValue(t.name);
                              }}
                              disabled={isBusy}
                              className="cursor-pointer p-1.5 rounded-lg hover:bg-white/10 text-gray-300 transition-colors disabled:opacity-50"
                              title="Rename"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(t.id)}
                              disabled={isBusy}
                              className="cursor-pointer p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors disabled:opacity-50"
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
              <span className="text-[10px] text-gray-500">Tracks other accounts shared with you (view only)</span>
              <button
                onClick={loadSharedTracks}
                disabled={isLoadingShared || !isOnline}
                className="cursor-pointer p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCw size={14} className={isLoadingShared ? "animate-spin" : ""} />
              </button>
            </div>

            {!isOnline && (
              <p className="text-[10px] text-yellow-300/80">Shared tracks need an internet connection.</p>
            )}

            {sharedTracks.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-500">
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
                      isViewing ? "bg-cyan-500/10 border-cyan-500/30" : "bg-white/5 border-white/5"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="shrink-0 w-6 h-6 rounded-md bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-mono text-gray-400">
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold truncate">{t.name}</div>
                        <div className="text-[10px] text-orange-200/80 truncate">by {t.ownerEmail ?? "unknown"}</div>
                        <div className="text-[10px] text-gray-400">
                          {new Date(t.startedAt).toLocaleString()} · {formatDistance(t.distanceM)} ·{" "}
                          {formatDuration(t.elapsedMs)} · ↑ {Math.round(t.elevationGainM)} m
                        </div>
                        {inProgress && (
                          <span className="inline-block mt-1 text-[9px] px-1.5 py-0.5 rounded-full border bg-red-500/20 text-red-300 border-red-500/20">
                            In progress · updated {new Date(t.updatedAt).toLocaleTimeString()}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-1 mt-2">
                      {isBusy && <Loader2 size={14} className="animate-spin text-gray-400 mr-1" />}
                      {confirmLeaveId === t.id ? (
                        <>
                          <span className="text-[10px] text-red-300 mr-1">Remove from your list?</span>
                          <button
                            onClick={() =>
                              runBusy(t.id, async () => {
                                await leaveSharedTrack(t.id);
                                setConfirmLeaveId(null);
                              })
                            }
                            className="cursor-pointer p-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/40 text-red-400 transition-colors"
                            title="Confirm"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={() => setConfirmLeaveId(null)}
                            className="cursor-pointer p-1.5 rounded-lg hover:bg-white/10 text-gray-400 transition-colors"
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
                            className="cursor-pointer p-1.5 rounded-lg hover:bg-white/10 text-gray-300 transition-colors disabled:opacity-50"
                            title={isViewing ? "Hide from map" : "Show on map"}
                          >
                            {isViewing ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                          <button
                            onClick={() => handleExport(t.id)}
                            disabled={isBusy || !isOnline}
                            className="cursor-pointer p-1.5 rounded-lg hover:bg-white/10 text-gray-300 transition-colors disabled:opacity-50"
                            title="Export GPX"
                          >
                            <Download size={14} />
                          </button>
                          <button
                            onClick={() => setConfirmLeaveId(t.id)}
                            disabled={isBusy}
                            className="cursor-pointer p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors disabled:opacity-50"
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
