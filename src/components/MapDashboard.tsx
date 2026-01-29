import { useState } from 'react';
import { MapBoxContainer } from './MapBoxContainer';
import { Split, Maximize } from 'lucide-react';

export const MapDashboard = () => {
  const [isSplitScreen, setIsSplitScreen] = useState(false);

  return (
    <div className="w-full h-screen bg-gray-900 relative overflow-hidden">
      {isSplitScreen ? (
        <div className="flex w-full h-full">
          <div className="w-1/2 h-full border-r border-gray-700 relative">
             <div className="absolute top-4 right-4 z-20 bg-black/50 text-white px-2 py-1 rounded text-xs pointer-events-none backdrop-blur-sm">2D View</div>
             {/* Hide main controls in split view left panel to avoid clutter, maybe just show contours? */}
             <MapBoxContainer overrideViewMode="2D" showControls={false} />
          </div>
          <div className="w-1/2 h-full relative">
             <div className="absolute top-4 right-16 z-20 bg-black/50 text-white px-2 py-1 rounded text-xs pointer-events-none backdrop-blur-sm">3D View</div>
             <MapBoxContainer overrideViewMode="3D" showControls={true} />
          </div>
        </div>
      ) : (
        <MapBoxContainer />
      )}

      {/* Split Screen Toggle */}
      <button
        onClick={() => setIsSplitScreen(!isSplitScreen)}
        className="absolute bottom-8 left-8 z-30 bg-white text-gray-900 p-3 rounded-full shadow-xl hover:bg-gray-100 transition-colors border-2 border-transparent hover:border-gray-200"
        title={isSplitScreen ? "Single View" : "Split Screen"}
      >
        {isSplitScreen ? <Maximize size={20} /> : <Split size={20} />}
      </button>
    </div>
  );
};
