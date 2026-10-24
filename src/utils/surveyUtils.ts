import * as turf from '@turf/turf';
import type { SurveyHandle, SurveyPoint } from '../store/useSurveyStore';

export interface AzimuthData {
  forwardAzimuth: number; // degrees
  backAzimuth: number;    // degrees
  horizontalDistance: number; // meters
  slope: number; // percentage
  slopeDegrees: number; // degrees
  elevationDiff: number; // meters
}

// WGS84 ellipsoid (the datum of GPS and the map)
const WGS84_A = 6378137;
const WGS84_F = 1 / 298.257223563;
const WGS84_B = WGS84_A * (1 - WGS84_F);
const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

export interface GeodesicResult {
  distance: number; // meters
  initialBearing: number; // degrees 0..360
  finalBearing: number; // degrees 0..360, direction of travel on arrival
}

/**
 * Distance and bearings between two points on the WGS84 ellipsoid (Vincenty's inverse
 * formula, accurate to well under a millimetre). Falls back to a spherical result for
 * nearly antipodal points, where the iteration does not converge.
 */
export const geodesicInverse = (lat1: number, lng1: number, lat2: number, lng2: number): GeodesicResult => {
  if (lat1 === lat2 && lng1 === lng2) return { distance: 0, initialBearing: 0, finalBearing: 0 };

  const L = toRad(lng2 - lng1);
  const U1 = Math.atan((1 - WGS84_F) * Math.tan(toRad(lat1)));
  const U2 = Math.atan((1 - WGS84_F) * Math.tan(toRad(lat2)));
  const sinU1 = Math.sin(U1), cosU1 = Math.cos(U1);
  const sinU2 = Math.sin(U2), cosU2 = Math.cos(U2);

  let lambda = L;
  let sinSigma = 0, cosSigma = 0, sigma = 0, cos2Alpha = 0, cos2SigmaM = 0;
  let sinLambda = 0, cosLambda = 0;
  let converged = false;

  for (let i = 0; i < 200; i++) {
    sinLambda = Math.sin(lambda);
    cosLambda = Math.cos(lambda);
    sinSigma = Math.hypot(cosU2 * sinLambda, cosU1 * sinU2 - sinU1 * cosU2 * cosLambda);
    if (sinSigma === 0) return { distance: 0, initialBearing: 0, finalBearing: 0 };
    cosSigma = sinU1 * sinU2 + cosU1 * cosU2 * cosLambda;
    sigma = Math.atan2(sinSigma, cosSigma);
    const sinAlpha = (cosU1 * cosU2 * sinLambda) / sinSigma;
    cos2Alpha = 1 - sinAlpha * sinAlpha;
    cos2SigmaM = cos2Alpha !== 0 ? cosSigma - (2 * sinU1 * sinU2) / cos2Alpha : 0; // 0 on the equator
    const C = (WGS84_F / 16) * cos2Alpha * (4 + WGS84_F * (4 - 3 * cos2Alpha));
    const prev = lambda;
    lambda =
      L +
      (1 - C) * WGS84_F * sinAlpha *
        (sigma + C * sinSigma * (cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM)));
    if (Math.abs(lambda - prev) < 1e-12) {
      converged = true;
      break;
    }
  }

  if (!converged) {
    const from = turf.point([lng1, lat1]);
    const to = turf.point([lng2, lat2]);
    return {
      distance: turf.distance(from, to, { units: 'meters' }),
      initialBearing: (turf.bearing(from, to) + 360) % 360,
      finalBearing: (turf.bearing(from, to, { final: true }) + 360) % 360,
    };
  }

  const uSq = (cos2Alpha * (WGS84_A * WGS84_A - WGS84_B * WGS84_B)) / (WGS84_B * WGS84_B);
  const A = 1 + (uSq / 16384) * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
  const B = (uSq / 1024) * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));
  const deltaSigma =
    B * sinSigma *
    (cos2SigmaM +
      (B / 4) *
        (cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM) -
          (B / 6) * cos2SigmaM * (-3 + 4 * sinSigma * sinSigma) * (-3 + 4 * cos2SigmaM * cos2SigmaM)));

  const alpha1 = Math.atan2(cosU2 * sinLambda, cosU1 * sinU2 - sinU1 * cosU2 * cosLambda);
  const alpha2 = Math.atan2(cosU1 * sinLambda, -sinU1 * cosU2 + cosU1 * sinU2 * cosLambda);

  return {
    distance: WGS84_B * A * (sigma - deltaSigma),
    initialBearing: (toDeg(alpha1) + 360) % 360,
    finalBearing: (toDeg(alpha2) + 360) % 360,
  };
};

/**
 * Calculates survey data between two points
 */
export const getAzimuthData = (p1: SurveyPoint, p2: SurveyPoint): AzimuthData => {
  const geo = geodesicInverse(p1.lat, p1.lng, p2.lat, p2.lng);

  // 1. Forward Azimuth (true north, measured on the WGS84 ellipsoid)
  const forwardAzimuth = geo.initialBearing;

  // 2. Back Azimuth: the direction from p2 back to p1. On an ellipsoid this is the
  // arrival bearing + 180°, which differs slightly from forward + 180° over long lines.
  const backAzimuth = (geo.finalBearing + 180) % 360;

  // 3. Horizontal Distance (meters on the WGS84 ellipsoid)
  const horizontalDistance = geo.distance;

  // 4. Elevation & Slope
  const rise = p2.elevation - p1.elevation; // Perubahan Vertikal (Elevation Diff)
  const run = horizontalDistance; // Perubahan Horizontal
  
  // Slope (Persentase): Menggunakan rumus (Rise / Run) * 100
  // Ini adalah standar dalam teknik sipil, pembuatan jalan, dan konstruksi.
  // Artinya: Medan turun/naik X unit vertikal untuk setiap 100 unit horizontal.
  const slope = run > 0 ? (rise / run) * 100 : 0;
  
  // Slope (Derajat): Menggunakan rumus arctan(Rise / Run)
  // Ini lebih sering digunakan dalam geologi, navigasi, dan pendakian.
  // Artinya: Sudut yang terbentuk antara garis horizontal dengan permukaan tanah.
  const slopeDegrees = run > 0 
    ? Math.atan(rise / run) * (180 / Math.PI) 
    : 0;

  return {
    forwardAzimuth,
    backAzimuth,
    horizontalDistance,
    slope,
    slopeDegrees,
    elevationDiff: rise
  };
};

/**
 * Format degrees to "DDD°"
 */
export const formatDegrees = (deg: number): string => {
  return `${deg.toFixed(1).padStart(5, '0')}°`;
};

/**
 * Format distance
 */
export const formatDistance = (meters: number): string => {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2)} km`;
  }
  return `${meters.toFixed(1)} m`;
};

/**
 * Converts decimal degrees to DMS (Degrees, Minutes, Seconds) format
 */
export const toDMS = (deg: number, isLat: boolean): string => {
  const absolute = Math.abs(deg);
  const degrees = Math.floor(absolute);
  const minutesNotTruncated = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesNotTruncated);
  const seconds = ((minutesNotTruncated - minutes) * 60).toFixed(2);

  const hemisphere = isLat 
    ? (deg >= 0 ? 'N' : 'S') 
    : (deg >= 0 ? 'E' : 'W');

  return `${degrees}°${minutes}'${seconds}" ${hemisphere}`;
};

/**
 * Converts decimal latitude & longitude (WGS84)
 * to UTM coordinate string
 */
export const toUTM = (lat: number, lon: number): string => {
  const a = 6378137.0; // WGS84 major axis
  const f = 1 / 298.257223563;
  const k0 = 0.9996;

  const e = Math.sqrt(f * (2 - f));
  const eSq = e * e;
  const ePrimeSq = eSq / (1 - eSq);

  const latRad = (lat * Math.PI) / 180;
  const lonRad = (lon * Math.PI) / 180;

  // Zone number
  const zoneNumber = Math.floor((lon + 180) / 6) + 1;

  // Central meridian
  const lonOrigin = (zoneNumber - 1) * 6 - 180 + 3;
  const lonOriginRad = (lonOrigin * Math.PI) / 180;

  const N = a / Math.sqrt(1 - eSq * Math.sin(latRad) ** 2);
  const T = Math.tan(latRad) ** 2;
  const C = ePrimeSq * Math.cos(latRad) ** 2;
  const A = Math.cos(latRad) * (lonRad - lonOriginRad);

  const M =
    a *
    ((1 -
      eSq / 4 -
      (3 * eSq ** 2) / 64 -
      (5 * eSq ** 3) / 256) *
      latRad -
      ((3 * eSq) / 8 +
        (3 * eSq ** 2) / 32 +
        (45 * eSq ** 3) / 1024) *
        Math.sin(2 * latRad) +
      ((15 * eSq ** 2) / 256 +
        (45 * eSq ** 3) / 1024) *
        Math.sin(4 * latRad) -
      ((35 * eSq ** 3) / 3072) *
        Math.sin(6 * latRad));

  let easting =
    k0 *
      N *
      (A +
        ((1 - T + C) * A ** 3) / 6 +
        ((5 - 18 * T + T ** 2 + 72 * C - 58 * ePrimeSq) *
          A ** 5) /
          120) +
    500000.0;

  let northing =
    k0 *
    (M +
      N *
        Math.tan(latRad) *
        (A ** 2 / 2 +
          ((5 - T + 9 * C + 4 * C ** 2) * A ** 4) / 24 +
          ((61 -
            58 * T +
            T ** 2 +
            600 * C -
            330 * ePrimeSq) *
            A ** 6) /
            720));

  // Southern Hemisphere adjustment
  const hemisphere = lat >= 0 ? "N" : "S";
  if (lat < 0) {
    northing += 10000000.0;
  }

  return `${zoneNumber}${hemisphere} ${Math.round(
    easting
  )} mE ${Math.round(northing)} mN`;
};

type LngLat = [number, number];

/**
 * Snaps the direction of the segment last -> target to a multiple of `step` degrees:
 * the turn from the previous segment prev -> last when there is one, otherwise the
 * azimuth from north. The distance follows the cursor along the snapped direction.
 */
export const snapToAngle = (prev: LngLat | null, last: LngLat, target: LngLat, step: number): LngLat => {
  const from = turf.point(last);
  const base = prev ? turf.bearing(turf.point(prev), from) : 0;
  const bearing = turf.bearing(from, turf.point(target));
  const distance = turf.distance(from, turf.point(target), { units: 'meters' });

  const turn = ((((bearing - base) % 360) + 540) % 360) - 180; // -180..180
  const snappedTurn = Math.round(turn / step) * step;
  const along = distance * Math.cos(((turn - snappedTurn) * Math.PI) / 180);

  return turf.destination(from, along, base + snappedTurn, { units: 'meters' }).geometry
    .coordinates as LngLat;
};

// Local flat coordinates in meters (x = east, y = north) around an origin, accurate
// enough for drawing curves between nearby survey points
const METERS_PER_DEGREE = (Math.PI / 180) * 6378137;
const toLocal = (origin: LngLat, [lng, lat]: LngLat): LngLat => [
  (lng - origin[0]) * METERS_PER_DEGREE * Math.cos(toRad(origin[1])),
  (lat - origin[1]) * METERS_PER_DEGREE,
];
const fromLocal = (origin: LngLat, [x, y]: LngLat): LngLat => [
  origin[0] + x / (METERS_PER_DEGREE * Math.cos(toRad(origin[1]))),
  origin[1] + y / METERS_PER_DEGREE,
];

type LinePoint = Pick<SurveyPoint, 'lng' | 'lat' | 'corner' | 'handle'>;

/** Bezier handle (meters east/north) pointing from `point` towards the dragged `target` */
export const handleFromDrag = (point: Pick<SurveyPoint, 'lng' | 'lat'>, target: LngLat): SurveyHandle => {
  const [east, north] = toLocal([point.lng, point.lat], target);
  return { east, north };
};

/** Ends of a point's two handles: `out` towards the next point, `in` towards the previous one */
export const handleEnds = (point: Pick<SurveyPoint, 'lng' | 'lat'>, handle: SurveyHandle) => {
  const origin: LngLat = [point.lng, point.lat];
  return {
    out: fromLocal(origin, [handle.east, handle.north]),
    in: fromLocal(origin, [-handle.east, -handle.north]),
  };
};

/**
 * Cubic Bezier control points of every segment, in local meters around the first point.
 * A point with a handle (dragged like a pen tool) uses it on both sides; a smooth point
 * without one gets an automatic tangent (Catmull-Rom); a sharp point, and the two ends of
 * the line, get none, which makes a corner.
 */
const segmentControls = (points: LinePoint[]) => {
  const origin: LngLat = [points[0].lng, points[0].lat];
  const xy = points.map((p) => toLocal(origin, [p.lng, p.lat]));
  const last = points.length - 1;

  const tangent = (i: number): LngLat => {
    const h = points[i].handle;
    if (h) return [h.east, h.north];
    if (points[i].corner === 'sharp' || i === 0 || i === last) return [0, 0];
    return [(xy[i + 1][0] - xy[i - 1][0]) / 6, (xy[i + 1][1] - xy[i - 1][1]) / 6];
  };
  const tangents = points.map((_, i) => tangent(i));

  const segments = [];
  for (let i = 0; i < last; i++) {
    const [p0, p3] = [xy[i], xy[i + 1]];
    const c1: LngLat = [p0[0] + tangents[i][0], p0[1] + tangents[i][1]];
    const c2: LngLat = [p3[0] - tangents[i + 1][0], p3[1] - tangents[i + 1][1]];
    const straight = c1[0] === p0[0] && c1[1] === p0[1] && c2[0] === p3[0] && c2[1] === p3[1];
    segments.push({ p0, c1, c2, p3, straight });
  }
  return { origin, segments };
};

const bezierAt = (p0: LngLat, c1: LngLat, c2: LngLat, p3: LngLat, t: number): LngLat => {
  const u = 1 - t;
  const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return [a * p0[0] + b * c1[0] + c * c2[0] + d * p3[0], a * p0[1] + b * c1[1] + c * c2[1] + d * p3[1]];
};

const CURVE_SAMPLES = 32;

/**
 * Coordinates of a survey line: straight segments, sharp corners and Bezier curves as set
 * per point (see segmentControls). The survey points themselves are always on the line.
 */
export const buildSurveyLine = (points: LinePoint[]): LngLat[] => {
  if (points.length < 2) return points.map((p) => [p.lng, p.lat]);
  const { origin, segments } = segmentControls(points);

  const line: LngLat[] = [[points[0].lng, points[0].lat]];
  segments.forEach((s, i) => {
    if (!s.straight) {
      for (let k = 1; k < CURVE_SAMPLES; k++) {
        line.push(fromLocal(origin, bezierAt(s.p0, s.c1, s.c2, s.p3, k / CURVE_SAMPLES)));
      }
    }
    line.push([points[i + 1].lng, points[i + 1].lat]);
  });
  return line;
};

/** Middle of each drawn segment (on the curve when it bends), for its distance label */
export const segmentMidpoints = (points: LinePoint[]): LngLat[] => {
  if (points.length < 2) return [];
  const { origin, segments } = segmentControls(points);
  return segments.map((s) => fromLocal(origin, bezierAt(s.p0, s.c1, s.c2, s.p3, 0.5)));
};
