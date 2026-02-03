import React from "react";
import { Plus, Minus, Compass, Crosshair } from "lucide-react";
import type { MapRef } from "react-map-gl/mapbox";

interface NavigationControlsProps {
  mapRef: React.RefObject<MapRef | null>;
  onGeolocate: () => void;
  bearing: number;
}

export const NavigationControls: React.FC<NavigationControlsProps> = ({
  mapRef,
  onGeolocate,
  bearing,
}) => {
  const handleZoomIn = () => {
    mapRef.current?.getMap().zoomIn();
  };

  const handleZoomOut = () => {
    mapRef.current?.getMap().zoomOut();
  };

  const handleResetNorth = () => {
    mapRef.current?.getMap().resetNorthPitch();
  };

  return (
    <div className="absolute top-4 right-4 flex flex-col gap-4 z-20">
      {/* Find My Location Button */}
      <button
        onClick={onGeolocate}
        className="bg-white/90 backdrop-blur-sm p-2.5 rounded-xl shadow-lg border border-white/20 hover:bg-white hover:text-blue-600 transition-all active:scale-95 group cursor-pointer"
        title="Find My Location"
      >
        <Crosshair
          size={20}
          className="text-gray-700 group-hover:text-blue-600 transition-colors"
        />
      </button>

      {/* Navigation Stack */}
      <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-white/20 flex flex-col overflow-hidden">
        {/* Zoom In */}
        <button
          onClick={handleZoomIn}
          className="p-2.5 hover:bg-gray-100 transition-colors active:bg-gray-200 border-b border-gray-200/50 cursor-pointer group"
          title="Zoom In"
        >
          <Plus size={20} className="text-gray-700 group-hover:text-black transition-colors" />
        </button>

        {/* Zoom Out */}
        <button
          onClick={handleZoomOut}
          className="p-2.5 hover:bg-gray-100 transition-colors active:bg-gray-200 border-b border-gray-200/50 cursor-pointer group"
          title="Zoom Out"
        >
          <Minus size={20} className="text-gray-700 group-hover:text-black transition-colors" />
        </button>

        {/* Reset Bearing */}
        <button
          onClick={handleResetNorth}
          className="p-2.5 hover:bg-gray-100 transition-colors active:bg-gray-200 group cursor-pointer relative"
          title="Reset Bearing to North"
        >
          <div
            className="transition-transform duration-300 ease-out relative"
            style={{ transform: `rotate(${-bearing}deg)` }}
          >
            <Compass
              size={20}
              className={`text-gray-700 group-hover:text-blue-600 transition-colors ${bearing !== 0 ? "text-blue-600" : ""}`}
              style={{ transform: "rotate(-45deg)" }}
            />
            {/* North Indicator "N" - Always stays at top of compass icon relative to rotation */}
            <span className="absolute -top-1 left-1/2 -translate-x-1/2 text-[8px] font-bold text-red-500 bg-white/80 rounded-full px-0.5 leading-none shadow-sm">
              N
            </span>
          </div>
        </button>
      </div>
    </div>
  );
};
