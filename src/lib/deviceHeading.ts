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
export const watchDeviceHeading = (onHeading: (deg: number | null) => void) => {
  if (typeof window === 'undefined') return () => undefined;
  const absoluteEvent = 'ondeviceorientationabsolute' in window;
  const eventName = absoluteEvent ? 'deviceorientationabsolute' : 'deviceorientation';
  const handler = (e: Event) => onHeading(headingFromEvent(e as OrientationEventWithCompass));
  window.addEventListener(eventName, handler);
  return () => window.removeEventListener(eventName, handler);
};
