import { useEffect, useRef, useState } from 'react';
import { Marker } from 'react-map-gl/mapbox';
import { X } from 'lucide-react';
import { askCompassOnFirstTap, createCompassQualityTracker, watchDeviceHeading } from '../lib/deviceHeading';

// Below this change (degrees) the heading beam is not moved, so sensor noise does not shake it
const MIN_TURN_DEG = 1.5;
// Set once the user closes the calibration hint: it then never shows again on this device
const HINT_DISMISSED_KEY = 'l360-compass-hint-dismissed';
const readDismissed = () => {
  try {
    return localStorage.getItem(HINT_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
};

export const UserLocationMarker = ({ initialLocation }: { initialLocation?: [number, number] | null }) => {
  const [coords, setCoords] = useState<{longitude: number, latitude: number, heading: number | null} | null>(
    initialLocation ? { longitude: initialLocation[0], latitude: initialLocation[1], heading: null } : null
  );

  useEffect(() => {
    // If initialLocation changes and we don't have coords, update them
    if (initialLocation && !coords) {
        setCoords({
            longitude: initialLocation[0],
            latitude: initialLocation[1],
            heading: null
        });
    }
  }, [initialLocation]);

  // Where the phone points (compass). Updated straight on the DOM: the sensor fires ~60
  // times a second and re-rendering the map marker that often would warm the phone.
  const headingRef = useRef<HTMLDivElement>(null);
  const shownAngle = useRef<number | null>(null); // unwrapped, so 359° -> 1° turns 2°, not 358°
  const [hasCompass, setHasCompass] = useState(false);
  // Small one-time hint under the dot while the compass looks off; gone once it settles
  const [showCalibrateHint, setShowCalibrateHint] = useState(false);
  const hintUsed = useRef(readDismissed());
  const dismissHint = () => {
    setShowCalibrateHint(false);
    hintUsed.current = true;
    try {
      localStorage.setItem(HINT_DISMISSED_KEY, '1');
    } catch {
      // Storage blocked: hidden for this session only
    }
  };

  useEffect(() => {
    let frame = 0;
    let latest: number | null = null;
    const apply = () => {
      frame = 0;
      const el = headingRef.current;
      if (latest === null || !el) return;
      const prev = shownAngle.current;
      let next = latest;
      if (prev !== null) {
        const delta = ((latest - prev) % 360 + 540) % 360 - 180; // shortest way round
        if (Math.abs(delta) < MIN_TURN_DEG) return;
        next = prev + delta;
      }
      shownAngle.current = next;
      el.style.transform = `rotate(${next}deg)`;
    };
    const stopAsking = askCompassOnFirstTap();
    const quality = createCompassQualityTracker();
    let hintTimer = 0;
    const stop = watchDeviceHeading((reading) => {
      const q = quality.push(reading);
      if (q === 'poor' && !hintUsed.current) {
        hintUsed.current = true;
        setShowCalibrateHint(true);
        hintTimer = window.setTimeout(() => setShowCalibrateHint(false), 12000);
      } else if (q === 'ok' && hintUsed.current) {
        setShowCalibrateHint(false);
      }
      if (reading.heading === null) return;
      // Only real compass readings get here; once one did, the needle stays
      latest = reading.heading;
      setHasCompass(true);
      if (!frame) frame = requestAnimationFrame(apply);
    });
    return () => {
      stop();
      stopAsking();
      if (frame) cancelAnimationFrame(frame);
      window.clearTimeout(hintTimer);
    };
  }, []);

  // The beam element is new when it (re)appears: the next reading sets its angle
  useEffect(() => {
    if (hasCompass) shownAngle.current = null;
  }, [hasCompass]);

  useEffect(() => {
    if (!navigator.geolocation) return;

    let watchId: number | null = null;

    const start = () => {
      if (watchId !== null) return;
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const next = {
            longitude: pos.coords.longitude,
            latitude: pos.coords.latitude,
            heading: pos.coords.heading,
          };
          // Skip GPS jitter under ~1 m so the marker does not re-render for nothing
          setCoords((prev) =>
            prev &&
            prev.heading === next.heading &&
            Math.abs(prev.latitude - next.latitude) < 0.00001 &&
            Math.abs(prev.longitude - next.longitude) < 0.00001
              ? prev
              : next,
          );
        },
        (err) => {
            // Silent fail or debug log
            console.warn("Location watch error:", err);
        },
        {
            enableHighAccuracy: true,
            // Accept a fix up to 5 s old instead of forcing a fresh one every time
            maximumAge: 5000,
            timeout: 15000
        }
      );
    };

    const stop = () => {
      if (watchId === null) return;
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    };

    // Turn the GPS off while the app is in the background (track recording and live
    // tracking use their own watchers and keep running)
    const onVisibilityChange = () => (document.hidden ? stop() : start());

    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      stop();
    };
  }, []);

  if (!coords) return null;

  // Compass first; without one, the GPS course while moving
  const gpsHeading = coords.heading !== null && !isNaN(coords.heading) ? coords.heading : null;
  const showHeading = hasCompass || gpsHeading !== null;

  return (
    <>
    {showCalibrateHint && (
      // Its own marker, so the text stays upright when the map is rotated
      <Marker longitude={coords.longitude} latitude={coords.latitude} anchor="top" offset={[0, 26]}>
        <div className="flex items-center gap-1 whitespace-nowrap pl-2 pr-1 py-0.5 rounded-full bg-white/90 border border-sand-200 shadow text-[9px] font-medium text-sand-700">
          Compass off: move the phone in a figure 8
          <button
            onClick={dismissHint}
            className="cursor-pointer p-0.5 rounded-full hover:bg-sand-100 text-sand-500 hover:text-ink"
            title="Don't show again"
            aria-label="Don't show this hint again"
          >
            <X size={10} />
          </button>
        </div>
      </Marker>
    )}
    {/* rotationAlignment "map": the marker turns with the map, so a heading measured from
        north still points the right way when the map is rotated */}
    <Marker longitude={coords.longitude} latitude={coords.latitude} anchor="center" rotationAlignment="map">
        <div className="relative flex items-center justify-center w-12 h-12 pointer-events-none">
            {/* Heading: a beam where the phone points, with a sharp needle at the dot */}
            {showHeading && (
                <div
                    ref={headingRef}
                    className="absolute inset-0 flex items-center justify-center transition-transform duration-150 ease-out"
                    style={hasCompass ? undefined : { transform: `rotate(${gpsHeading}deg)` }}
                    aria-hidden
                >
                    <svg width="88" height="88" viewBox="-44 -44 88 88" className="absolute overflow-visible">
                        <defs>
                            <radialGradient id="heading-beam" cx="0" cy="0" r="44" gradientUnits="userSpaceOnUse">
                                <stop offset="0.15" stopColor="#e46c24" stopOpacity="0.55" />
                                <stop offset="1" stopColor="#e46c24" stopOpacity="0" />
                            </radialGradient>
                        </defs>
                        {/* 70° wide beam pointing up (north before rotation) */}
                        <path d="M0 0 L-25.2 -36 A44 44 0 0 1 25.2 -36 Z" fill="url(#heading-beam)" />
                        {/* Needle tip */}
                        <path d="M0 -21 L5 -10 L0 -12.5 L-5 -10 Z" fill="#e46c24" stroke="#ffffff" strokeWidth="1.5" strokeLinejoin="round" />
                    </svg>
                </div>
            )}

            {/* Pulsing Outer Ring (Animation) */}
            <div className="absolute w-full h-full bg-ember-500 rounded-full opacity-30 animate-ping" />
            
            {/* Static Outer Ring (Semi-transparent) */}
            <div className="absolute w-6 h-6 bg-ember-500/25 rounded-full" />

            {/* Core Dot (White Stroke + Blue Fill) */}
            <div className="relative w-4 h-4 bg-ember-500 border-[3px] border-white rounded-full shadow-md shadow-ember-900/40 z-10" />
        </div>
    </Marker>
    </>
  );
};
