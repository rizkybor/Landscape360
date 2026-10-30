import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { emptyDms, toDmsInput, type DmsInput } from '../utils/classicNav';
import type { LngLat } from '../types/markedArea';

// Classic (resection / intersection practice, website only). Everything is typed by hand,
// positions in degrees, minutes and seconds and bearings in compass degrees (0–360), so the
// raw fields are the state; positions and bearings are worked out from them (see solveClassic).
//
// Resection: your position is set once, then each point (A, B, C…) gets an azimuth from you
// and its back azimuth. Intersection: each position you sight the same object from, with the
// azimuth and back azimuth taken there.
//
// Each mode keeps a list of Field Works (separate exercises). The one being worked on lives in
// the top-level fields (sightings, origin, lineLengths); the others are kept in `fieldWorks` and
// swapped in when chosen. Everything is remembered in this browser (localStorage).

export type ClassicMode = 'resection' | 'intersection';

export interface PointInput {
  lat: DmsInput;
  lng: DmsInput;
  south: boolean;
  west: boolean;
}

export interface Sighting {
  point: PointInput;
  /** Compass degrees 0–360, as typed */
  azimuth: string;
  back: string;
  /** Times "Check" was pressed: hints show from the first, "Show answer" from the second */
  azChecks: number;
  backChecks: number;
}

/** A sighting's position, or your position (resection) */
export type PickTarget = number | 'origin';

export const MIN_SIGHTINGS = 2;
export const MAX_SIGHTINGS = 6;

const emptyPoint = (): PointInput => ({
  lat: emptyDms(),
  lng: emptyDms(),
  south: true,
  west: false,
});
const emptySighting = (): Sighting => ({
  point: emptyPoint(),
  azimuth: '',
  back: '',
  azChecks: 0,
  backChecks: 0,
});
const fromLngLat = ([lng, lat]: LngLat): PointInput => ({
  lat: toDmsInput(lat),
  lng: toDmsInput(lng),
  south: lat < 0,
  west: lng < 0,
});

/** What one Field Work holds */
export interface FieldWorkData {
  sightings: Sighting[];
  origin: PointInput;
  lineLengths: Record<string, number>;
}

export interface FieldWork extends FieldWorkData {
  id: string;
  name: string;
  /** Set while the Field Work is shared as a link (the link always shows the latest version) */
  shareToken?: string | null;
}

/** A Field Work someone shared, opened from its link to look at (read only) */
export interface ViewedFieldWork extends FieldWorkData {
  token: string;
  mode: ClassicMode;
  name: string;
  declination: string;
  ownerName: string | null;
  updatedAt: number;
}

/** Field Works per mode: Free and guests 1, Pro 5, Enterprise 10, admin unlimited (null) */
export const FIELD_WORK_LIMITS = { Free: 1, Pro: 5, Enterprise: 10 } as const;
export const fieldWorkLimit = (account: { hasUser: boolean; subscriptionStatus: string; isAdmin: boolean }): number | null => {
  if (!account.hasUser) return FIELD_WORK_LIMITS.Free;
  if (account.isAdmin) return null;
  return FIELD_WORK_LIMITS[account.subscriptionStatus as keyof typeof FIELD_WORK_LIMITS] ?? FIELD_WORK_LIMITS.Free;
};

const newId = () => Math.random().toString(36).slice(2, 10);

interface ClassicStore {
  isPanelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  togglePanel: () => void;

  mode: ClassicMode;
  setMode: (mode: ClassicMode) => void;

  sightings: Sighting[];
  updateSighting: (index: number, patch: Partial<Sighting>) => void;
  setSightingPoint: (index: number, patch: Partial<PointInput>) => void;
  check: (index: number, field: 'azChecks' | 'backChecks') => void;
  addSighting: () => void;
  removeSighting: (index: number) => void;

  /** Resection: your position on the map, set once; every point's bearings start from it */
  origin: PointInput;
  setOrigin: (patch: Partial<PointInput>) => void;
  clearOrigin: () => void;

  picking: PickTarget | null;
  startPicking: (target: PickTarget) => void;
  stopPicking: () => void;
  /** Sets the picked target from a map tap */
  placePicked: (p: LngLat) => void;

  /**
   * Line lengths set by hand on the map (metres), by "<sighting>:<main|back>". Lines without
   * one get a length that fits the exercise.
   */
  lineLengths: Record<string, number>;
  setLineLength: (key: string, metres: number) => void;
  resetLineLengths: () => void;

  /** Magnetic declination in degrees, east positive (typed as text) */
  declination: string;
  setDeclination: (value: string) => void;

  /** Field Works of each mode, and which one is open. The open one's data is the top-level fields. */
  fieldWorks: Record<ClassicMode, FieldWork[]>;
  activeFieldWork: Record<ClassicMode, string>;
  /** Adds an empty Field Work, unless the mode already has `limit` (null: no limit) */
  addFieldWork: (limit?: number | null) => void;
  selectFieldWork: (id: string) => void;
  renameFieldWork: (id: string, name: string) => void;
  deleteFieldWork: (id: string) => void;
  setShareToken: (id: string, token: string | null) => void;

  /** A shared Field Work being looked at (from a /?classic= link); the panel and map show it read only */
  viewing: ViewedFieldWork | null;
  setViewing: (viewing: ViewedFieldWork | null) => void;

  /** Empties the open Field Work */
  resetExercise: () => void;
}

const freshData = (): FieldWorkData => ({
  sightings: [emptySighting(), emptySighting()],
  origin: emptyPoint(),
  lineLengths: {},
});
const freshExercise = () => ({ ...freshData(), picking: null });

const firstFieldWorks = () => {
  const r = { id: newId(), name: 'Field Work 1', ...freshData() };
  const i = { id: newId(), name: 'Field Work 1', ...freshData() };
  return {
    fieldWorks: { resection: [r], intersection: [i] },
    activeFieldWork: { resection: r.id, intersection: i.id },
  };
};

/** The list with the open Field Work's current data written back into it */
const commit = (s: ClassicStore): FieldWork[] =>
  s.fieldWorks[s.mode].map((f) =>
    f.id === s.activeFieldWork[s.mode]
      ? {
          ...f,
          sightings: s.sightings,
          origin: s.origin,
          lineLengths: s.lineLengths,
        }
      : f,
  );

const load = (f: FieldWork) => ({
  sightings: f.sightings,
  origin: f.origin,
  lineLengths: f.lineLengths,
  picking: null,
});

export const useClassicStore = create<ClassicStore>()(
  persist(
    (set, get) => ({
      isPanelOpen: false,
      setPanelOpen: (open) => set(open ? { isPanelOpen: true } : { isPanelOpen: false, picking: null }),
      togglePanel: () => set((s) => ({ isPanelOpen: !s.isPanelOpen, picking: null })),

      mode: 'resection',
      // Each mode has its own Field Works: keep this one, open the other mode's
      setMode: (mode) =>
        set((s) => {
          if (s.mode === mode) return s;
          const fieldWorks = { ...s.fieldWorks, [s.mode]: commit(s) };
          const next = fieldWorks[mode].find((f) => f.id === s.activeFieldWork[mode]) ?? fieldWorks[mode][0];
          return {
            mode,
            fieldWorks,
            activeFieldWork: { ...s.activeFieldWork, [mode]: next.id },
            ...load(next),
          };
        }),

      ...freshExercise(),
      updateSighting: (index, patch) =>
        set((s) => ({
          sightings: s.sightings.map((x, i) => (i === index ? { ...x, ...patch } : x)),
        })),
      setSightingPoint: (index, patch) =>
        set((s) => ({
          sightings: s.sightings.map((x, i) => (i === index ? { ...x, point: { ...x.point, ...patch } } : x)),
        })),
      check: (index, field) =>
        set((s) => ({
          sightings: s.sightings.map((x, i) => (i === index ? { ...x, [field]: x[field] + 1 } : x)),
        })),
      addSighting: () => set((s) => (s.sightings.length >= MAX_SIGHTINGS ? s : { sightings: [...s.sightings, emptySighting()] })),
      removeSighting: (index) =>
        // The lines after it move up a letter, so hand-set lengths start again
        set((s) =>
          s.sightings.length <= MIN_SIGHTINGS
            ? s
            : {
                sightings: s.sightings.filter((_, i) => i !== index),
                picking: null,
                lineLengths: {},
              },
        ),

      origin: emptyPoint(),
      setOrigin: (patch) => set((s) => ({ origin: { ...s.origin, ...patch } })),
      clearOrigin: () => set({ origin: emptyPoint() }),

      picking: null,
      startPicking: (target) => set({ picking: target }),
      stopPicking: () => set({ picking: null }),
      placePicked: (p) => {
        const target = get().picking;
        if (target === null) return;
        if (target === 'origin') set({ origin: fromLngLat(p) });
        else get().setSightingPoint(target, fromLngLat(p));
        set({ picking: null });
      },

      setLineLength: (key, metres) => set((s) => ({ lineLengths: { ...s.lineLengths, [key]: metres } })),
      resetLineLengths: () => set({ lineLengths: {} }),

      declination: '0',
      setDeclination: (declination) => set({ declination }),

      ...firstFieldWorks(),
      addFieldWork: (limit = null) =>
        set((s) => {
          if (limit !== null && s.fieldWorks[s.mode].length >= limit) return s;
          const list = commit(s);
          // Field Work 1, 2, 3… (one past the highest number used)
          const n = Math.max(0, ...list.map((f) => Number(f.name.match(/^Field Work (\d+)$/)?.[1] ?? 0))) + 1;
          const created: FieldWork = {
            id: newId(),
            name: `Field Work ${n}`,
            ...freshData(),
          };
          return {
            fieldWorks: { ...s.fieldWorks, [s.mode]: [...list, created] },
            activeFieldWork: { ...s.activeFieldWork, [s.mode]: created.id },
            ...load(created),
          };
        }),
      selectFieldWork: (id) =>
        set((s) => {
          if (id === s.activeFieldWork[s.mode]) return s;
          const list = commit(s);
          const target = list.find((f) => f.id === id);
          if (!target) return s;
          return {
            fieldWorks: { ...s.fieldWorks, [s.mode]: list },
            activeFieldWork: { ...s.activeFieldWork, [s.mode]: id },
            ...load(target),
          };
        }),
      renameFieldWork: (id, name) =>
        set((s) => ({
          fieldWorks: {
            ...s.fieldWorks,
            [s.mode]: s.fieldWorks[s.mode].map((f) => (f.id === id ? { ...f, name: name.trim().slice(0, 40) || f.name } : f)),
          },
        })),
      deleteFieldWork: (id) =>
        set((s) => {
          const list = commit(s);
          // The last one is emptied instead: there is always a Field Work to work in
          if (list.length <= 1) {
            const only = { ...list[0], ...freshData() };
            return {
              fieldWorks: { ...s.fieldWorks, [s.mode]: [only] },
              ...load(only),
            };
          }
          const rest = list.filter((f) => f.id !== id);
          if (id !== s.activeFieldWork[s.mode]) return { fieldWorks: { ...s.fieldWorks, [s.mode]: rest } };
          const index = list.findIndex((f) => f.id === id);
          const next = rest[Math.min(index, rest.length - 1)];
          return {
            fieldWorks: { ...s.fieldWorks, [s.mode]: rest },
            activeFieldWork: { ...s.activeFieldWork, [s.mode]: next.id },
            ...load(next),
          };
        }),

      setShareToken: (id, token) =>
    set((s) => ({
      fieldWorks: { ...s.fieldWorks, [s.mode]: s.fieldWorks[s.mode].map((f) => (f.id === id ? { ...f, shareToken: token } : f)) },
    })),

  viewing: null,
  setViewing: (viewing) => set(viewing ? { viewing, isPanelOpen: true, picking: null } : { viewing: null }),

  resetExercise: () => set(freshExercise()),
    }),
    {
      name: 'landscape360-classic',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // The exercise data; not whether the panel is open or a map pick is waiting
      partialize: (s) => ({
        mode: s.mode,
        sightings: s.sightings,
        origin: s.origin,
        lineLengths: s.lineLengths,
        declination: s.declination,
        fieldWorks: s.fieldWorks,
        activeFieldWork: s.activeFieldWork,
      }),
    },
  ),
);
