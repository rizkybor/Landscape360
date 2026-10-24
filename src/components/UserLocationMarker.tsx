import { useEffect, useState } from 'react';
import { Marker } from 'react-map-gl/mapbox';

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

  return (
    <Marker longitude={coords.longitude} latitude={coords.latitude} anchor="center">
        {/* Container for the marker */}
        <div className="relative flex items-center justify-center w-12 h-12 pointer-events-none">
            {/* Pulsing Outer Ring (Animation) */}
            <div className="absolute w-full h-full bg-ember-500 rounded-full opacity-30 animate-ping" />
            
            {/* Static Outer Ring (Semi-transparent) */}
            <div className="absolute w-6 h-6 bg-ember-500/25 rounded-full" />

            {/* Core Dot (White Stroke + Blue Fill) */}
            <div className="relative w-4 h-4 bg-ember-500 border-[3px] border-white rounded-full shadow-md shadow-ember-900/40 z-10" />

            {/* Heading Indicator (Cone) - Visible if heading exists */}
            {coords.heading !== null && !isNaN(coords.heading) && (
                <div 
                    className="absolute w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[10px] border-b-ember-500 -translate-y-4 origin-bottom"
                    style={{ transform: `rotate(${coords.heading}deg) translateY(-10px)` }}
                />
            )}
        </div>
    </Marker>
  );
};
