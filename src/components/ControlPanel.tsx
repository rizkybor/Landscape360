import React, { useState, useRef, useEffect } from 'react';
import { useMapStore } from '../store/useMapStore';
import { useSurveyStore } from '../store/useSurveyStore';
import { Activity, RotateCw, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Eye, Monitor, Ruler, ChevronDown, ChevronUp, Settings, Search } from 'lucide-react';

export const ControlPanel = () => {
  const { 
    contourInterval, setContourInterval,
    elevationExaggeration, setElevationExaggeration,
    opacity, setOpacity,
    activeView, setActiveView,
    pitch, bearing, setPitch, setBearing,
    mouseControlMode, setMouseControlMode,
    showContours, setShowContours,
    showSearch, setShowSearch
  } = useMapStore();

  const { isPlotMode, togglePlotMode } = useSurveyStore();

  const joystickRef = useRef<HTMLDivElement>(null);
  const [isJoystickDragging, setIsJoystickDragging] = useState(false);
  const [isOpen, setIsOpen] = useState(true); // Default open but will be manageable on mobile

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
    <>
      {/* FAB for Mobile/Desktop when closed */}
      {!isOpen && (
        <button 
          onClick={() => setIsOpen(true)}
          className="fixed top-4 left-4 z-30 p-4 bg-blue-600 text-white rounded-full shadow-2xl border-2 border-white/20 active:scale-95 transition-transform hover:bg-blue-500"
          title="Open Controls"
        >
          <Settings size={24} />
        </button>
      )}

      <div className={`
        fixed z-20 transition-all duration-300 ease-in-out
        /* Mobile: Bottom Sheet style */
        bottom-0 left-0 right-0 max-h-[70vh] rounded-t-2xl
        /* Desktop: Floating style */
        md:top-4 md:left-4 md:bottom-auto md:right-auto md:w-64 md:rounded-xl
        bg-black/80 backdrop-blur-xl border-t md:border border-white/20 text-white shadow-2xl flex flex-col
        ${!isOpen ? 'translate-y-full md:translate-y-0 md:opacity-0 md:pointer-events-none' : 'translate-y-0'}
      `}>
        {/* Header / Drag Handle for Mobile */}
        <div 
          className="p-4 flex justify-between items-center border-b border-white/10 cursor-pointer md:cursor-default"
          onClick={() => { if (window.innerWidth < 768) setIsOpen(false) }}
        >
          <h3 className="font-bold flex items-center gap-2">
            <Activity size={18} className="text-blue-400" />
            Terrain Controls
          </h3>
          <button className="md:hidden p-1 hover:bg-white/10 rounded">
            <ChevronDown size={20} />
          </button>
          {/* Desktop Close/Minimize - Optional, but let's keep it visible on desktop */}
          <button 
            onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
            className="hidden md:block p-1 hover:bg-white/10 rounded text-gray-400"
          >
            <ChevronUp size={16} />
          </button>
        </div>
        
        <div className="p-4 space-y-4 overflow-y-auto custom-scrollbar">
          {/* Search Toggle */}
          <button
              onClick={() => setShowSearch(!showSearch)}
              className={`w-full flex items-center justify-center gap-2 py-3 md:py-2 text-xs font-bold rounded transition-colors ${showSearch ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/50' : 'bg-white/20 hover:bg-white/30 text-blue-200 border border-blue-500/30'}`}
          >
              <Search size={14} />
              {showSearch ? 'Hide Search' : 'Show Search'}
          </button>

          {/* Surveyor Toggle */}
          <button
              onClick={togglePlotMode}
              className={`w-full flex items-center justify-center gap-2 py-3 md:py-2 text-xs font-bold rounded transition-colors ${isPlotMode ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/50' : 'bg-white/20 hover:bg-white/30 text-yellow-200 border border-yellow-500/30'}`}
          >
              <Ruler size={14} />
              {isPlotMode ? 'Exit Navigator Mode' : 'Start Navigator Mode'}
          </button>

          {/* On-Screen Virtual Joystick */}
          <div 
            ref={joystickRef}
            className="bg-black/40 p-3 rounded-lg cursor-move select-none active:bg-blue-600/20 transition-colors border border-white/5"
            onMouseDown={() => { setIsJoystickDragging(true); document.body.style.cursor = 'grabbing'; }}
          >
            {/* <p className="text-[10px] text-gray-400 mb-2 text-center uppercase tracking-wider font-bold pointer-events-none">
              🖱️ Drag Here to Rotate/Tilt
            </p> */}
            {/* <div className="h-24 rounded bg-white/5 flex items-center justify-center relative overflow-hidden group">
               <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-20 pointer-events-none">
                  <div className="border-r border-b border-white/20"></div>
                  <div className="border-r border-b border-white/20"></div>
                  <div className="border-b border-white/20"></div>
                  <div className="border-r border-b border-white/20"></div>
                  <div className="border-r border-b border-white/20"></div>
                  <div className="border-b border-white/20"></div>
               </div>
               <RotateCw size={32} className="opacity-50 group-hover:opacity-80 transition-opacity" />
               {isJoystickDragging && <div className="absolute inset-0 bg-blue-500/10 flex items-center justify-center text-xs font-bold text-blue-200">Active</div>}
            </div> */}
            
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
          </div>

          {/* Grid Layout for sliders on Mobile to save space */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 gap-4">
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

            {/* Contour Toggle */}
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-300">Show Contours</label>
              <button
                onClick={() => setShowContours(!showContours)}
                className={`w-10 h-5 rounded-full p-1 transition-colors ${showContours ? 'bg-blue-600' : 'bg-white/10'}`}
              >
                <div className={`w-3 h-3 bg-white rounded-full shadow transition-transform ${showContours ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>

            {/* Contour Interval */}
            <div className={showContours ? 'opacity-100 transition-opacity' : 'opacity-50 pointer-events-none transition-opacity'}>
              <label className="text-xs text-gray-300 mb-1 flex justify-between">
                <span>Contour Interval</span>
                <span>{contourInterval}m</span>
              </label>
              <input
                type="range"
                min="10"
                max="500"
                step="2.5"
                value={contourInterval}
                onChange={(e) => setContourInterval(Number(e.target.value))}
                className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between mt-2 gap-1">
                 {[12.5, 25, 50, 100].map(val => (
                    <button 
                       key={val}
                       onClick={() => setContourInterval(val)}
                       className={`flex-1 text-[10px] py-1 rounded border transition-colors ${
                           contourInterval === val 
                           ? 'bg-blue-600 border-blue-500 text-white font-bold' 
                           : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                       }`}
                    >
                       {val}m
                    </button>
                 ))}
              </div>
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

          <div className="pt-4 mt-2 border-t border-white/10 text-[10px] text-center text-gray-500 font-mono">
             <p>Licensed by</p>
             <p className="font-bold text-gray-400">Makopala Universitas Budi Luhur</p>
             <p>Div. Gunung Hutan | MKP.33-532-KRB</p>
          </div>
        </div>
      </div>
    </>
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
