import { useState, useRef } from "react";
import { MapBoxContainer } from "./MapBoxContainer";
import { Split, Maximize } from "lucide-react";
import { ScreenshotControl } from "./ScreenshotControl";
import { SEO } from "./SEO";
import type { MapRef } from "react-map-gl/mapbox";

export const MapDashboard = () => {
  const [isSplitScreen, setIsSplitScreen] = useState(false);

  const mainMapRef = useRef<MapRef | null>(null);
  const leftMapRef = useRef<MapRef | null>(null);
  const rightMapRef = useRef<MapRef | null>(null);

  return (
    <div className="w-full h-screen bg-gray-900 relative overflow-hidden">
      <SEO />
      {isSplitScreen ? (
        <div className="flex w-full h-full">
          <div className="w-1/2 h-full border-r border-gray-700 relative">
            <div className="absolute top-4 right-4 z-20 bg-black/50 text-white px-2 py-1 rounded text-xs pointer-events-none backdrop-blur-sm">
              2D View
            </div>
            <MapBoxContainer
              overrideViewMode="2D"
              showControls={false}
              mapRef={leftMapRef}
            />
          </div>
          <div className="w-1/2 h-full relative">
            <div className="absolute top-4 right-16 z-20 bg-black/50 text-white px-2 py-1 rounded text-xs pointer-events-none backdrop-blur-sm">
              3D View
            </div>
            <MapBoxContainer
              overrideViewMode="3D"
              showControls={true}
              mapRef={rightMapRef}
            />
          </div>
        </div>
      ) : (
        <MapBoxContainer mapRef={mainMapRef} />
      )}

      {/* ScreenshotControl */}
      <ScreenshotControl
        mapRefs={isSplitScreen ? [leftMapRef, rightMapRef] : [mainMapRef]}
      />

      {/* Split Screen Toggle */}
      <button
        onClick={() => setIsSplitScreen(!isSplitScreen)}
        className="
          /* Positioning */
          cursor-pointer absolute bottom-12 md:bottom-8 left-8 z-30 
          
          /* Glassmorphism Core */
          bg-white/10 backdrop-blur-md 
          border border-white/20 
          
          /* Styling & Effects */
          p-3 rounded-full shadow-lg 
          text-white 
          transition-all duration-300
          
          /* Hover State */
          hover:bg-white/20 hover:scale-105 hover:border-white/40
          active:scale-95
        "
        title={isSplitScreen ? "Single View" : "Split Screen"}
      >
        {isSplitScreen ? <Maximize size={18} /> : <Split size={20} />}
      </button>
    </div>
  );
};
