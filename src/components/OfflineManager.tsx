import { useState, useEffect } from 'react';
import { useMapStore } from '../store/useMapStore';
import { useOfflineStore } from '../store/useOfflineStore';
import type { OfflineRegion } from '../store/useOfflineStore';
import { getTilesInBounds, getMapboxTileUrl, getTerrainTileUrl } from '../utils/tileUtils';
import type { Bounds } from '../utils/tileUtils';
import { Download, Trash2, Map as MapIcon, Loader2, WifiOff, PenTool, X } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useSurveyStore } from '../store/useSurveyStore';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

export const OfflineManager = ({ onClose }: { onClose: () => void }) => {
  const { 
    zoom, 
    interactionMode, 
    setInteractionMode, 
    regionPoints, 
    clearRegionPoints,
    triggerFlyTo
  } = useMapStore();
  const { regions, addRegion, removeRegion, updateRegionProgress } = useOfflineStore();
  const { user } = useSurveyStore();
  
  const [downloadName, setDownloadName] = useState('');
  const [isCalculating, setIsCalculating] = useState(false);

  // Clean up interaction mode when closing
  useEffect(() => {
    return () => {
      setInteractionMode('default');
      clearRegionPoints();
    };
  }, [setInteractionMode, clearRegionPoints]);

  const loadRegion = (region: OfflineRegion) => {
    if (region.bounds) {
      const centerLng = (region.bounds.west + region.bounds.east) / 2;
      const centerLat = (region.bounds.south + region.bounds.north) / 2;
      
      triggerFlyTo({
        center: [centerLng, centerLat],
        zoom: Math.max(region.minZoom, 14),
        duration: 2000
      });
      onClose(); // Close manager to show map
    }
  };

  const calculateBoundsFromPoints = (points: [number, number][]): Bounds | null => {
    if (points.length === 0) return null;
    let minLng = points[0][0];
    let maxLng = points[0][0];
    let minLat = points[0][1];
    let maxLat = points[0][1];

    points.forEach(p => {
        minLng = Math.min(minLng, p[0]);
        maxLng = Math.max(maxLng, p[0]);
        minLat = Math.min(minLat, p[1]);
        maxLat = Math.max(maxLat, p[1]);
    });

    return {
        west: minLng,
        east: maxLng,
        south: minLat,
        north: maxLat
    };
  };

  const calculateSize = () => {
    const bounds = calculateBoundsFromPoints(regionPoints);
    if (!bounds || regionPoints.length < 4) return { count: 0, size: 0, minZoom: 0, maxZoom: 0 };
    
    // Download current zoom level + 2 levels deeper for better detail
    const minZoom = Math.floor(zoom);
    const maxZoom = Math.min(minZoom + 2, 16); // Cap at 16 to prevent massive downloads
    
    const tiles = getTilesInBounds(bounds, minZoom, maxZoom);
    // Estimate 25KB per tile (webp + dem)
    const size = (tiles.length * 2 * 0.025).toFixed(2); 
    
    return { count: tiles.length, size, minZoom, maxZoom, bounds };
  };

  const handleDownload = async () => {
    const { count, size, minZoom, maxZoom, bounds } = calculateSize();
    if (!bounds || !downloadName || !minZoom || !maxZoom) return;

    setIsCalculating(true);

    const regionId = crypto.randomUUID();
    
    const newRegion: OfflineRegion = {
      id: regionId,
      name: downloadName,
      bounds,
      minZoom,
      maxZoom,
      tileCount: count,
      sizeEstMB: Number(size),
      createdAt: new Date().toISOString(),
      status: 'downloading',
      progress: 0
    };
    
    addRegion(newRegion);
    
    // Save to Supabase
    if (user) {
        supabase.from('offline_maps').insert({
            id: regionId,
            user_id: user.id,
            name: downloadName,
            bounds: bounds,
            min_zoom: minZoom,
            max_zoom: maxZoom,
            tile_count: count,
            size_est_mb: Number(size)
        }).then(({ error }) => {
            if (error) {
                console.error("Failed to save offline map to Supabase:", error);
            }
        });
    }

    // Reset drawing state
    setInteractionMode('default');
    clearRegionPoints();
    setDownloadName('');
    
    // Start background download
    const tiles = getTilesInBounds(bounds, minZoom, maxZoom);
    let completed = 0;
    
    // We fetch tiles in batches to not overwhelm the browser
    const BATCH_SIZE = 10;
    
    // Create list of URLs to fetch
    const urls: string[] = [];
    tiles.forEach(t => {
      urls.push(getMapboxTileUrl(t.x, t.y, t.z, MAPBOX_TOKEN));
      urls.push(getTerrainTileUrl(t.x, t.y, t.z, MAPBOX_TOKEN));
    });

    try {
        for (let i = 0; i < urls.length; i += BATCH_SIZE) {
            const batch = urls.slice(i, i + BATCH_SIZE);
            await Promise.all(batch.map(url => fetch(url, { mode: 'cors' })));
            
            completed += batch.length;
            const progress = Math.min(100, Math.round((completed / urls.length) * 100));
            updateRegionProgress(regionId, progress);
        }
        updateRegionProgress(regionId, 100, 'completed');
    } catch (e) {
        console.error("Download failed", e);
        updateRegionProgress(regionId, 0, 'error');
    } finally {
        setIsCalculating(false);
    }
  };

  // If in drawing mode, render a minimal UI overlay instead of the full modal
  if (interactionMode === 'draw_region') {
    const stats = calculateSize();
    return (
        <div className="fixed inset-0 z-[100] pointer-events-none flex flex-col justify-end items-center pb-8 px-4">
             {/* Instructions Overlay */}
             <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md border border-white/10 rounded-full px-6 py-2 text-white text-xs font-bold shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 pointer-events-auto">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                DRAWING MODE ACTIVE
                <div className="h-4 w-px bg-white/20"></div>
                <span className={regionPoints.length >= 4 ? "text-green-400" : "text-blue-300"}>
                    {regionPoints.length} / 4 Points
                </span>
             </div>

             {/* Bottom Controls Panel */}
             <div className="w-full max-w-md bg-[#0a0a0a]/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden pointer-events-auto animate-in slide-in-from-bottom-10 fade-in duration-300">
                <div className="p-4 space-y-4">
                     <div className="flex justify-between items-center">
                        <h3 className="text-sm font-bold text-white">Define Area</h3>
                        <button 
                            onClick={() => {
                                setInteractionMode('default');
                                clearRegionPoints();
                            }}
                            className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                        >
                            <X size={16} />
                        </button>
                     </div>

                     {regionPoints.length < 4 ? (
                        <div className="text-xs text-gray-400 bg-white/5 p-3 rounded-lg border border-white/5 flex gap-2 items-center">
                            <MapIcon size={14} className="text-blue-400" />
                            <span>Click on map to place point {regionPoints.length + 1} of 4.</span>
                        </div>
                     ) : (
                        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
                            <input 
                                type="text" 
                                placeholder="Region Name (e.g. Site A)" 
                                className="w-full bg-black/40 border border-white/10 rounded-lg py-2 px-3 text-sm text-white focus:border-blue-500/50 outline-none"
                                value={downloadName}
                                onChange={e => setDownloadName(e.target.value)}
                            />
                            
                            <div className="flex justify-between text-[10px] text-gray-400 px-1">
                                <span>Size: <strong className="text-white">{stats.size} MB</strong></span>
                                <span>Tiles: <strong className="text-white">{stats.count}</strong></span>
                            </div>

                            <button
                                disabled={!downloadName || stats.count > 5000}
                                onClick={handleDownload}
                                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-500 text-white text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2"
                            >
                                {isCalculating ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                                Download Region
                            </button>
                        </div>
                     )}
                </div>
             </div>
        </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 pointer-events-auto">
      <div 
        className="relative w-full max-w-lg bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow Decor */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent"></div>
        
        {/* Background Effects */}
        <div className="absolute top-0 right-0 -mt-16 -mr-16 w-64 h-64 bg-blue-600/10 blur-[100px] rounded-full pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 -mb-16 -ml-16 w-64 h-64 bg-purple-600/10 blur-[100px] rounded-full pointer-events-none"></div>

        {/* Header */}
        <div className="p-6 border-b border-white/5 bg-white/[0.02] relative z-10 flex justify-between items-center">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                    <WifiOff size={20} />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-white tracking-tight">Offline Maps</h2>
                    <p className="text-xs text-blue-400 font-mono tracking-widest">REGION MANAGER</p>
                </div>
            </div>
            <button 
                onClick={onClose} 
                className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"
            >
                <X size={20} />
            </button>
        </div>
        
        <div className="p-6 relative z-10 space-y-8 overflow-y-auto custom-scrollbar flex-1">
            {/* Create New Map Section */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <span className="w-1 h-4 bg-blue-500 rounded-full"></span>
                        Create New Survey Region
                    </h3>
                    <div className="text-[10px] text-gray-500 font-mono">
                        SELECT REGION
                    </div>
                </div>

                <div className={`bg-white/[0.03] border border-white/10 rounded-xl p-4 space-y-4 transition-all`}>
                    <div className="text-center py-6">
                        <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-3 text-gray-400">
                            <MapIcon size={24} />
                        </div>
                        <p className="text-sm text-gray-300 font-medium mb-1">Define Survey Area</p>
                        <p className="text-xs text-gray-500 mb-4 px-8">
                            To download a map for offline use, you need to define the survey area by clicking 4 points on the map.
                        </p>
                        <button
                            onClick={() => {
                                setInteractionMode('draw_region');
                                clearRegionPoints();
                            }}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 mx-auto shadow-lg shadow-blue-900/20"
                        >
                            <PenTool size={14} />
                            Start Drawing Region
                        </button>
                    </div>
                </div>
            </div>
            
            {/* Saved Regions List - Only show when not drawing to save space/focus */}
            {interactionMode === 'default' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            <span className="w-1 h-4 bg-purple-500 rounded-full"></span>
                            Downloaded Maps
                        </h3>
                        <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full text-gray-300">{regions.length}</span>
                    </div>

                    <div className="space-y-3">
                        {regions.length === 0 ? (
                            <div className="text-center py-8 border-2 border-dashed border-white/5 rounded-xl">
                                <WifiOff size={24} className="mx-auto text-gray-600 mb-2 opacity-50" />
                                <p className="text-xs text-gray-500">No offline maps downloaded yet.</p>
                            </div>
                        ) : (
                            regions.map(region => (
                                <div 
                                    key={region.id} 
                                    className="group bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 rounded-xl p-3 transition-colors cursor-pointer"
                                    onClick={() => loadRegion(region)}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <div className="text-sm font-bold text-gray-200 flex items-center gap-2 group-hover:text-blue-400 transition-colors">
                                                {region.name}
                                                {region.status === 'completed' && <span className="text-[8px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded uppercase tracking-wider">Ready</span>}
                                            </div>
                                            <div className="text-[10px] text-gray-500 flex items-center gap-2 mt-0.5">
                                                <span>{region.sizeEstMB} MB</span>
                                                <span className="w-1 h-1 bg-gray-600 rounded-full"></span>
                                                <span>{new Date(region.createdAt).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                        
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                removeRegion(region.id);
                                            }}
                                            className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                            title="Delete Map"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                    
                                    {region.status === 'downloading' ? (
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-[9px] text-blue-300">
                                                <span>Downloading...</span>
                                                <span>{region.progress}%</span>
                                            </div>
                                            <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
                                                <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${region.progress}%` }}></div>
                                            </div>
                                        </div>
                                    ) : region.status === 'error' && (
                                        <div className="text-[10px] text-red-400 bg-red-500/10 px-2 py-1 rounded">
                                            Download Failed
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
        
        {/* Footer */}
        <div className="p-4 bg-black/40 border-t border-white/5 text-center text-[10px] text-gray-600 font-mono">
            Storage Used: {regions.reduce((acc, r) => acc + r.sizeEstMB, 0).toFixed(2)} MB
        </div>
      </div>
    </div>
  );
};
