import React, { useState, useRef, useEffect } from 'react';
import { useMapStore } from '../store/useMapStore';
import { useSurveyStore } from '../store/useSurveyStore';
import { Activity, RotateCw, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Eye, Monitor, Ruler } from 'lucide-react';

export const ControlPanel = () => {
  const { 
    contourInterval, setContourInterval,
    elevationExaggeration, setElevationExaggeration,
    opacity, setOpacity,
    activeView, setActiveView,
    pitch, bearing, setPitch, setBearing,
    mouseControlMode, setMouseControlMode
  } = useMapStore();

  const { isPlotMode, togglePlotMode } = useSurveyStore();

  const joystickRef = useRef<HTMLDivElement>(null);
  const [isJoystickDragging, setIsJoystickDragging] = useState(false);

  // Virtual Joystick Logic
  useEffect(() => {
    if (!isJoystickDragging) return;

    const handleMove = (e: MouseEvent) => {
       const sensitivity = 0.5;
       setBearing(bearing + e.movementX * sensitivity);
       setPitch(Math.min(85, Math.max(0, pitch + e.movementY * sensitivity)));
    };

    const handleUp = () => {
       setIsJoystickDragging(false);
       document.body.style.cursor = '';
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    
    return () => {
       window.removeEventListener('mousemove', handleMove);
       window.removeEventListener('mouseup', handleUp);
    };
  }, [isJoystickDragging, bearing, pitch, setBearing, setPitch]);

  const handleTilt = (delta: number) => {
    setPitch(Math.min(85, Math.max(0, pitch + delta)));
  };

  const handleRotate = (delta: number) => {
    setBearing(bearing + delta);
  };

  return (
    <div className="absolute top-4 left-4 z-10 bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-xl text-white w-64 shadow-xl max-h-[90vh] overflow-y-auto">
      <h3 className="font-bold mb-4 flex items-center gap-2">
        <Activity size={18} />
        Terrain Controls
      </h3>
      
      <div className="space-y-4">
        {/* On-Screen Virtual Joystick */}
        <div 
          ref={joystickRef}
          className="bg-black/40 p-3 rounded-lg cursor-move select-none active:bg-blue-600/20 transition-colors border border-white/5"
          onMouseDown={() => { setIsJoystickDragging(true); document.body.style.cursor = 'grabbing'; }}
        >
         
          
          <div className="flex gap-2">
             <button onClick={() => { setPitch(0); setBearing(0); }} className="flex-1 py-1 text-[10px] bg-white/10 hover:bg-white/20 rounded flex items-center justify-center gap-1">
               <Monitor size={12} /> Reset Top
             </button>
             <button onClick={() => { setPitch(80); }} className="flex-1 py-1 text-[10px] bg-white/10 hover:bg-white/20 rounded flex items-center justify-center gap-1">
               <Eye size={12} /> Side View
             </button>
          </div>
        </div>

        {/* Mouse Mode Toggle */}
        <div className="bg-blue-600/20 p-2 rounded text-[10px] text-blue-100 mb-2 space-y-2">
            <p className="font-semibold border-b border-blue-500/30 pb-1 mb-1">Mouse Interaction Mode</p>
            <div className="flex bg-black/20 rounded p-1">
               <button 
                 onClick={() => setMouseControlMode('camera')}
                 className={`flex-1 py-1 rounded transition-colors ${mouseControlMode === 'camera' ? 'bg-blue-500 text-white' : 'hover:bg-white/10'}`}
               >
                 Camera (Left=Rot)
               </button>
               <button 
                 onClick={() => setMouseControlMode('map')}
                 className={`flex-1 py-1 rounded transition-colors ${mouseControlMode === 'map' ? 'bg-blue-500 text-white' : 'hover:bg-white/10'}`}
               >
                 Map (Left=Pan)
               </button>
            </div>
            
            <div className="text-[10px] opacity-80 mt-1">
              {mouseControlMode === 'camera' ? (
                <>
                  <p>🖱️ <strong>Left:</strong> Rotate & Tilt</p>
                  <p>🖱️ <strong>Right:</strong> Pan</p>
                </>
              ) : (
                <>
                  <p>🖱️ <strong>Left:</strong> Pan</p>
                  <p>🖱️ <strong>Right:</strong> Rotate & Tilt</p>
                </>
              )}
            </div>
        </div>

        {/* Surveyor Toggle */}
        <button
            onClick={togglePlotMode}
            className={`w-full flex items-center justify-center gap-2 py-2 text-xs font-bold rounded transition-colors ${isPlotMode ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/50' : 'bg-white/20 hover:bg-white/30 text-yellow-200 border border-yellow-500/30'}`}
        >
            <Ruler size={14} />
            {isPlotMode ? 'Exit Surveyor Mode' : 'Start Surveyor Mode'}
        </button>

        {/* View Mode */}
        <div>
          <label className="text-xs text-gray-300 mb-1 block">View Mode</label>
          <div className="flex bg-black/30 rounded p-1">
            <button
              onClick={() => setActiveView('2D')}
              className={`flex-1 py-1 text-xs rounded transition-colors cursor-pointer ${activeView === '2D' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
            >
              2D Topo
            </button>
            <button
              onClick={() => setActiveView('3D')}
              className={`flex-1 py-1 text-xs rounded transition-colors cursor-pointer ${activeView === '3D' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
            >
              3D Terrain
            </button>
          </div>
        </div>

        {/* Contour Interval */}
        <div>
          <label className="text-xs text-gray-300 mb-1 flex justify-between">
            <span>Contour Interval</span>
            <span>{contourInterval}m</span>
          </label>
          <input
            type="range"
            min="10"
            max="500"
            step="10"
            value={contourInterval}
            onChange={(e) => setContourInterval(Number(e.target.value))}
            className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
        </div>

        {/* Elevation Exaggeration */}
        <div>
          <label className="text-xs text-gray-300 mb-1 flex justify-between">
            <span>Exaggeration (Height)</span>
            <span>{elevationExaggeration.toFixed(1)}x</span>
          </label>
          <input
            type="range"
            min="0"
            max="10" 
            step="0.1"
            value={elevationExaggeration}
            onChange={(e) => setElevationExaggeration(Number(e.target.value))}
            className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <p className="text-[10px] text-gray-400 mt-1">Increase to see contours clearly.</p>
        </div>
        
        {/* Opacity */}
        <div>
           <label className="text-xs text-gray-300 mb-1 flex justify-between">
            <span>Opacity</span>
            <span>{(opacity * 100).toFixed(0)}%</span>
          </label>
           <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={opacity}
            onChange={(e) => setOpacity(Number(e.target.value))}
            className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
        </div>
      </div>
    </div>
  );
};

export const TelemetryOverlay = ({ info }: { info: { lng: number, lat: number, elev: number, slope: number, pitch: number, bearing: number } | null }) => {
  if (!info) return null;
  
  return (
    <div className="absolute bottom-8 right-8 z-10 bg-black/60 backdrop-blur-md border border-white/10 p-3 rounded-lg text-white text-xs font-mono pointer-events-none shadow-lg">
       <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <span className="text-gray-400">Lng:</span>
          <span>{info.lng.toFixed(5)}</span>
          <span className="text-gray-400">Lat:</span>
          <span>{info.lat.toFixed(5)}</span>
          <span className="text-gray-400">Elev:</span>
          <span>{info.elev.toFixed(1)}m</span>
          <span className="text-gray-400">Slope:</span>
          <span>{info.slope.toFixed(1)}°</span>
          <div className="col-span-2 h-px bg-white/10 my-1"></div>
          <span className="text-gray-400">Pitch:</span>
          <span>{info.pitch.toFixed(1)}°</span>
          <span className="text-gray-400">Bearing:</span>
          <span>{info.bearing.toFixed(1)}°</span>
       </div>
    </div>
  );
};
