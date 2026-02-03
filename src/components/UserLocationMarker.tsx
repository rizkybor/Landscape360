import { useEffect, useState } from 'react';
import { Marker } from 'react-map-gl/mapbox';

export const UserLocationMarker = () => {
  const [coords, setCoords] = useState<{longitude: number, latitude: number, heading: number | null} | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;

    // Watch position
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setCoords({
            longitude: pos.coords.longitude,
            latitude: pos.coords.latitude,
            heading: pos.coords.heading
        });
      },
      (err) => {
          // Silent fail or debug log
          // console.warn("Location watch error:", err);
      },
      { 
          enableHighAccuracy: true, 
          maximumAge: 0, 
          timeout: 5000 
      }
    );

    return () => navigator.geolocation.clearWatch(id);
  }, []);

  if (!coords) return null;

  return (
    <Marker longitude={coords.longitude} latitude={coords.latitude} anchor="center">
        {/* Container for the marker */}
        <div className="relative flex items-center justify-center w-12 h-12 pointer-events-none">
            {/* Pulsing Outer Ring (Animation) */}
            <div className="absolute w-full h-full bg-blue-500 rounded-full opacity-20 animate-ping" />
            
            {/* Static Outer Ring (Semi-transparent) */}
            <div className="absolute w-6 h-6 bg-blue-500/30 rounded-full backdrop-blur-[1px]" />

            {/* Core Dot (White Stroke + Blue Fill) */}
            <div className="relative w-3.5 h-3.5 bg-blue-600 border-[2px] border-white rounded-full shadow-sm z-10" />

            {/* Heading Indicator (Cone) - Visible if heading exists */}
            {coords.heading !== null && !isNaN(coords.heading) && (
                <div 
                    className="absolute w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[10px] border-b-blue-600/80 -translate-y-4 origin-bottom"
                    style={{ transform: `rotate(${coords.heading}deg) translateY(-10px)` }}
                />
            )}
        </div>
    </Marker>
  );
};
