import { create } from "zustand";
import {
  getDefaultZbiotApiUrl,
  normalizeZbiotLatLon,
  parseZbiotLastPos,
  parseZbiotWgs,
  zbiotCall,
  zbiotPwdMd5,
} from "../lib/zbiotClient";

export type ZbiotLoginFlag =
  | "e_account_login"
  | "e_device_login"
  | "e_phone_device_login"
  | "e_phone_account_login";

export type ZbiotPlatform = "web" | "android" | "ios" | "wx";

export type ZbiotFamily = {
  sid: string;
  sname?: string;
  type?: string;
  imei_count?: number;
  raw: any;
};

export type ZbiotDevice = {
  simei: string;
  imei?: number | string;
  car_number?: string;
  name?: string;
  raw: any;
};

export type ZbiotPosition = {
  simei: string;
  lat: number;
  lng: number;
  addr?: string;
  time?: number;
  ptype?: string;
  source?: string;
  wgs?: string;
  power?: number;
  raw: any;
};

export type ZbiotAlarm = {
  imei?: number;
  simei?: string;
  time?: number;
  type?: string;
  fencename?: string;
  raw: any;
};

type ZbiotTrackPoint = { lng: number; lat: number; time?: number };

type ZbiotFenceDraft = {
  name: string;
  radiusM: number;
  center: { lng: number; lat: number } | null;
  fenceSwitch: "e_fence_in" | "e_fence_out" | "e_fence_in_out" | "e_fence_close";
};

interface ZbiotStore {
  isZbiotEnabled: boolean;
  apiUrl: string;
  sid: string | null;
  isAuthLoading: boolean;
  authError: string | null;

  families: ZbiotFamily[];
  activeFamilyId: string | null;

  devices: ZbiotDevice[];
  isDevicesLoading: boolean;
  devicesError: string | null;

  positionsBySimei: Record<string, ZbiotPosition>;
  lastRunInfoUpdateTime: number | null;
  isRunInfoLoading: boolean;
  runInfoError: string | null;

  selectedSimei: string | null;

  trackGeoJSON: GeoJSON.FeatureCollection | null;
  trackMeta:
    | { simei: string; timeBegin: number; timeEnd: number; pointCount: number }
    | null;
  isTrackLoading: boolean;
  trackError: string | null;

  alarms: ZbiotAlarm[];
  isAlarmsLoading: boolean;
  alarmsError: string | null;

  fenceDraft: ZbiotFenceDraft;
  isPickingFenceCenter: boolean;
  isFenceSaving: boolean;
  fenceError: string | null;

  setZbiotEnabled: (enabled: boolean) => void;
  setApiUrl: (apiUrl: string) => void;
  restoreSession: () => void;
  clearSession: () => void;

  login: (args: { account: string; password: string; type?: number | null }) => Promise<void>;
  logout: () => Promise<void>;

  setActiveFamilyId: (sfamily: string | null) => void;

  loadDevices: () => Promise<void>;
  refreshRunInfo: () => Promise<void>;

  setSelectedSimei: (simei: string | null) => void;

  loadTrack: (args: { simei: string; timeBegin: number; timeEnd: number }) => Promise<void>;
  clearTrack: () => void;

  loadAlarms: () => Promise<void>;

  setFencePicking: (picking: boolean) => void;
  setFenceCenter: (center: { lng: number; lat: number } | null) => void;
  setFenceName: (name: string) => void;
  setFenceRadiusM: (radiusM: number) => void;
  saveFenceCircle: () => Promise<void>;
}

const STORAGE_KEY = "L360_ZBIOT_SESSION";

const buildTrackGeoJSON = (pts: ZbiotTrackPoint[]): GeoJSON.FeatureCollection => ({
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: pts.map((p) => [p.lng, p.lat]),
      },
      properties: {},
    } as any,
  ],
});

export const useZbiotStore = create<ZbiotStore>((set, get) => ({
  isZbiotEnabled: false,
  apiUrl: getDefaultZbiotApiUrl(),
  sid: null,
  isAuthLoading: false,
  authError: null,

  families: [],
  activeFamilyId: null,

  devices: [],
  isDevicesLoading: false,
  devicesError: null,

  positionsBySimei: {},
  lastRunInfoUpdateTime: null,
  isRunInfoLoading: false,
  runInfoError: null,

  selectedSimei: null,

  trackGeoJSON: null,
  trackMeta: null,
  isTrackLoading: false,
  trackError: null,

  alarms: [],
  isAlarmsLoading: false,
  alarmsError: null,

  fenceDraft: {
    name: "Fence",
    radiusM: 200,
    center: null,
    fenceSwitch: "e_fence_in_out",
  },
  isPickingFenceCenter: false,
  isFenceSaving: false,
  fenceError: null,

  setZbiotEnabled: (enabled) =>
    set(() => ({
      isZbiotEnabled: enabled,
      ...(enabled
        ? {}
        : {
            selectedSimei: null,
            trackGeoJSON: null,
            trackMeta: null,
            trackError: null,
            alarmsError: null,
            runInfoError: null,
            isPickingFenceCenter: false,
            fenceError: null,
          }),
    })),

  setApiUrl: (apiUrl) => {
    const next = typeof apiUrl === "string" ? apiUrl.trim() : String(apiUrl);
    set({ apiUrl: next });
    const sid = get().sid;
    const activeFamilyId = get().activeFamilyId;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ apiUrl: next, sid, activeFamilyId }),
      );
    } catch {
      // ignore
    }
  },

  restoreSession: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const apiUrl =
        typeof parsed?.apiUrl === "string" && parsed.apiUrl.trim()
          ? parsed.apiUrl.trim()
          : getDefaultZbiotApiUrl();
      const sid =
        typeof parsed?.sid === "string" && parsed.sid.trim()
          ? parsed.sid.trim()
          : null;
      const activeFamilyId =
        typeof parsed?.activeFamilyId === "string" && parsed.activeFamilyId.trim()
          ? parsed.activeFamilyId.trim()
          : null;
      set({ apiUrl, sid, activeFamilyId });
    } catch {
      // ignore
    }
  },

  clearSession: () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    set({
      sid: null,
      families: [],
      activeFamilyId: null,
      devices: [],
      positionsBySimei: {},
      lastRunInfoUpdateTime: null,
      selectedSimei: null,
      trackGeoJSON: null,
      trackMeta: null,
      alarms: [],
    });
  },

  login: async ({ account, password, type }) => {
    const apiUrl = get().apiUrl;
    set({ isAuthLoading: true, authError: null });
    try {
      const typeParam =
        typeof type === "number" && Number.isFinite(type) ? type : undefined;
      const resp = await zbiotCall<any>({
        apiUrl,
        module: "user",
        func: "Login",
        params: {
          account,
          flag: "e_account_login" satisfies ZbiotLoginFlag,
          platform: "web" satisfies ZbiotPlatform,
          pwd_md5: zbiotPwdMd5(password),
          ...(typeof typeParam === "number" ? { type: typeParam } : {}),
          lang: "en",
        },
      });

      const sid =
        typeof resp?.sid === "string" && resp.sid.trim() ? resp.sid.trim() : null;
      if (!sid) {
        throw new Error("Login berhasil tetapi sid tidak ditemukan.");
      }

      const familiesRaw = Array.isArray(resp?.familys) ? resp.familys : [];
      const families: ZbiotFamily[] = familiesRaw
        .filter((f: any) => f && typeof f === "object" && typeof f.sid === "string")
        .map((f: any) => ({
          sid: String(f.sid),
          sname: typeof f.sname === "string" ? f.sname : undefined,
          type: typeof f.type === "string" ? f.type : undefined,
          imei_count:
            typeof f.imei_count === "number" ? f.imei_count : undefined,
          raw: f,
        }));

      const activeFamilyId =
        get().activeFamilyId ||
        (families.length ? families[0].sid : null);

      set({ sid, families, activeFamilyId });
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ apiUrl, sid, activeFamilyId }),
        );
      } catch {
        // ignore
      }
    } catch (e) {
      set({ authError: e instanceof Error ? e.message : "Gagal login ZBIoT." });
    } finally {
      set({ isAuthLoading: false });
    }
  },

  logout: async () => {
    const { apiUrl, sid } = get();
    if (!sid) {
      get().clearSession();
      return;
    }
    set({ isAuthLoading: true, authError: null });
    try {
      await zbiotCall<any>({
        apiUrl,
        sid,
        module: "user",
        func: "LoginOut",
        params: {},
      });
    } catch {
      // ignore
    } finally {
      get().clearSession();
      set({ isAuthLoading: false });
    }
  },

  setActiveFamilyId: (sfamily) => {
    set({ activeFamilyId: sfamily });
    const apiUrl = get().apiUrl;
    const sid = get().sid;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ apiUrl, sid, activeFamilyId: sfamily }),
      );
    } catch {
      // ignore
    }
  },

  loadDevices: async () => {
    const { apiUrl, sid, activeFamilyId, isDevicesLoading } = get();
    if (!sid) {
      set({ devicesError: "Silakan login ZBIoT terlebih dulu." });
      return;
    }
    if (!activeFamilyId) {
      set({ devicesError: "Family ID belum dipilih." });
      return;
    }
    if (isDevicesLoading) return;

    set({ isDevicesLoading: true, devicesError: null });
    try {
      const resp = await zbiotCall<any>({
        apiUrl,
        sid,
        module: "family",
        func: "GetDeviceList",
        params: {
          familyid: activeFamilyId,
          limit_size: 1000,
        },
      });

      const items = Array.isArray(resp?.items) ? resp.items : [];
      const devices: ZbiotDevice[] = items
        .filter((d: any) => d && typeof d === "object" && typeof d.simei === "string")
        .map((d: any) => ({
          simei: String(d.simei),
          imei: d.imei,
          car_number: typeof d.car_number === "string" ? d.car_number : undefined,
          name:
            typeof d.name === "string"
              ? d.name
              : typeof d.dev_name === "string"
                ? d.dev_name
                : undefined,
          raw: d,
        }));

      set({ devices });
    } catch (e) {
      set({
        devicesError: e instanceof Error ? e.message : "Gagal mengambil device list.",
      });
    } finally {
      set({ isDevicesLoading: false });
    }
  },

  refreshRunInfo: async () => {
    const { apiUrl, sid, activeFamilyId, lastRunInfoUpdateTime, isRunInfoLoading } =
      get();
    if (!sid || !activeFamilyId) return;
    if (isRunInfoLoading) return;

    set({ isRunInfoLoading: true, runInfoError: null });
    try {
      const resp = await zbiotCall<any>({
        apiUrl,
        sid,
        module: "family",
        func: "GetRunInfo",
        params: {
          sfamily: activeFamilyId,
          limit_size: 200,
          ...(typeof lastRunInfoUpdateTime === "number"
            ? { update_time: lastRunInfoUpdateTime }
            : {}),
        },
      });

      const items = Array.isArray(resp?.items) ? resp.items : [];
      const nextUpdateTime =
        typeof resp?.cur_time === "number"
          ? resp.cur_time
          : typeof resp?.update_time === "number"
            ? resp.update_time
            : Date.now();

      if (!items.length) {
        set({ lastRunInfoUpdateTime: nextUpdateTime });
        return;
      }

      const prevPositions = get().positionsBySimei;
      const nextPositions: Record<string, ZbiotPosition> = { ...prevPositions };
      let changed = false;

      for (const it of items) {
        const simei = typeof it?.simei === "string" ? it.simei : null;
        if (!simei) continue;

        const lastPos = parseZbiotLastPos(it?.last_pos);
        const wgs = parseZbiotWgs(lastPos?.wgs);
        const norm = wgs ?? normalizeZbiotLatLon(lastPos?.lat, lastPos?.lon);
        if (!norm) continue;

        const next: ZbiotPosition = {
          simei,
          lat: norm.lat,
          lng: norm.lng,
          addr: typeof lastPos?.addr === "string" ? lastPos.addr : undefined,
          time: typeof lastPos?.time === "number" ? lastPos.time : undefined,
          ptype: typeof lastPos?.ptype === "string" ? lastPos.ptype : undefined,
          source: typeof lastPos?.type === "string" ? lastPos.type : undefined,
          wgs: typeof lastPos?.wgs === "string" ? lastPos.wgs : undefined,
          power: typeof it?.power === "number" ? it.power : undefined,
          raw: it,
        };

        const prev = prevPositions[simei];
        if (
          prev &&
          prev.lat === next.lat &&
          prev.lng === next.lng &&
          prev.time === next.time &&
          prev.power === next.power
        ) {
          continue;
        }

        nextPositions[simei] = next;
        changed = true;
      }

      set(
        changed
          ? { positionsBySimei: nextPositions, lastRunInfoUpdateTime: nextUpdateTime }
          : { lastRunInfoUpdateTime: nextUpdateTime },
      );
    } catch (e) {
      set({
        runInfoError: e instanceof Error ? e.message : "Gagal mengambil RunInfo.",
      });
    } finally {
      set({ isRunInfoLoading: false });
    }
  },

  setSelectedSimei: (simei) => set({ selectedSimei: simei }),

  loadTrack: async ({ simei, timeBegin, timeEnd }) => {
    const { apiUrl, sid } = get();
    if (!sid) {
      set({ trackError: "Silakan login ZBIoT terlebih dulu." });
      return;
    }

    set({ isTrackLoading: true, trackError: null, trackGeoJSON: null, trackMeta: null });
    try {
      const resp = await zbiotCall<any>({
        apiUrl,
        sid,
        module: "location",
        func: "QueryLocation",
        params: {
          simei,
          time_begin: timeBegin,
          time_end: timeEnd,
          limit_size: 2000,
        },
      });

      const data = Array.isArray(resp?.data) ? resp.data : [];
      const pts: ZbiotTrackPoint[] = [];

      for (const p of data) {
        const wgs = parseZbiotWgs(p?.wgs);
        const norm = wgs ?? normalizeZbiotLatLon(p?.lat, p?.lon);
        if (!norm) continue;
        pts.push({
          lat: norm.lat,
          lng: norm.lng,
          time: typeof p?.time === "number" ? p.time : undefined,
        });
      }

      if (pts.length < 2) {
        throw new Error("Track tidak ditemukan (0-1 titik).");
      }

      set({
        trackGeoJSON: buildTrackGeoJSON(pts),
        trackMeta: { simei, timeBegin, timeEnd, pointCount: pts.length },
      });
    } catch (e) {
      set({ trackError: e instanceof Error ? e.message : "Gagal mengambil track." });
    } finally {
      set({ isTrackLoading: false });
    }
  },

  clearTrack: () => set({ trackGeoJSON: null, trackMeta: null, trackError: null }),

  loadAlarms: async () => {
    const { apiUrl, sid, activeFamilyId, isAlarmsLoading } = get();
    if (!sid || !activeFamilyId) return;
    if (isAlarmsLoading) return;

    set({ isAlarmsLoading: true, alarmsError: null });
    try {
      const resp = await zbiotCall<any>({
        apiUrl,
        sid,
        module: "alarm",
        func: "Get",
        params: {
          get_child: true,
          is_desc: true,
          end_time: Math.floor(Date.now() / 1000),
          sfamily: activeFamilyId,
        },
      });

      const items = Array.isArray(resp?.items) ? resp.items : [];
      const alarms: ZbiotAlarm[] = items.slice(0, 50).map((a: any) => ({
        imei: typeof a?.imei === "number" ? a.imei : undefined,
        simei: typeof a?.simei === "string" ? a.simei : undefined,
        time: typeof a?.time === "number" ? a.time : undefined,
        type: typeof a?.type === "string" ? a.type : undefined,
        fencename: typeof a?.fencename === "string" ? a.fencename : undefined,
        raw: a,
      }));

      set({ alarms });
    } catch (e) {
      set({ alarmsError: e instanceof Error ? e.message : "Gagal mengambil alarm." });
    } finally {
      set({ isAlarmsLoading: false });
    }
  },

  setFencePicking: (picking) => set({ isPickingFenceCenter: picking }),
  setFenceCenter: (center) =>
    set((state) => ({
      fenceDraft: { ...state.fenceDraft, center },
      isPickingFenceCenter: false,
    })),
  setFenceName: (name) => set((state) => ({ fenceDraft: { ...state.fenceDraft, name } })),
  setFenceRadiusM: (radiusM) =>
    set((state) => ({ fenceDraft: { ...state.fenceDraft, radiusM } })),

  saveFenceCircle: async () => {
    const { apiUrl, sid, activeFamilyId, fenceDraft } = get();
    if (!sid || !activeFamilyId) return;
    if (!fenceDraft.center) {
      set({ fenceError: "Center fence belum dipilih." });
      return;
    }

    set({ isFenceSaving: true, fenceError: null });
    try {
      const lat = Math.round(fenceDraft.center.lat * 1_000_000);
      const lon = Math.round(fenceDraft.center.lng * 1_000_000);

      await zbiotCall<any>({
        apiUrl,
        sid,
        module: "fence",
        func: "Add",
        params: {
          fence_switch: fenceDraft.fenceSwitch,
          name: fenceDraft.name,
          type: "e_type_circle",
          ofence: {
            circle: {
              lat,
              lon,
              radius: Math.max(10, Math.round(fenceDraft.radiusM)),
            },
          },
          sgid: null,
          simei: [],
        },
      });

      set({
        fenceError: null,
        fenceDraft: { ...fenceDraft, center: null },
      });
    } catch (e) {
      set({ fenceError: e instanceof Error ? e.message : "Gagal menambah fence." });
    } finally {
      set({ isFenceSaving: false });
    }
  },
}));
