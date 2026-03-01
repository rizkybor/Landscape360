import * as turf from '@turf/turf';
import type { SurveyPoint } from '../store/useSurveyStore';

export interface AzimuthData {
  forwardAzimuth: number; // degrees
  backAzimuth: number;    // degrees
  horizontalDistance: number; // meters
  slope: number; // percentage
  slopeDegrees: number; // degrees
  elevationDiff: number; // meters
}

/**
 * Calculates survey data between two points
 */
export const getAzimuthData = (p1: SurveyPoint, p2: SurveyPoint): AzimuthData => {
  const from = turf.point([p1.lng, p1.lat]);
  const to = turf.point([p2.lng, p2.lat]);

  // 1. Forward Azimuth
  const bearing = turf.bearing(from, to);
  const forwardAzimuth = (bearing + 360) % 360;

  // 2. Back Azimuth
  // Formula: (ForwardAzimuth + 180) % 360
  const backAzimuth = (forwardAzimuth + 180) % 360;

  // 3. Horizontal Distance
  const horizontalDistance = turf.distance(from, to, { units: 'kilometers' }) * 1000;

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
