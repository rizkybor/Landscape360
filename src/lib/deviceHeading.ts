// Compass heading of the phone / tablet: where its top edge points, in degrees clockwise
// from north, from the device orientation sensors.
//
// iPhone / iPad: `webkitCompassHeading`, only after DeviceOrientationEvent.requestPermission()
// was called from a tap. Android (Chrome): `deviceorientationabsolute`, whose alpha is
// counter-clockwise from north.
//
// The sensors use the phone's physical frame, and the needle is drawn on the map whose
// north is "screen up", so no correction for the screen turning sideways is needed: the
// needle always shows where the top edge of the phone points, whichever way the UI rotates.

type OrientationEventWithCompass = DeviceOrientationEvent & {
  webkitCompassHeading?: number;
  webkitCompassAccuracy?: number;
};

type PermissionRequester = { requestPermission?: () => Promise<'granted' | 'denied'> };

const normalize = (deg: number) => ((deg % 360) + 360) % 360;

export interface CompassReading {
  /** Degrees clockwise from north; null while the iOS compass is not calibrated */
  heading: number | null;
  /** iOS only: error in degrees, -1 = not calibrated. Android gives none (null). */
  accuracy: number | null;
}

/** Compass data from one orientation event, or null when the event has none (relative only) */
export const readCompass = (e: OrientationEventWithCompass): CompassReading | null => {
  if (typeof e.webkitCompassHeading === 'number' && !Number.isNaN(e.webkitCompassHeading)) {
    const accuracy = typeof e.webkitCompassAccuracy === 'number' ? e.webkitCompassAccuracy : null;
    return { heading: accuracy !== null && accuracy < 0 ? null : normalize(e.webkitCompassHeading), accuracy };
  }
  if (e.absolute && typeof e.alpha === 'number') return { heading: normalize(360 - e.alpha), accuracy: null };
  return null;
};

/** Heading in degrees from one orientation event, or null when it has no usable compass data */
export const headingFromEvent = (e: OrientationEventWithCompass): number | null => readCompass(e)?.heading ?? null;

// --- Calibration hint ---------------------------------------------------------------------
// A web page cannot calibrate the sensor (the phone does, with the figure-8 motion); it can
// only notice when readings are not trustworthy. iOS reports an accuracy; Android does not,
// so there a jump of 40°+ between two readings a few ms apart (impossible by hand) counts
// as noise, and three such jumps within 3 s mean the compass needs calibrating.
const POOR_ACCURACY_DEG = 30;
const JUMP_DEG = 40;
const JUMP_WINDOW_MS = 100;
const JUMPS_NEEDED = 3;
const JUMPS_WITHIN_MS = 3000;
const POOR_HOLD_MS = 4000;

export const createCompassQualityTracker = () => {
  let last: number | null = null;
  let lastAt = 0;
  let jumps: number[] = [];
  let poorUntil = 0;
  return {
    /** Feed every reading; returns whether the compass currently looks trustworthy */
    push(reading: CompassReading, now = Date.now()): 'ok' | 'poor' {
      if (reading.accuracy !== null) {
        return reading.accuracy < 0 || reading.accuracy > POOR_ACCURACY_DEG ? 'poor' : 'ok';
      }
      if (reading.heading === null) return 'ok';
      if (last !== null && now - lastAt < JUMP_WINDOW_MS) {
        const delta = Math.abs((((reading.heading - last) % 360) + 540) % 360 - 180);
        if (delta > JUMP_DEG) jumps.push(now);
      }
      last = reading.heading;
      lastAt = now;
      jumps = jumps.filter((t) => now - t < JUMPS_WITHIN_MS);
      if (jumps.length >= JUMPS_NEEDED) {
        poorUntil = now + POOR_HOLD_MS;
        jumps = [];
      }
      return now < poorUntil ? 'poor' : 'ok';
    },
  };
};

/** True when the browser needs a tap before it shares the compass (iOS 13+) */
export const compassNeedsPermission = () =>
  typeof DeviceOrientationEvent !== 'undefined' &&
  typeof (DeviceOrientationEvent as unknown as PermissionRequester).requestPermission === 'function';

let permission: 'unknown' | 'granted' | 'denied' = compassNeedsPermission() ? 'unknown' : 'granted';

/**
 * Call from a tap (e.g. "Find my location"). On iOS this shows the "allow motion and
 * orientation" prompt; the listener from watchDeviceHeading then starts receiving data.
 * Elsewhere it resolves at once (current Chrome also has requestPermission and grants it).
 */
export const requestCompassPermission = async (): Promise<boolean> => {
  if (permission !== 'unknown') return permission === 'granted';
  try {
    const result = await (DeviceOrientationEvent as unknown as PermissionRequester).requestPermission!();
    permission = result === 'granted' ? 'granted' : 'denied';
  } catch {
    permission = 'denied';
  }
  return permission === 'granted';
};

/**
 * Calls `onReading` with every compass reading (heading null while uncalibrated). Listens right away:
 * Android sends readings without asking, iOS starts once requestCompassPermission() is
 * allowed. Returns a function that stops it.
 */
export const watchDeviceHeading = (onReading: (reading: CompassReading) => void) => {
  if (typeof window === 'undefined') return () => undefined;
  // Chrome on Android sends the compass on deviceorientationabsolute; iOS (with
  // webkitCompassHeading), Samsung Internet and Firefox send it on deviceorientation.
  // Listen to both and take whichever has a compass reading; once the absolute event
  // has delivered, the other one (relative on Chrome) is ignored.
  let absoluteWorks = false;
  const onAbsolute = (e: Event) => {
    const reading = readCompass(e as OrientationEventWithCompass);
    if (!reading) return;
    absoluteWorks = true;
    onReading(reading);
  };
  const onOrientation = (e: Event) => {
    if (absoluteWorks) return;
    const reading = readCompass(e as OrientationEventWithCompass);
    if (reading) onReading(reading);
  };
  window.addEventListener('deviceorientationabsolute', onAbsolute);
  window.addEventListener('deviceorientation', onOrientation);
  return () => {
    window.removeEventListener('deviceorientationabsolute', onAbsolute);
    window.removeEventListener('deviceorientation', onOrientation);
  };
};

/**
 * iOS only shares the compass after a tap: ask on the first tap anywhere in the app (the
 * "Find my location" button asks too). Returns a function that stops waiting.
 */
export const askCompassOnFirstTap = () => {
  if (typeof document === 'undefined' || permission !== 'unknown') return () => undefined;
  // "click" only: it does not fire after a map drag, so the prompt waits for a real tap.
  // requestPermission runs synchronously inside the handler, as Safari requires.
  const ask = () => {
    stop();
    requestCompassPermission();
  };
  const stop = () => document.removeEventListener('click', ask, true);
  document.addEventListener('click', ask, true);
  return stop;
};
