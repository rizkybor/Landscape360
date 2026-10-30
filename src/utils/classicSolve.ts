import type { ClassicMode, PointInput, Sighting } from '../store/useClassicStore';
import type { LngLat } from '../types/markedArea';
import {
  bearingTo,
  checkBackAzimuth,
  fixFromLines,
  normalize360,
  parseCompass,
  parseDms,
  reviewFix,
  type Check,
  type Fix,
  type Line,
  type Parsed,
} from './classicNav';

// Everything the Classic panel and map show, worked out from the typed fields.
// Each sighting is done in order, and the next one opens when the one before is complete:
// resection, your position found on the map once, then for each point azimuth -> back
// azimuth (lines from your position);
// intersection, position -> azimuth -> back azimuth (the azimuth lines cross at the object).

export interface SightingState {
  /** "object 1" (resection) or "position 1" (intersection) */
  label: string;
  point: LngLat | null;
  pointError: string | null;
  azimuth: Parsed;
  back: Parsed;
  backCheck: Check | null;
  backAnswer: number | null;
  /** Steps open in order */
  azOpen: boolean;
  backOpen: boolean;
  complete: boolean;
  /** This sighting can be filled in (the one before it is complete) */
  open: boolean;
}

export interface ClassicSolution {
  sightings: SightingState[];
  /** Every point has a valid position (resection: your position is set) */
  pointsReady: boolean;
  /** Resection: your position, the start of every line */
  origin: LngLat | null;
  originError: string | null;
  declination: Parsed;
  /** The line drawn from each complete sighting (true bearings) */
  lines: (Line & { index: number })[];
  fix: Fix | null;
  problem: string | null;
  review: Check[];
}

const MIN_SPACING_M = 50;

const parsePoint = (p: PointInput): { value: LngLat | null; error: string | null } => {
  const lat = parseDms(p.lat, 90, 'latitude');
  const lng = parseDms(p.lng, 180, 'longitude');
  const error = lat.error ?? lng.error;
  if (error) return { value: null, error };
  if (lat.value === null && lng.value === null) return { value: null, error: null };
  if (lat.value === null || lng.value === null) return { value: null, error: 'Enter both the latitude and the longitude.' };
  return { value: [p.west ? -lng.value : lng.value, p.south ? -lat.value : lat.value], error: null };
};

/** Point A, B, C… (resection reference points) or position A, B, C… (intersection) */
export const sightingLabel = (mode: ClassicMode, i: number) =>
  `${mode === 'resection' ? 'point' : 'position'} ${String.fromCharCode(65 + i)}`;

export const solveClassic = (input: {
  mode: ClassicMode;
  sightings: Sighting[];
  origin: PointInput;
  declination: string;
}): ClassicSolution => {
  const { mode } = input;
  const resection = mode === 'resection';

  const decl = input.declination.trim() === '' ? '0' : input.declination.trim().replace(',', '.');
  const declValue = Number(decl);
  const declination: Parsed =
    Number.isFinite(declValue) && Math.abs(declValue) <= 30
      ? { value: declValue, error: null }
      : { value: null, error: 'Declination is a small angle in degrees, e.g. 0.8 (east) or -1.2 (west).' };
  const d = declination.value ?? 0;

  // Resection: your position, set once; every point's bearings start from it
  const originParsed = parsePoint(input.origin);
  const origin = resection ? originParsed.value : null;

  // Positions first. Two points on top of each other cannot be sighted apart.
  const places: { point: LngLat | null; error: string | null }[] = [];
  input.sightings.forEach((s, i) => {
    if (resection) {
      places[i] = { point: origin, error: null };
      return;
    }
    let { value: point, error } = parsePoint(s.point);
    if (point) {
      const others = places.map((o, k) => [o.point, sightingLabel(mode, k)] as [LngLat | null, string]);
      for (const [other, name] of others) {
        if (other && bearingTo(point, other).distance < MIN_SPACING_M) {
          error = `This is within ${MIN_SPACING_M} m of ${name}. Choose a point you would sight from a distance.`;
          point = null;
          break;
        }
      }
    }
    places[i] = { point, error };
  });
  // Resection finds every reference point on the map first (one step), then sights them one
  // by one; intersection finds each position as you move there
  const pointsReady = places.every((p) => p.point);

  const states: SightingState[] = [];
  input.sightings.forEach((s, i) => {
    const label = sightingLabel(mode, i);
    const open = (!resection || pointsReady) && (i === 0 || !!states[i - 1]?.complete);
    const { point, error: pointError } = places[i];

    const azimuth = parseCompass(s.azimuth, 'azimuth');
    const back = parseCompass(s.back, 'back azimuth');
    const azOpen = open && !!point && declination.value !== null;

    // The azimuth only has to be a valid compass reading (there is no real point to grade it against)
    const azDone = azOpen && azimuth.value !== null && s.azChecks > 0;

    // Then the back azimuth (both modes): the opposite direction, to the tenth of a degree
    const backOpen = azDone;
    let backCheck: Check | null = null;
    let backAnswer: number | null = null;
    if (backOpen && back.value !== null && s.backChecks > 0) {
      backCheck = checkBackAzimuth(back.value, azimuth.value!);
      if (s.backChecks >= 2 && backCheck.verdict === 'off') backAnswer = normalize360(azimuth.value! + 180);
    }
    const complete = backOpen && backCheck?.verdict === 'ok';

    states.push({ label, point, pointError, azimuth, back, backCheck, backAnswer, azOpen, backOpen, complete, open });
  });

  // Intersection: a line from each position along its azimuth (true bearing), crossing at
  // the object. Resection draws its lines from your one position, so they do not cross.
  const lines = resection
    ? []
    : states.flatMap((s, index) =>
        s.complete && s.point ? [{ index, from: s.point, bearing: normalize360(s.azimuth.value! + d) }] : [],
      );

  let fix: Fix | null = null;
  let problem: string | null = null;
  let review: Check[] = [];
  if (lines.length >= 2) {
    fix = fixFromLines(lines);
    if (!fix) {
      problem = 'The lines are parallel, so they never cross. Sight objects in clearly different directions.';
    } else {
      const behind = fix.along.findIndex((a) => a < 0);
      if (behind >= 0) {
        const label = states[lines[behind].index].label;
        problem = resection
          ? `The lines only meet behind ${label}: its back azimuth points away from you. Check the azimuth to ${label}.`
          : `The lines only meet behind ${label}: its azimuth points away from the object. Check the sighting from ${label}.`;
        fix = null;
      } else {
        review = reviewFix(fix, lines, mode, lines.map((l) => states[l.index].label));
      }
    }
  }

  return {
    sightings: states,
    pointsReady,
    origin,
    originError: resection ? originParsed.error : null,
    declination,
    lines,
    fix,
    problem,
    review,
  };
};
