import { useState, useRef } from "react";
import { MapBoxContainer } from "./MapBoxContainer";
import { Split, Maximize } from "lucide-react";
// import { ScreenshotControl } from "./ScreenshotControl";
import { SEO } from "./SEO";
import type { MapRef } from "react-map-gl/mapbox";

export const MapDashboard = ({ initialLocation }: { initialLocation?: [number, number] | null }) => {
  const [isSplitScreen, setIsSplitScreen] = useState(false);

  const mainMapRef = useRef<MapRef | null>(null);
  const leftMapRef = useRef<MapRef | null>(null);
  const rightMapRef = useRef<MapRef | null>(null);

  return (
    <div className="w-full h-screen bg-gray-900 relative overflow-hidden">
      <SEO />
      {isSplitScreen ? (
        <div className="flex flex-col md:flex-row w-full h-full">
          {/* Left/Top Panel (2D) */}
          <div className="w-full h-1/2 md:w-1/2 md:h-full border-b md:border-b-0 md:border-r border-gray-700 relative group">
            <div className="absolute top-4 left-4 z-20 bg-black/60 text-white px-3 py-1.5 rounded-full text-xs font-bold backdrop-blur-md border border-white/10 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              2D Topo
            </div>
            <MapBoxContainer
              overrideViewMode="2D"
              showControls={false}
              mapRef={leftMapRef}
              initialLocation={initialLocation}
            />
            {/* Sync Indicator */}
            <div className="absolute bottom-4 right-4 z-20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <span className="text-[10px] text-white/50 bg-black/50 px-2 py-1 rounded">Synced</span>
            </div>
          </div>

          {/* Right/Bottom Panel (3D) */}
          <div className="w-full h-1/2 md:w-1/2 md:h-full relative group">
            <div className="absolute top-4 right-16 md:right-20 z-20 bg-black/60 text-white px-3 py-1.5 rounded-full text-xs font-bold backdrop-blur-md border border-white/10 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              3D Terrain
            </div>
            <MapBoxContainer
              overrideViewMode="3D"
              showControls={true}
              mapRef={rightMapRef}
              initialLocation={initialLocation}
            />
          </div>
        </div>
      ) : (
        <MapBoxContainer 
          mapRef={mainMapRef} 
          initialLocation={initialLocation}
        />
      )}

      {/* Split Screen Toggle */}
      <button
        onClick={() => setIsSplitScreen(!isSplitScreen)}
        className={`
          cursor-pointer absolute z-30 
          bg-white/10 backdrop-blur-md 
          border border-white/20 
          p-3 rounded-full shadow-lg 
          text-white 
          transition-all duration-300
          hover:bg-white/20 hover:scale-105 hover:border-white/40
          active:scale-95
          ${isSplitScreen 
            ? 'bottom-8 left-1/2 -translate-x-1/2 md:bottom-8 md:left-8 md:translate-x-0 bg-blue-600/80 border-blue-400/50 hover:bg-blue-600' 
            : 'bottom-20 md:bottom-8 left-4 md:left-8'
          }
        `}
        title={isSplitScreen ? "Exit Split Screen" : "Enter Split Screen"}
      >
        {isSplitScreen ? <Maximize size={20} /> : <Split size={20} />}
      </button>
    </div>
  );
};
