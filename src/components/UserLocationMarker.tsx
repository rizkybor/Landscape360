import { useEffect, useRef, useState } from 'react';
import { Marker } from 'react-map-gl/mapbox';
import { askCompassOnFirstTap, watchDeviceHeading } from '../lib/deviceHeading';

// Below this change (degrees) the heading beam is not moved, so sensor noise does not shake it
const MIN_TURN_DEG = 1.5;

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
    // Only real compass readings arrive here; once one did, the needle stays
    const stop = watchDeviceHeading((deg) => {
      latest = deg;
      setHasCompass(true);
      if (!frame) frame = requestAnimationFrame(apply);
    });
    return () => {
      stop();
      stopAsking();
      if (frame) cancelAnimationFrame(frame);
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
    // rotationAlignment "map": the marker turns with the map, so a heading measured from
    // north still points the right way when the map is rotated
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
  );
};
