// Compass heading of the phone / tablet (where its top edge points, degrees clockwise from
// true-ish north), from the device orientation sensors.
//
// iPhone / iPad: `webkitCompassHeading`, only after DeviceOrientationEvent.requestPermission()
// was called from a tap. Android (Chrome): `deviceorientationabsolute`, whose alpha is
// counter-clockwise from north. Both are corrected for the screen being turned sideways.

type OrientationEventWithCompass = DeviceOrientationEvent & {
  webkitCompassHeading?: number;
  webkitCompassAccuracy?: number;
};

type PermissionRequester = { requestPermission?: () => Promise<'granted' | 'denied'> };

const normalize = (deg: number) => ((deg % 360) + 360) % 360;

const screenAngle = () => {
  const angle = typeof screen !== 'undefined' ? screen.orientation?.angle : undefined;
  if (typeof angle === 'number') return angle;
  // Older iOS
  const legacy = (window as unknown as { orientation?: number }).orientation;
  return typeof legacy === 'number' ? legacy : 0;
};

/** Heading in degrees from one orientation event, or null when it has no compass data */
export const headingFromEvent = (e: OrientationEventWithCompass, angle = screenAngle()): number | null => {
  if (typeof e.webkitCompassHeading === 'number' && !Number.isNaN(e.webkitCompassHeading)) {
    // iOS: -1 accuracy means the compass is not calibrated
    if (typeof e.webkitCompassAccuracy === 'number' && e.webkitCompassAccuracy < 0) return null;
    return normalize(e.webkitCompassHeading + angle);
  }
  if (e.absolute && typeof e.alpha === 'number') return normalize(360 - e.alpha + angle);
  return null;
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
 * Calls `onHeading` with the device heading (null when unavailable). Listens right away:
 * Android sends readings without asking, iOS starts once requestCompassPermission() is
 * allowed. Returns a function that stops it.
 */
export const watchDeviceHeading = (onHeading: (deg: number) => void) => {
  if (typeof window === 'undefined') return () => undefined;
  // Chrome on Android sends the compass on deviceorientationabsolute; iOS (with
  // webkitCompassHeading), Samsung Internet and Firefox send it on deviceorientation.
  // Listen to both and take whichever has a compass reading; once the absolute event
  // has delivered, the other one (relative on Chrome) is ignored.
  let absoluteWorks = false;
  const onAbsolute = (e: Event) => {
    const deg = headingFromEvent(e as OrientationEventWithCompass);
    if (deg === null) return;
    absoluteWorks = true;
    onHeading(deg);
  };
  const onOrientation = (e: Event) => {
    if (absoluteWorks) return;
    const deg = headingFromEvent(e as OrientationEventWithCompass);
    if (deg !== null) onHeading(deg);
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
