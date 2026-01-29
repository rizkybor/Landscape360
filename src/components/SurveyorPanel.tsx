import React, { useState } from 'react';
import { useSurveyStore } from '../store/useSurveyStore';
import { getAzimuthData, formatDegrees, formatDistance } from '../utils/surveyUtils';
import { Trash2, Copy, X } from 'lucide-react';

export const SurveyorPanel = () => {
  const { points, removePoint, clearPoints, isPlotMode, togglePlotMode } = useSurveyStore();
  const [isMinimized, setIsMinimized] = useState(false);

  if (points.length === 0 && !isPlotMode) return null;

  const copyCoords = (point: { lng: number; lat: number }) => {
    navigator.clipboard.writeText(`${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`);
  };

  return (
    <div className="absolute top-20 right-4 z-20 w-80 bg-black/80 backdrop-blur-md border border-yellow-500/30 rounded-xl text-white shadow-2xl overflow-hidden font-mono">
      {/* Header */}
      <div className="bg-yellow-600/20 p-3 flex justify-between items-center border-b border-yellow-500/20 cursor-move">
        <h3 className="font-bold text-yellow-400 flex items-center gap-2">
          <span>📐</span> Surveyor Tool
        </h3>
        <div className="flex gap-2">
            <button onClick={() => setIsMinimized(!isMinimized)} className="text-gray-400 hover:text-white">
                {isMinimized ? 'Show' : 'Hide'}
            </button>
            <button onClick={togglePlotMode} className="text-gray-400 hover:text-white">
                <X size={16} />
            </button>
        </div>
      </div>

      {!isMinimized && (
        <div className="p-4 max-h-[60vh] overflow-y-auto">
          {/* Points List */}
          <div className="space-y-3 mb-4">
            {points.map((p, idx) => (
              <div key={p.id} className="relative pl-4 border-l-2 border-yellow-500/50">
                <div className="flex justify-between items-start">
                    <span className="text-xs text-yellow-200 font-bold">PT-{idx + 1}</span>
                    <div className="flex gap-1">
                        <button onClick={() => copyCoords(p)} className="p-1 hover:bg-white/10 rounded" title="Copy Coordinates">
                            <Copy size={12} />
                        </button>
                        <button onClick={() => removePoint(p.id)} className="p-1 hover:bg-red-500/20 text-red-400 rounded" title="Remove Point">
                            <Trash2 size={12} />
                        </button>
                    </div>
                </div>
                <div className="text-[10px] text-gray-300">
                  <div>Lat: {p.lat.toFixed(6)}</div>
                  <div>Lng: {p.lng.toFixed(6)}</div>
                  <div>Elev: {p.elevation.toFixed(1)}m</div>
                </div>

                {/* Calculation to next point */}
                {idx < points.length - 1 && (
                    <div className="mt-2 bg-white/5 p-2 rounded border border-white/10">
                        <DataCard p1={p} p2={points[idx+1]} />
                    </div>
                )}
              </div>
            ))}
          </div>

          {points.length > 0 && (
             <button 
                onClick={clearPoints}
                className="w-full py-2 bg-red-600/20 hover:bg-red-600/40 text-red-200 text-xs rounded border border-red-500/30 transition-colors"
             >
                Clear All Points
             </button>
          )}
          
          {points.length === 0 && (
              <div className="text-center text-xs text-gray-500 py-4">
                  Click on map to plot points
              </div>
          )}
        </div>
      )}
    </div>
  );
};

const DataCard = ({ p1, p2 }: { p1: any, p2: any }) => {
    const data = getAzimuthData(p1, p2);
    
    return (
        <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div>
                <div className="text-gray-500">Fwd Azimuth</div>
                <div className="text-yellow-400 font-bold">{formatDegrees(data.forwardAzimuth)}</div>
            </div>
            <div>
                <div className="text-gray-500">Back Azimuth</div>
                <div className="text-yellow-400 font-bold">{formatDegrees(data.backAzimuth)}</div>
            </div>
            <div>
                <div className="text-gray-500">Horiz Dist</div>
                <div className="text-blue-300 font-bold">{formatDistance(data.horizontalDistance)}</div>
            </div>
            <div>
                <div className="text-gray-500">Slope</div>
                <div className={`${Math.abs(data.slope) > 15 ? 'text-red-400' : 'text-green-400'} font-bold`}>
                    {data.slope.toFixed(1)}%
                </div>
            </div>
        </div>
    );
}
