import type { LngLat } from '../types/markedArea';
import { geodesicInverse } from './surveyUtils';

// Classic: learn resection and intersection the map-and-compass way, with every coordinate
// and bearing typed in degrees, minutes and seconds. The maths and the hints live here; the
// panel is ClassicPanel and the map drawing ClassicLayer.
//
// Resection: you sight two known landmarks; from each landmark a line runs along its back
// azimuth, and where the lines cross is you.
// Intersection: from two known positions you sight one target; the lines along the
// azimuths cross at the target.

export interface DmsInput {
  d: string;
  m: string;
  s: string;
}

export const emptyDms = (): DmsInput => ({ d: '', m: '', s: '' });

export type Parsed = { value: number; error: null } | { value: null; error: string | null };

const isBlank = (v: string) => v.trim() === '';
const num = (v: string) => Number(v.trim().replace(',', '.'));

/**
 * Degrees, minutes, seconds to decimal degrees. `maxDeg` is 90 for latitude, 180 for
 * longitude, 360 for a bearing (which must stay under 360°). An empty input gives
 * { value: null, error: null }: nothing typed yet.
 */
export const parseDms = (input: DmsInput, maxDeg: 90 | 180 | 360, what: string): Parsed => {
  if (isBlank(input.d) && isBlank(input.m) && isBlank(input.s)) return { value: null, error: null };
  if (isBlank(input.d)) return { value: null, error: `Enter the degrees of the ${what}.` };
  const d = num(input.d);
  const m = isBlank(input.m) ? 0 : num(input.m);
  const s = isBlank(input.s) ? 0 : num(input.s);
  if ([d, m, s].some((v) => !Number.isFinite(v))) return { value: null, error: `Use numbers only in the ${what}.` };
  if (d < 0 || m < 0 || s < 0) return { value: null, error: `No minus signs: the direction comes from N/S or E/W.` };
  if (!Number.isInteger(d) || !Number.isInteger(m)) {
    return { value: null, error: `Degrees and minutes are whole numbers; put the fraction in the seconds.` };
  }
  if (m >= 60) return { value: null, error: `Minutes go from 0 to 59 (60' is 1°).` };
  if (s >= 60) return { value: null, error: `Seconds go from 0 to 59.99 (60" is 1').` };
  const value = d + m / 60 + s / 3600;
  if (maxDeg === 360 ? value >= 360 : value > maxDeg) {
    return {
      value: null,
      error:
        maxDeg === 360
          ? `A bearing goes from 0° to 359° 59' 59". 360° is north again, so write 0°.`
          : `The ${what} cannot be more than ${maxDeg}°.`,
    };
  }
  return { value, error: null };
};

/** Decimal degrees to DMS fields (seconds to 2 decimals, carried so 60" never shows) */
export const toDmsInput = (deg: number): DmsInput => {
  const hundredths = Math.round(Math.abs(deg) * 360000);
  const d = Math.floor(hundredths / 360000);
  const m = Math.floor((hundredths % 360000) / 6000);
  const s = (hundredths % 6000) / 100;
  return { d: String(d), m: String(m), s: String(Number(s.toFixed(2))) };
};

/**
 * A compass reading in degrees, 0–360 (360 is north again, the same as 0). Decimals are
 * allowed (114.5). An empty field gives { value: null, error: null }.
 */
export const parseCompass = (text: string, what: string): Parsed => {
  const t = text.trim().replace(',', '.').replace(/°$/, '');
  if (t === '') return { value: null, error: null };
  if (!/^-?\d+(\.\d+)?$/.test(t)) return { value: null, error: `Type the ${what} as compass degrees, e.g. 114 or 114.5.` };
  const v = Number(t);
  if (v < 0) return { value: null, error: `A compass has no negative degrees: go clockwise from north, 0 to 360.` };
  if (v > 360) return { value: null, error: `A compass goes from 0° to 360°. Subtract 360° from ${v}°.` };
  return { value: v === 360 ? 0 : v, error: null };
};

/** A compass reading as 114° or 114.5° (to a tenth) */
export const formatCompass = (deg: number) => {
  const v = Math.round((((deg % 360) + 360) % 360) * 10) / 10;
  return `${v === 360 ? 0 : v}°`;
};

const POINTS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
/** The compass point of a bearing (16 points: N, NNE, NE ...) */
export const compassPoint = (deg: number) => POINTS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];

// The 16 compass points in Indonesian, for the hints (the labels stay in English, as on compasses)
const POINT_NAMES_ID: Record<string, string> = {
  N: 'Utara',
  NNE: 'Utara-Timur Laut',
  NE: 'Timur Laut',
  ENE: 'Timur-Timur Laut',
  E: 'Timur',
  ESE: 'Timur-Tenggara',
  SE: 'Tenggara',
  SSE: 'Selatan-Tenggara',
  S: 'Selatan',
  SSW: 'Selatan-Barat Daya',
  SW: 'Barat Daya',
  WSW: 'Barat-Barat Daya',
  W: 'Barat',
  WNW: 'Barat-Barat Laut',
  NW: 'Barat Laut',
  NNW: 'Utara-Barat Laut',
};
const POINT_NAMES_EN: Record<string, string> = {
  N: 'North', NNE: 'North-NorthEast', NE: 'NorthEast', ENE: 'East-NorthEast',
  E: 'East', ESE: 'East-SouthEast', SE: 'SouthEast', SSE: 'South-SouthEast',
  S: 'South', SSW: 'South-SouthWest', SW: 'SouthWest', WSW: 'West-SouthWest',
  W: 'West', WNW: 'West-NorthWest', NW: 'NorthWest', NNW: 'North-NorthWest',
};

/** "ENE = Timur-Timur Laut (East-NorthEast), sekitar 56°–79°" */
export const compassPointHint = (abbr: string) => {
  const i = POINTS.indexOf(abbr);
  const from = (((i * 22.5 - 11.25) % 360) + 360) % 360;
  const to = i * 22.5 + 11.25;
  return `${abbr} = ${POINT_NAMES_ID[abbr]} (${POINT_NAMES_EN[abbr]}), sekitar ${Math.ceil(from)}°–${Math.floor(to)}°`;
};

/** All 16 points with their centre bearing and Indonesian name, for the hint table */
export const COMPASS_POINTS = POINTS.map((abbr, i) => ({ abbr, deg: i * 22.5, id: POINT_NAMES_ID[abbr] }));

export const normalize360 = (deg: number) => ((deg % 360) + 360) % 360;

/** a − b, between −180° and 180° (positive: a is clockwise of b) */
export const angleDiff = (a: number, b: number) => {
  const d = normalize360(a - b);
  return d > 180 ? d - 360 : d;
};

export const backAzimuthOf = (az: number) => normalize360(az + 180);

// --- Where two lines cross ---------------------------------------------------------------

const A = 6378137;
const E2 = 0.00669437999014; // WGS84 first eccentricity squared
const rad = (d: number) => (d * Math.PI) / 180;

// Metres east / north of an origin, on the plane touching the ellipsoid there
const plane = (origin: LngLat) => {
  const phi = rad(origin[1]);
  const w = Math.sqrt(1 - E2 * Math.sin(phi) ** 2);
  const n = A / w; // prime vertical radius
  const m = (A * (1 - E2)) / w ** 3; // meridian radius
  const kx = rad(1) * n * Math.cos(phi);
  const ky = rad(1) * m;
  return {
    to: ([lng, lat]: LngLat) => [(lng - origin[0]) * kx, (lat - origin[1]) * ky],
    from: ([x, y]: number[]): LngLat => [origin[0] + x / kx, origin[1] + y / ky],
  };
};

export interface Fix {
  point: LngLat;
  /** Metres from each line's start along its bearing; negative = behind the start */
  along: number[];
  /** Metres from the fix to each line (0 for every line when there are two) */
  misses: number[];
  /** The widest angle between any two lines, 0–90° (90° is the strongest cut) */
  cutAngle: number;
}

export interface Line {
  from: LngLat;
  bearing: number;
}

/**
 * The point closest to every line (least squares; with two lines, where they cross), or null
 * when the lines are all parallel. Solved on a plane touching the ellipsoid, re-centred on
 * the answer, so it stays within a metre or so over the tens of kilometres a compass is used for.
 */
export const fixFromLines = (lines: Line[]): Fix | null => {
  let cutAngle = 0;
  for (let i = 0; i < lines.length; i++) {
    for (let j = 0; j < i; j++) {
      const diff = Math.abs(angleDiff(lines[i].bearing, lines[j].bearing));
      cutAngle = Math.max(cutAngle, diff > 90 ? 180 - diff : diff);
    }
  }
  if (lines.length < 2 || cutAngle < 0.05) return null;

  let origin: LngLat = [
    lines.reduce((n, l) => n + l.from[0], 0) / lines.length,
    lines.reduce((n, l) => n + l.from[1], 0) / lines.length,
  ];
  let fix: Fix | null = null;
  for (let iter = 0; iter < 3; iter++) {
    const { to, from } = plane(origin);
    const geo = lines.map((l) => {
      const [x, y] = to(l.from);
      const d = [Math.sin(rad(l.bearing)), Math.cos(rad(l.bearing))];
      return { x, y, d, n: [d[1], -d[0]] };
    });
    // Sum of n·nᵀ times the point = sum of n·nᵀ times each start
    let a = 0, b = 0, c = 0, r1 = 0, r2 = 0;
    for (const { x, y, n } of geo) {
      a += n[0] * n[0];
      b += n[0] * n[1];
      c += n[1] * n[1];
      const k = n[0] * x + n[1] * y;
      r1 += n[0] * k;
      r2 += n[1] * k;
    }
    const det = a * c - b * b;
    const px = (c * r1 - b * r2) / det;
    const py = (a * r2 - b * r1) / det;
    fix = {
      point: from([px, py]),
      along: geo.map(({ x, y, d }) => (px - x) * d[0] + (py - y) * d[1]),
      misses: geo.map(({ x, y, n }) => Math.abs((px - x) * n[0] + (py - y) * n[1])),
      cutAngle,
    };
    origin = fix.point;
  }
  return fix;
};

/**
 * How far along a line (from `from`, on `bearing`) the point `to` lies, in metres: the point
 * is projected onto the line, so dragging sideways does not change the line.
 */
export const lengthAlong = (from: LngLat, bearing: number, to: LngLat) => {
  const g = bearingTo(from, to);
  return g.distance * Math.cos(rad(g.bearing - bearing));
};

/** How far off a hand compass usually is (degrees) */
export const COMPASS_ERROR_DEG = 2;

/**
 * Radius (metres) of the area the object most likely lies in: a compass error of ±2° moves
 * each line sideways by distance × tan 2°, and a shallow cut stretches that along the other
 * line. With three or more lines, never smaller than how far they miss each other.
 */
export const fixRadius = (fix: Fix, errorDeg = COMPASS_ERROR_DEG) => {
  const far = Math.max(...fix.along.map(Math.abs));
  const cut = Math.max(fix.cutAngle, 5);
  let r = (far * Math.tan(rad(errorDeg))) / Math.sin(rad(cut));
  if (fix.misses.length >= 3) r = Math.max(r, Math.max(...fix.misses) * 1.5);
  return Math.min(5000, Math.max(15, r));
};

/** True bearing and distance from a to b */
export const bearingTo = (a: LngLat, b: LngLat) => {
  const g = geodesicInverse(a[1], a[0], b[1], b[0]);
  return { bearing: g.initialBearing, distance: g.distance };
};

// --- Hints -----------------------------------------------------------------------------------

export type Verdict = 'ok' | 'close' | 'off';
export interface Check {
  verdict: Verdict;
  message: string;
}

/** A back azimuth against the azimuth it belongs to (to a tenth of a degree) */
export const checkBackAzimuth = (back: number, azimuth: number): Check => {
  const expected = backAzimuthOf(azimuth);
  if (Math.abs(angleDiff(back, expected)) < 0.05) return { verdict: 'ok', message: 'Correct.' };
  if (Math.abs(angleDiff(back, azimuth)) < 0.05) {
    return { verdict: 'off', message: 'That is the azimuth itself. The back azimuth points the opposite way.' };
  }
  const rule =
    azimuth < 180
      ? `${formatCompass(azimuth)} is less than 180°, so add 180°.`
      : `${formatCompass(azimuth)} is 180° or more, so subtract 180°.`;
  // Whole degrees right, the decimals changed
  const wholeRight = Math.floor(back) === Math.floor(expected);
  return {
    verdict: 'off',
    message: wholeRight ? `The whole degrees are right. Keep the decimals exactly as in the azimuth.` : rule,
  };
};

const metresText = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);

/**
 * Hints on the fix: a weak cut and the triangle of error (three or more lines). `labels`
 * names each line.
 */
export const reviewFix = (fix: Fix, lines: Line[], mode: 'resection' | 'intersection', labels: string[]): Check[] => {
  const out: Check[] = [];
  const span = Math.max(1, fix.along.reduce((n, a) => n + Math.abs(a), 0) / fix.along.length);
  if (fix.cutAngle < 30) {
    out.push({
      verdict: 'close',
      message: `The lines cross at a shallow ${Math.round(fix.cutAngle)}°, so a small reading error moves the answer a lot. Choose ${
        mode === 'resection' ? 'reference points' : 'positions'
      } so the lines meet at 30–150° (seen from ${mode === 'resection' ? 'you' : 'the object'}).`,
    });
  }
  if (lines.length >= 3) {
    // The triangle (or polygon) of error: how far apart the lines cross, pair by pair
    const crossings: LngLat[] = [];
    for (let i = 0; i < lines.length; i++) {
      for (let j = 0; j < i; j++) {
        const pair = fixFromLines([lines[i], lines[j]]);
        if (pair) crossings.push(pair.point);
      }
    }
    const size = Math.max(0, ...crossings.flatMap((p) => crossings.map((q) => bearingTo(p, q).distance)));
    if (size <= Math.max(50, span * 0.06)) {
      out.push({ verdict: 'ok', message: `All ${lines.length} lines meet within ${metresText(size)}: a tight triangle of error.` });
    } else {
      // With four or more lines: the slip is the line whose removal lets all the others meet
      let culprit: number | null = null;
      if (lines.length >= 4) {
        const spreads = lines.map((_, i) => {
          const rest = fixFromLines(lines.filter((__, k) => k !== i));
          return rest ? Math.max(...rest.misses) : Infinity;
        });
        const sorted = [...spreads].sort((x, y) => x - y);
        if (sorted[0] * 3 < sorted[1]) culprit = spreads.indexOf(sorted[0]);
      }
      out.push({
        verdict: 'off',
        message:
          culprit !== null
            ? `The line from ${labels[culprit]} misses the others. Its azimuth or back azimuth is the most likely slip.`
            : `The lines cross ${metresText(size)} apart (the triangle of error). One reading is off: take them again, starting with the one you are least sure of.`,
      });
    }
  }
  return out;
};
