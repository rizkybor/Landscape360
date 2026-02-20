import { useState, useEffect } from 'react';
import { useMapStore } from '../store/useMapStore';
import { useOfflineStore } from '../store/useOfflineStore';
import type { OfflineRegion } from '../store/useOfflineStore';
import { getTilesInBounds, getMapboxTileUrl, getTerrainTileUrl } from '../utils/tileUtils';
import { ChevronLeft, Trash2, Map as MapIcon, WifiOff, PenTool, X } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useSurveyStore } from '../store/useSurveyStore';
import { createPortal } from 'react-dom';

import { getTile, deleteTilesBulk } from '../utils/offline-db';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

const TileAvailabilityBadge = ({ region }: { region: OfflineRegion }) => {
    const [status, setStatus] = useState<'ready' | 'partial' | 'missing'>('missing');
    const [details, setDetails] = useState<string>('');

    useEffect(() => {
        const checkTiles = async () => {
            // Check one tile from the center of the region at minZoom
            const centerLng = (region.bounds.west + region.bounds.east) / 2;
            const centerLat = (region.bounds.south + region.bounds.north) / 2;
            
            // Simple lat/lng to tile conversion
            const x = Math.floor((centerLng + 180) / 360 * Math.pow(2, region.minZoom));
            const y = Math.floor((1 - Math.log(Math.tan(centerLat * Math.PI / 180) + 1 / Math.cos(centerLat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, region.minZoom));

            const satelliteUrl = getMapboxTileUrl(x, y, region.minZoom, MAPBOX_TOKEN);
            const terrainUrl = getTerrainTileUrl(x, y, Math.min(region.minZoom, 15), MAPBOX_TOKEN);

            const satelliteBlob = await getTile(satelliteUrl);
            const terrainBlob = await getTile(terrainUrl);

            if (satelliteBlob && terrainBlob) {
                setStatus('ready');
                setDetails('2D + 3D + Contours Ready');
            } else if (satelliteBlob) {
                setStatus('partial');
                setDetails('2D Only (No 3D/Contours)');
            } else {
                setStatus('missing');
                setDetails('Cloud Sync Only');
            }
        };

        if (region.status === 'completed') {
            checkTiles();
        }
    }, [region]);

    if (region.status !== 'completed') return null;

    if (status === 'ready') {
        return <span className="text-[8px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded uppercase tracking-wider" title={details}>Ready (3D)</span>;
    }

    if (status === 'partial') {
        return <span className="text-[8px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded uppercase tracking-wider flex items-center gap-1" title={details}>
             2D Only
        </span>;
    }

    return (
        <span className="text-[8px] bg-gray-500/20 text-gray-400 px-1.5 py-0.5 rounded uppercase tracking-wider flex items-center gap-1" title={details}>
            <WifiOff size={8} /> Cloud Sync
        </span>
    );
};

export const OfflineManager = ({ onClose, onBack }: { onClose: () => void, onBack?: () => void }) => {
  const { 
    setInteractionMode, 
    clearRegionPoints,
    triggerFlyTo
  } = useMapStore();
  const { regions, removeRegion, setRegions } = useOfflineStore();
  const { user, subscriptionStatus: storeSubscriptionStatus } = useSurveyStore();
  
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>('Free');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Calculate Limits & Usage
  const { userRegions, storageInfo } = (() => {
    const uRegions = regions.filter(r => !user || r.userId === user.id);
    
    // Limits
    const normalizedStatus = subscriptionStatus === 'PRO' ? 'Pro' : subscriptionStatus;
    const countLimits: Record<string, number> = { 'Free': 1, 'Pro': 3, 'Enterprise': 10 };
    const maxCount = countLimits[normalizedStatus] || 1;
    
    // Size limit per download (not total)
    const sizeLimits: Record<string, number> = { 'Free': 1, 'Pro': 10, 'Enterprise': 25 };
    const maxSize = sizeLimits[normalizedStatus] || 1;

    const totalSize = uRegions.reduce((acc, r) => acc + r.sizeEstMB, 0);
    
    return {
        userRegions: uRegions,
        storageInfo: {
            totalSize: totalSize.toFixed(2),
            count: uRegions.length,
            maxCount,
            maxSize,
            isCountWarning: uRegions.length >= maxCount
        }
    };
  })();

  // Sync with Supabase on mount/user change
  useEffect(() => {
    const syncWithSupabase = async () => {
        if (!user) return;

        const { data, error } = await supabase
            .from('offline_maps')
            .select('*')
            .eq('user_id', user.id);

        if (error) {
            console.error("Error fetching offline maps from Supabase:", error);
            return;
        }

        if (data) {
            const remoteRegions: OfflineRegion[] = data.map(item => ({
                id: item.id,
                userId: item.user_id,
                name: item.name,
                bounds: item.bounds,
                minZoom: item.min_zoom,
                maxZoom: item.max_zoom,
                tileCount: item.tile_count,
                sizeEstMB: item.size_est_mb,
                createdAt: item.created_at,
                status: 'completed',
                progress: 100
            }));
            
            const remoteMap = new Map(remoteRegions.map(r => [r.id, r]));
            
            const validLocalRegions = regions.filter(r => {
                if (r.userId && r.userId !== user.id) return false; 
                if (r.userId === user.id) {
                    return remoteMap.has(r.id);
                }
                return true;
            });

            const mergedMap = new Map(validLocalRegions.map(r => [r.id, r]));
            let hasChanges = validLocalRegions.length !== regions.length;

            remoteRegions.forEach(remote => {
                if (!mergedMap.has(remote.id)) {
                    mergedMap.set(remote.id, remote);
                    hasChanges = true;
                }
            });

            if (hasChanges || regions.length !== mergedMap.size) {
                setRegions(Array.from(mergedMap.values()));
            }
        }
    };

    syncWithSupabase();
  }, [user]); 

  useEffect(() => {
    if (storeSubscriptionStatus) {
        setSubscriptionStatus(storeSubscriptionStatus);
    } else if (user) {
      supabase.from('profiles').select('status_subscribe').eq('id', user.id).single()
        .then(({ data }) => {
          if (data) {
            setSubscriptionStatus(data.status_subscribe || 'Free');
          }
        });
    }
  }, [user, storeSubscriptionStatus]);

  // Clean up interaction mode when closing
  useEffect(() => {
    return () => {
        // If we close manager, we usually go back to default mode unless we started drawing
        // But here we rely on the button action to set mode
    };
  }, []);

  const loadRegion = (region: OfflineRegion) => {
    if (region.bounds) {
      const centerLng = (region.bounds.west + region.bounds.east) / 2;
      const centerLat = (region.bounds.south + region.bounds.north) / 2;
      
      useMapStore.getState().setMapStyle("mapbox://styles/mapbox/satellite-streets-v12");
      useMapStore.getState().setActiveView("3D"); 

      triggerFlyTo({
        center: [centerLng, centerLat],
        zoom: Math.max(region.minZoom, 14),
        duration: 2000
      });
      onClose(); 
    }
  };

  const handleRemoveRegion = async (id: string) => {
    const region = regions.find(r => r.id === id);
    
    removeRegion(id);

    if (user) {
        const { error } = await supabase
            .from('offline_maps')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id);
            
        if (error) {
            console.error("Error deleting offline map from Supabase:", error);
        }
    }

    if (region && region.status === 'completed') {
        const tiles = getTilesInBounds(region.bounds, region.minZoom, region.maxZoom);
        
        const BATCH_SIZE = 50;
        const urls: string[] = [];
        tiles.forEach(t => {
            urls.push(getMapboxTileUrl(t.x, t.y, t.z, MAPBOX_TOKEN));
            if (t.z <= 15) {
                urls.push(getTerrainTileUrl(t.x, t.y, t.z, MAPBOX_TOKEN));
            }
        });

        const cleanup = async () => {
            for (let i = 0; i < urls.length; i += BATCH_SIZE) {
                const batch = urls.slice(i, i + BATCH_SIZE);
                await deleteTilesBulk(batch);
            }
        };
        cleanup();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center md:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 pointer-events-auto">
      <div 
        className="relative w-full h-full md:h-auto md:max-w-lg bg-[#0a0a0a] border-0 md:border md:border-white/10 rounded-none md:rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col md:max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent"></div>
        
        <div className="absolute top-0 right-0 -mt-16 -mr-16 w-64 h-64 bg-blue-600/10 blur-[100px] rounded-full pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 -mb-16 -ml-16 w-64 h-64 bg-purple-600/10 blur-[100px] rounded-full pointer-events-none"></div>

        <div className="p-6 border-b border-white/5 bg-white/[0.02] relative z-10 flex justify-between items-center">
            <div className="flex items-center gap-3">
                {onBack && (
                    <button 
                        onClick={onBack}
                        className="p-1.5 -ml-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                        title="Back to User Account"
                    >
                        <ChevronLeft size={24} />
                    </button>
                )}
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
                className="cursor-pointer p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"
            >
                <X size={20} />
            </button>
        </div>
        
        <div className="p-6 relative z-10 space-y-8 overflow-y-auto custom-scrollbar flex-1">
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
                                onClose(); // Close manager to show map and drawing overlay
                            }}
                            className="cursor-pointer px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 mx-auto shadow-lg shadow-blue-900/20"
                        >
                            <PenTool size={14} />
                            Start Drawing Region
                        </button>
                    </div>
                </div>
            </div>
            
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <span className="w-1 h-4 bg-purple-500 rounded-full"></span>
                        Downloaded Maps
                    </h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${storageInfo.isCountWarning ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-white/10 text-gray-300'}`}>
                        {storageInfo.count} / {storageInfo.maxCount} Maps
                    </span>
                </div>

                {storageInfo.isCountWarning && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-start gap-2 animate-in fade-in slide-in-from-top-2">
                        <div className="text-red-400 mt-0.5"><WifiOff size={14} /></div>
                        <div>
                            <p className="text-[10px] font-bold text-red-400">Map Limit Reached</p>
                            <p className="text-[10px] text-gray-400 leading-relaxed">
                                You have reached the maximum number of offline maps for the <strong>{subscriptionStatus} Plan</strong>. 
                                Delete existing maps or upgrade to add more.
                            </p>
                        </div>
                    </div>
                )}

                <div className="space-y-3">
                    {userRegions.length === 0 ? (
                        <div className="text-center py-8 border-2 border-dashed border-white/5 rounded-xl">
                            <WifiOff size={24} className="mx-auto text-gray-600 mb-2 opacity-50" />
                            <p className="text-xs text-gray-500">No offline maps downloaded yet.</p>
                        </div>
                    ) : (
                        userRegions.map(region => (
                            <div 
                                key={region.id} 
                                className="group bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 rounded-xl p-3 transition-colors cursor-pointer"
                                onClick={() => loadRegion(region)}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <div className="text-sm font-bold text-gray-200 flex items-center gap-2 group-hover:text-blue-400 transition-colors">
                                            {region.name}
                                            <TileAvailabilityBadge region={region} />
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
                                            setDeleteConfirmId(region.id);
                                        }}
                                        className="cursor-pointer p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100"
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
        </div>
        
        <div className="p-4 bg-black/40 border-t border-white/5 flex justify-between items-center text-[10px] text-gray-600 font-mono">
            <span>{storageInfo.count} / {storageInfo.maxCount} Maps Used</span>
            <span>Total Storage: {storageInfo.totalSize} MB</span>
        </div>
      </div>

      {deleteConfirmId && createPortal(
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm md:backdrop-blur-md animate-in fade-in duration-300">
            <div 
                className="relative w-full max-w-xs bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-[0_0_50px_rgba(239,68,68,0.15)] overflow-hidden p-6 animate-in zoom-in-95 duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-red-500/50 to-transparent"></div>
                
                <div className="flex flex-col items-center text-center gap-5">
                    <div className="relative">
                        <div className="absolute inset-0 bg-red-500/20 blur-xl rounded-full"></div>
                        <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500/20 to-red-600/10 border border-red-500/30 flex items-center justify-center text-red-500 shadow-inner">
                            <Trash2 size={28} strokeWidth={1.5} />
                        </div>
                    </div>
                    
                    <div className="space-y-2">
                        <h3 className="text-xl font-bold text-white tracking-tight">Delete Offline Map?</h3>
                        <p className="text-xs text-gray-400 leading-relaxed px-2">
                            This action cannot be undone. The map will be
                            permanently deleted from your device and cloud.
                        </p>
                    </div>

                    <div className="flex flex-col gap-2 w-full mt-2">
                        <button
                            onClick={() => {
                                if (deleteConfirmId) {
                                    handleRemoveRegion(deleteConfirmId);
                                    setDeleteConfirmId(null);
                                }
                            }}
                            className="cursor-pointer w-full py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-red-600/30 transition-all active:scale-[0.98] border border-red-400/20"
                        >
                            Delete Permanently
                        </button>
                        <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="cursor-pointer w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-gray-400 hover:text-white transition-all active:scale-[0.98]"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
      )}
    </div>
  );
};
