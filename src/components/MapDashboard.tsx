import { useState, useRef } from "react";
import { MapBoxContainer } from "./MapBoxContainer";
import { Split, Maximize } from "lucide-react";
// import { ScreenshotControl } from "./ScreenshotControl";
import { SEO } from "./SEO";
import type { MapRef } from "react-map-gl/mapbox";

export const MapDashboard = ({
  initialLocation,
}: {
  initialLocation?: [number, number] | null;
}) => {
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
          <div className="w-full h-[40%] md:w-1/2 md:h-full border-b-2 md:border-b-0 md:border-r-2 border-gray-800 relative group transition-all duration-300 ease-in-out">
            <div className="absolute top-4 right-16 md:right-20 z-20 bg-black/60 text-white px-3 py-1.5 rounded-full text-xs font-bold backdrop-blur-md border border-white/10 flex items-center gap-2 shadow-lg pointer-events-none select-none">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
              2D Topo
            </div>
            <MapBoxContainer
              overrideViewMode="2D"
              showControls={false}
              mapRef={leftMapRef}
              initialLocation={initialLocation}
            />
            {/* Sync Indicator */}
            <div className="absolute bottom-4 right-4 z-20 transition-opacity pointer-events-none opacity-0 group-hover:opacity-100 md:opacity-100">
              <span className="text-[10px] font-mono text-blue-300 bg-blue-900/50 border border-blue-500/30 px-2 py-1 rounded flex items-center gap-1 backdrop-blur-md shadow-lg">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>
                SYNC ACTIVE
              </span>
            </div>
          </div>

          {/* Right/Bottom Panel (3D) */}
          <div className="w-full h-[60%] md:w-1/2 md:h-full relative group transition-all duration-300 ease-in-out">
            <div className="absolute top-4 right-16 md:right-20 z-20 bg-black/60 text-white px-3 py-1.5 rounded-full text-xs font-bold backdrop-blur-md border border-white/10 flex items-center gap-2 shadow-lg pointer-events-none select-none">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
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

      {/* Split Screen Toggle - Hidden on mobile to prevent crash (2 WebGL contexts is too heavy) */}
      <div className="hidden md:block">
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
            ${
              isSplitScreen
                ? "bottom-8 left-8 translate-x-0 bg-blue-600/80 border-blue-400/50 hover:bg-blue-600"
                : "bottom-4 left-8 translate-x-0"
            }
          `}
          title={isSplitScreen ? "Exit Split Screen" : "Enter Split Screen"}
        >
          {isSplitScreen ? <Maximize size={20} /> : <Split size={20} />}
        </button>
      </div>
    </div>
  );
};
