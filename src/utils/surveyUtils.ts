import * as turf from '@turf/turf';
import type { SurveyPoint } from '../store/useSurveyStore';

export interface AzimuthData {
  forwardAzimuth: number; // degrees
  backAzimuth: number;    // degrees
  horizontalDistance: number; // meters
  slope: number; // percentage
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
  const elevationDiff = p2.elevation - p1.elevation;
  
  // Slope in percentage: (rise / run) * 100
  // Handle division by zero
  const slope = horizontalDistance > 0 ? (elevationDiff / horizontalDistance) * 100 : 0;

  return {
    forwardAzimuth,
    backAzimuth,
    horizontalDistance,
    slope,
    elevationDiff
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
