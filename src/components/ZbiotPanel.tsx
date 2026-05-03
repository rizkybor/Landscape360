import { useEffect, useMemo, useState } from "react";
import { useZbiotStore } from "../store/useZbiotStore";

const toDateInput = (tsSec: number) => {
  const d = new Date(tsSec * 1000);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const fromDateInput = (s: string) => {
  const ms = Date.parse(s + "T00:00:00Z");
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
};

export const ZbiotPanel = () => {
  const {
    sid,
    isAuthLoading,
    authError,
    apiUrl,
    setApiUrl,
    restoreSession,
    login,
    logout,
    families,
    activeFamilyId,
    setActiveFamilyId,
    loadDevices,
    devices,
    isDevicesLoading,
    devicesError,
    refreshRunInfo,
    isRunInfoLoading,
    runInfoError,
    selectedSimei,
    setSelectedSimei,
    loadTrack,
    clearTrack,
    isTrackLoading,
    trackError,
    loadAlarms,
    alarms,
    isAlarmsLoading,
    alarmsError,
    fenceDraft,
    isPickingFenceCenter,
    setFencePicking,
    setFenceName,
    setFenceRadiusM,
    saveFenceCircle,
    isFenceSaving,
    fenceError,
  } = useZbiotStore();

  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [appType, setAppType] = useState<string>(() => {
    const v = import.meta.env.VITE_ZBIOT_APP_TYPE;
    return typeof v === "string" && v.trim() ? v.trim() : "";
  });

  const [deviceFilter, setDeviceFilter] = useState("");

  const [trackBegin, setTrackBegin] = useState(() =>
    toDateInput(Math.floor(Date.now() / 1000) - 24 * 3600),
  );
  const [trackEnd, setTrackEnd] = useState(() =>
    toDateInput(Math.floor(Date.now() / 1000)),
  );

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  useEffect(() => {
    if (sid) {
      useZbiotStore.getState().loadDevices();
      useZbiotStore.getState().refreshRunInfo();
      useZbiotStore.getState().loadAlarms();
    }
  }, [sid]);

  const filteredDevices = useMemo(() => {
    const q = deviceFilter.trim().toLowerCase();
    if (!q) return devices;
    return devices.filter((d) => {
      const name = (d.name || d.car_number || d.simei).toLowerCase();
      return name.includes(q);
    });
  }, [devices, deviceFilter]);

  return (
    <div className="absolute top-4 right-4 z-40 w-[22rem] max-w-[calc(100vw-2rem)]">
      <div className="rounded-2xl border border-white/10 bg-black/80 backdrop-blur-xl shadow-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
          <div className="text-sm font-bold text-white">ZBIoT Monitoring</div>
          {sid ? (
            <button
              type="button"
              onClick={() => logout()}
              className="text-[11px] font-semibold text-white/80 hover:text-white"
              disabled={isAuthLoading}
            >
              Logout
            </button>
          ) : null}
        </div>

        <div className="p-4 space-y-4">
          <div>
            <div className="text-[11px] text-white/70 mb-1">API URL</div>
            <input
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-blue-500/50"
              placeholder="https://api.zbiot.cc/mapi"
            />
            <div className="text-[10px] text-white/40 mt-1">
              Default: https://api.zbiot.cc/mapi
            </div>
            {typeof window !== "undefined" &&
            window.location?.protocol === "https:" &&
            apiUrl.trim().startsWith("http://") ? (
              <div className="text-[10px] text-amber-200/90 mt-1">
                Halaman HTTPS tidak bisa memanggil API HTTP (mixed content). Gunakan HTTPS jika tersedia.
              </div>
            ) : null}
          </div>

          {!sid ? (
            <div className="space-y-3">
              <div>
                <div className="text-[11px] text-white/70 mb-1">Account</div>
                <input
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-blue-500/50"
                  placeholder="username / phone / device"
                />
              </div>
              <div>
                <div className="text-[11px] text-white/70 mb-1">Password</div>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-blue-500/50"
                  type="password"
                  placeholder="password"
                />
              </div>
              <div>
                <div className="text-[11px] text-white/70 mb-1">App Type</div>
                <input
                  value={appType}
                  onChange={(e) => setAppType(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-blue-500/50"
                  type="number"
                />
                <div className="text-[10px] text-white/40 mt-1">
                  Opsional; beberapa akun/server memakainya untuk identifikasi aplikasi (channel).
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const raw = appType.trim();
                  const n = raw ? Number(raw) : null;
                  login({
                    account,
                    password,
                    type: raw && Number.isFinite(n as number) ? (n as number) : null,
                  });
                }}
                disabled={isAuthLoading || !account.trim() || !password}
                className="w-full rounded-xl px-3 py-2 text-xs font-bold border transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-blue-600/90 hover:bg-blue-600 border-blue-500/30 text-white"
              >
                {isAuthLoading ? "Logging in..." : "Login"}
              </button>
              {authError ? (
                <div className="text-[11px] text-red-300">{authError}</div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <div className="text-[11px] text-white/70 mb-1">Family</div>
                  <select
                    value={activeFamilyId ?? ""}
                    onChange={(e) =>
                      setActiveFamilyId(e.target.value ? e.target.value : null)
                    }
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-blue-500/50"
                  >
                    {families.length ? null : <option value="">(none)</option>}
                    {families.map((f) => (
                      <option key={f.sid} value={f.sid}>
                        {f.sname ? `${f.sname} (${f.sid.slice(0, 8)}...)` : f.sid}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => loadDevices()}
                  disabled={isDevicesLoading}
                  className="mt-5 rounded-lg px-3 py-2 text-[11px] font-semibold bg-white/5 border border-white/10 text-white/80 hover:text-white hover:bg-white/10"
                >
                  {isDevicesLoading ? "..." : "Devices"}
                </button>
                <button
                  type="button"
                  onClick={() => refreshRunInfo()}
                  disabled={isRunInfoLoading}
                  className="mt-5 rounded-lg px-3 py-2 text-[11px] font-semibold bg-white/5 border border-white/10 text-white/80 hover:text-white hover:bg-white/10"
                >
                  {isRunInfoLoading ? "..." : "Refresh"}
                </button>
              </div>

              {devicesError ? (
                <div className="text-[11px] text-red-300">{devicesError}</div>
              ) : null}
              {runInfoError ? (
                <div className="text-[11px] text-red-300">{runInfoError}</div>
              ) : null}

              <div>
                <div className="text-[11px] text-white/70 mb-1">Devices</div>
                <input
                  value={deviceFilter}
                  onChange={(e) => setDeviceFilter(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-blue-500/50"
                  placeholder="Cari device..."
                />
                <div className="mt-2 max-h-44 overflow-y-auto rounded-xl border border-white/10 bg-white/5">
                  {filteredDevices.length ? (
                    filteredDevices.slice(0, 200).map((d) => {
                      const label = d.name || d.car_number || d.simei;
                      const active = selectedSimei === d.simei;
                      return (
                        <button
                          key={d.simei}
                          type="button"
                          onClick={() => setSelectedSimei(d.simei)}
                          className={`w-full px-3 py-2 text-left text-xs border-b border-white/10 last:border-b-0 ${
                            active ? "bg-blue-500/20 text-white" : "text-white/80 hover:text-white hover:bg-white/10"
                          }`}
                        >
                          <div className="font-semibold">{label}</div>
                          <div className="text-[10px] text-white/40">{d.simei}</div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="px-3 py-3 text-xs text-white/50">
                      Tidak ada device.
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!selectedSimei) return;
                    const b = fromDateInput(trackBegin);
                    const e = fromDateInput(trackEnd);
                    if (!b || !e || e <= b) return;
                    loadTrack({ simei: selectedSimei, timeBegin: b, timeEnd: e });
                  }}
                  disabled={!selectedSimei || isTrackLoading}
                  className="rounded-xl px-3 py-2 text-xs font-bold bg-blue-600/90 hover:bg-blue-600 border border-blue-500/30 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isTrackLoading ? "Loading..." : "Load Track"}
                </button>
                <button
                  type="button"
                  onClick={() => clearTrack()}
                  className="rounded-xl px-3 py-2 text-xs font-bold bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white"
                >
                  Clear Track
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-[11px] text-white/70 mb-1">Begin</div>
                  <input
                    type="date"
                    value={trackBegin}
                    onChange={(e) => setTrackBegin(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-xs text-white outline-none focus:border-blue-500/50"
                  />
                </div>
                <div>
                  <div className="text-[11px] text-white/70 mb-1">End</div>
                  <input
                    type="date"
                    value={trackEnd}
                    onChange={(e) => setTrackEnd(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-xs text-white outline-none focus:border-blue-500/50"
                  />
                </div>
              </div>
              {trackError ? (
                <div className="text-[11px] text-red-300">{trackError}</div>
              ) : null}

              <div className="border-t border-white/10 pt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-white">Alarms</div>
                  <button
                    type="button"
                    onClick={() => loadAlarms()}
                    disabled={isAlarmsLoading}
                    className="rounded-lg px-3 py-1.5 text-[11px] font-semibold bg-white/5 border border-white/10 text-white/80 hover:text-white hover:bg-white/10"
                  >
                    {isAlarmsLoading ? "..." : "Refresh"}
                  </button>
                </div>
                {alarmsError ? (
                  <div className="text-[11px] text-red-300">{alarmsError}</div>
                ) : null}
                <div className="max-h-28 overflow-y-auto rounded-xl border border-white/10 bg-white/5">
                  {alarms.length ? (
                    alarms.slice(0, 20).map((a, idx) => (
                      <div
                        key={`${a.type ?? "alarm"}-${a.time ?? idx}-${idx}`}
                        className="px-3 py-2 border-b border-white/10 last:border-b-0"
                      >
                        <div className="text-xs text-white/90 font-semibold">
                          {a.type ?? "alarm"}
                        </div>
                        <div className="text-[10px] text-white/50">
                          {a.time ? new Date(a.time * 1000).toLocaleString() : ""}
                          {a.fencename ? ` • ${a.fencename}` : ""}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="px-3 py-3 text-xs text-white/50">
                      Tidak ada alarm.
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-white/10 pt-3 space-y-2">
                <div className="text-xs font-bold text-white">Geofence (Circle)</div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-[11px] text-white/70 mb-1">Name</div>
                    <input
                      value={fenceDraft.name}
                      onChange={(e) => setFenceName(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-xs text-white outline-none focus:border-blue-500/50"
                    />
                  </div>
                  <div>
                    <div className="text-[11px] text-white/70 mb-1">Radius (m)</div>
                    <input
                      value={String(fenceDraft.radiusM)}
                      onChange={(e) => setFenceRadiusM(Number(e.target.value))}
                      type="number"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-xs text-white outline-none focus:border-blue-500/50"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFencePicking(true)}
                    className={`rounded-xl px-3 py-2 text-xs font-bold border ${
                      isPickingFenceCenter
                        ? "bg-blue-600/90 border-blue-500/30 text-white"
                        : "bg-white/5 border-white/10 text-white/80 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    {isPickingFenceCenter ? "Click Map..." : "Pick Center"}
                  </button>
                  <button
                    type="button"
                    onClick={() => saveFenceCircle()}
                    disabled={isFenceSaving || !fenceDraft.center}
                    className="rounded-xl px-3 py-2 text-xs font-bold bg-blue-600/90 hover:bg-blue-600 border border-blue-500/30 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isFenceSaving ? "Saving..." : "Save Fence"}
                  </button>
                </div>
                {fenceDraft.center ? (
                  <div className="text-[10px] text-white/50">
                    Center: {fenceDraft.center.lat.toFixed(6)},{" "}
                    {fenceDraft.center.lng.toFixed(6)}
                  </div>
                ) : (
                  <div className="text-[10px] text-white/40">Center belum dipilih.</div>
                )}
                {fenceError ? (
                  <div className="text-[11px] text-red-300">{fenceError}</div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
