import { useEffect, useState } from 'react';
import { Marker } from 'react-map-gl/mapbox';

// `hidden` hides the dot but keeps following the GPS, so it is back at once when shown again
export const UserLocationMarker = ({ initialLocation, hidden = false }: { initialLocation?: [number, number] | null; hidden?: boolean }) => {
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

  if (!coords || hidden) return null;

  // Direction of travel from the GPS while moving (the compass needle is in the mobile app)
  const gpsHeading = coords.heading !== null && !isNaN(coords.heading) ? coords.heading : null;

  return (
    // rotationAlignment "map": the marker turns with the map, so a heading measured from
    // north still points the right way when the map is rotated
    <Marker longitude={coords.longitude} latitude={coords.latitude} anchor="center" rotationAlignment="map">
        <div className="relative flex items-center justify-center w-12 h-12 pointer-events-none">
            {gpsHeading !== null && (
                <div
                    className="absolute inset-0 flex items-center justify-center"
                    style={{ transform: `rotate(${gpsHeading}deg)` }}
                    aria-hidden
                >
                    <svg width="88" height="88" viewBox="-44 -44 88 88" className="absolute overflow-visible">
                        <defs>
                            <radialGradient id="heading-beam" cx="0" cy="0" r="44" gradientUnits="userSpaceOnUse">
                                <stop offset="0.15" stopColor="#e46c24" stopOpacity="0.55" />
                                <stop offset="1" stopColor="#e46c24" stopOpacity="0" />
                            </radialGradient>
                        </defs>
                        <path d="M0 0 L-25.2 -36 A44 44 0 0 1 25.2 -36 Z" fill="url(#heading-beam)" />
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
