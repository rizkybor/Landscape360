import { useState, useEffect } from 'react';
import { useMapStore } from '../store/useMapStore';
import { useOfflineStore } from '../store/useOfflineStore';
import type { OfflineRegion } from '../store/useOfflineStore';
import { getTilesInBounds, getMapboxTileUrl, getTerrainTileUrl } from '../utils/tileUtils';
import type { Bounds } from '../utils/tileUtils';
import { Download, Trash2, Map as MapIcon, Loader2, WifiOff, PenTool, X } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useSurveyStore } from '../store/useSurveyStore';
import { createPortal } from 'react-dom';

import { saveTile, getTile, deleteTile } from '../utils/offline-db';

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

export const OfflineManager = ({ onClose }: { onClose: () => void }) => {
  const { 
    zoom, 
    interactionMode, 
    setInteractionMode, 
    regionPoints, 
    clearRegionPoints,
    triggerFlyTo
  } = useMapStore();
  const { regions, addRegion, removeRegion, updateRegionProgress, setRegions } = useOfflineStore();
  const { user, subscriptionStatus: storeSubscriptionStatus } = useSurveyStore();
  
  const [downloadName, setDownloadName] = useState('');
  const [isCalculating, setIsCalculating] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>('Free');
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<'size' | 'count'>('size');
  const [selectedUpgradePlan, setSelectedUpgradePlan] = useState<'Pro' | 'Enterprise'>('Pro');

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

            // Merge: keep local version if it exists (it has current device status)
            // Filter out regions that don't belong to current user if they were left over
            // We need to fetch ALL regions from supabase, and only keep local regions that are also in supabase OR are purely local (not yet synced? rare case if we sync on create)
            // Actually, we should trust Supabase as the source of truth for the list.
            
            // Create a map of remote regions
            const remoteMap = new Map(remoteRegions.map(r => [r.id, r]));
            
            // Start with local regions, but filter out ones that should be there (based on user) but are not in remote (deleted elsewhere)
            // If a region has userId matching current user, but is NOT in remoteRegions, it means it was deleted on another device.
            // So we should remove it from local state.
            const validLocalRegions = regions.filter(r => {
                // If it belongs to another user (or no user?), keep it or filter it? 
                // Let's assume we only care about current user's regions.
                if (r.userId && r.userId !== user.id) return false; // Wrong user
                
                // If it belongs to current user
                if (r.userId === user.id) {
                    // It MUST exist in remoteMap, otherwise it was deleted elsewhere
                    return remoteMap.has(r.id);
                }
                
                // If no userId (legacy), maybe keep it or try to claim it? Let's keep it for now.
                return true;
            });

            const mergedMap = new Map(validLocalRegions.map(r => [r.id, r]));
            let hasChanges = validLocalRegions.length !== regions.length; // If we filtered out deleted ones

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
  }, [user]); // Only run when user changes (login/logout)

  useEffect(() => {
    // Prefer store status if available, fallback to local fetch or 'Free'
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

  const handleRemoveRegion = async (id: string) => {
    // 0. Find region first to get bounds for tile cleanup
    const region = regions.find(r => r.id === id);
    
    // 1. Remove from local store
    removeRegion(id);

    // 2. Remove from Supabase if logged in
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

    // 3. Clean up tiles from IndexedDB (Background)
    if (region && region.status === 'completed') {
        const tiles = getTilesInBounds(region.bounds, region.minZoom, region.maxZoom);
        
        // We do this in batches to not block the main thread
        const BATCH_SIZE = 50;
        const urls: string[] = [];
        tiles.forEach(t => {
            urls.push(getMapboxTileUrl(t.x, t.y, t.z, MAPBOX_TOKEN));
            if (t.z <= 15) {
                urls.push(getTerrainTileUrl(t.x, t.y, t.z, MAPBOX_TOKEN));
            }
        });

        // Note: We don't await the whole thing to keep UI snappy, 
        // but we start the process.
        const cleanup = async () => {
            for (let i = 0; i < urls.length; i += BATCH_SIZE) {
                const batch = urls.slice(i, i + BATCH_SIZE);
                await Promise.all(batch.map(url => deleteTile(url)));
            }
        };
        cleanup();
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

  const fetchWithRetry = async (url: string, retries = 3, backoff = 1000): Promise<Response> => {
    try {
        const response = await fetch(url, { mode: 'cors' });
        
        // Handle Rate Limiting (429)
        if (response.status === 429 && retries > 0) {
            console.warn(`Rate limit hit for ${url}. Retrying in ${backoff}ms...`);
            await new Promise(resolve => setTimeout(resolve, backoff));
            return fetchWithRetry(url, retries - 1, backoff * 2);
        }

        // Handle Server Errors (5xx)
        if (response.status >= 500 && retries > 0) {
            await new Promise(resolve => setTimeout(resolve, backoff));
            return fetchWithRetry(url, retries - 1, backoff * 2);
        }

        return response;
    } catch (err) {
        if (retries > 0) {
            console.warn(`Network error for ${url}. Retrying...`, err);
            await new Promise(resolve => setTimeout(resolve, backoff));
            return fetchWithRetry(url, retries - 1, backoff * 2);
        }
        throw err;
    }
  };

  const handleDownload = async () => {
    if (!MAPBOX_TOKEN) {
        console.error("Mapbox token is missing!");
        alert("Configuration Error: Mapbox token is missing. Please check your environment variables.");
        return;
    }

    const { count, size, minZoom, maxZoom, bounds } = calculateSize();
    if (!bounds || !downloadName || !minZoom || !maxZoom) return;

    // 1. Check Offline Map Count Limit
    const countLimits: Record<string, number> = { 'Free': 1, 'Pro': 3, 'Enterprise': 10 };
    const countLimit = countLimits[subscriptionStatus] || 1;
    
    if (regions.length >= countLimit) {
        setUpgradeReason('count');
        setShowUpgradePrompt(true);
        return;
    }

    // 2. Check Size Limit
    const sizeLimit = subscriptionStatus === 'Enterprise' ? 25 : (subscriptionStatus === 'Pro' ? 10 : 1);
    if (Number(size) > sizeLimit) {
        setUpgradeReason('size');
        setShowUpgradePrompt(true);
        return;
    }

    setIsCalculating(true);

    const regionId = crypto.randomUUID();
    
    const newRegion: OfflineRegion = {
      id: regionId,
      userId: user?.id,
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
    let failed = 0;
    
    // We fetch tiles in batches to not overwhelm the browser
    const BATCH_SIZE = 10;
    
    // Create list of URLs to fetch
    const urls: string[] = [];
    tiles.forEach(t => {
      // 1. Satellite Tile (Raster) - Always download for requested zoom
      urls.push(getMapboxTileUrl(t.x, t.y, t.z, MAPBOX_TOKEN));
      
      // 2. Terrain Tile (DEM) - Only up to zoom 15 (Mapbox limit)
      // This ensures 3D and Contours work, but saves space/requests for z16+
      if (t.z <= 15) {
          urls.push(getTerrainTileUrl(t.x, t.y, t.z, MAPBOX_TOKEN));
      }
    });

    try {
        for (let i = 0; i < urls.length; i += BATCH_SIZE) {
            const batch = urls.slice(i, i + BATCH_SIZE);
            await Promise.all(batch.map(async (url) => {
                try {
                    const response = await fetchWithRetry(url);
                    if (response.ok) {
                        const blob = await response.blob();
                        await saveTile(url, blob);
                    } else {
                        console.error(`Failed to download tile: ${response.status} ${response.statusText}`);
                        failed++;
                    }
                } catch (err) {
                    console.error('Failed to download/save tile:', url, err);
                    failed++;
                }
            }));
            
            completed += batch.length;
            const progress = Math.min(100, Math.round((completed / urls.length) * 100));
            updateRegionProgress(regionId, progress);

            // Small delay between batches to respect rate limits
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Check if too many failures occurred
        if (failed > urls.length * 0.1) { // If > 10% failed
             console.warn(`Download finished with ${failed} failures out of ${urls.length} tiles.`);
             updateRegionProgress(regionId, 100, 'completed');
        } else {
             updateRegionProgress(regionId, 100, 'completed');
        }
    } catch (e) {
        console.error("Download failed", e);
        updateRegionProgress(regionId, 0, 'error');
    } finally {
        setIsCalculating(false);
    }
  };

  // Define Upgrade Modal Portal
  const upgradeModal = showUpgradePrompt && createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
        <div 
            className="relative w-full max-w-sm bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-[0_0_50px_rgba(234,179,8,0.15)] overflow-hidden p-6"
            onClick={(e) => e.stopPropagation()}
        >
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-yellow-500/50 to-transparent"></div>
            
            <div className="flex flex-col items-center text-center gap-4">
                <div className="w-16 h-16 rounded-full bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-yellow-500">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v8"/><path d="m4.93 10.93 1.41 1.41"/><path d="M2 18h2"/><path d="M20 18h2"/><path d="m19.07 10.93-1.41 1.41"/><path d="M22 22H2"/><path d="m8 22 4-10 4 10"/><path d="M11 22v-4"/><path d="M13 22v-4"/></svg>
                </div>
                
                <div>
                    <h3 className="text-lg font-bold text-white mb-2">
                        {upgradeReason === 'size' ? 'Download Limit Exceeded' : 'Map Limit Exceeded'}
                    </h3>
                    <p className="text-sm text-gray-400 mb-6">
                        {upgradeReason === 'size' ? (
                            <>
                                Your current <strong>{subscriptionStatus} Plan</strong> is limited to <strong>{subscriptionStatus === 'Enterprise' ? '25' : (subscriptionStatus === 'Pro' ? '10' : '1')}MB</strong> per download.
                            </>
                        ) : (
                            <>
                                Your current <strong>{subscriptionStatus} Plan</strong> is limited to <strong>{subscriptionStatus === 'Enterprise' ? '10' : (subscriptionStatus === 'Pro' ? '3' : '1')}</strong> offline maps.
                            </>
                        )}
                    </p>
                    
                    <div className="grid grid-cols-2 gap-3 mb-6">
                         {/* Pro Plan Card */}
                         <button
                            onClick={() => setSelectedUpgradePlan('Pro')}
                            className={`cursor-pointer relative p-3 rounded-xl border transition-all ${selectedUpgradePlan === 'Pro' ? 'bg-blue-600/20 border-blue-500 ring-1 ring-blue-500' : 'bg-white/5 border-white/10 hover:border-white/20'}`}
                         >
                             {selectedUpgradePlan === 'Pro' && <div className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>}
                             <div className="text-left">
                                 <div className="text-xs font-bold text-blue-400 mb-1">PRO PLAN</div>
                                 <div className="text-lg font-bold text-white mb-1">$3.5<span className="text-[10px] text-gray-400 font-normal">/mo</span></div>
                                 <div className="text-[10px] text-gray-400">Up to 10 MB / download</div>
                             </div>
                         </button>

                         {/* Enterprise Plan Card */}
                         <button
                            onClick={() => setSelectedUpgradePlan('Enterprise')}
                            className={`cursor-pointer relative p-3 rounded-xl border transition-all ${selectedUpgradePlan === 'Enterprise' ? 'bg-purple-600/20 border-purple-500 ring-1 ring-purple-500' : 'bg-white/5 border-white/10 hover:border-white/20'}`}
                         >
                             {selectedUpgradePlan === 'Enterprise' && <div className="absolute top-2 right-2 w-2 h-2 bg-purple-500 rounded-full shadow-[0_0_10px_rgba(168,85,247,0.5)]"></div>}
                             <div className="text-left">
                                 <div className="text-xs font-bold text-purple-400 mb-1">ENTERPRISE</div>
                                 <div className="text-lg font-bold text-white mb-1">$7<span className="text-[10px] text-gray-400 font-normal">/mo</span></div>
                                 <div className="text-[10px] text-gray-400">Up to 25 MB / download</div>
                             </div>
                         </button>
                    </div>

                    <div className="text-xs text-gray-500">
                        Upgrade to <strong>{selectedUpgradePlan} Plan</strong> via email request:
                    </div>
                </div>

                <div className="flex flex-col gap-2 w-full mt-2">
                    <a
                        href={`mailto:contact@jcdigital.co.id?subject=Request Upgrade to ${selectedUpgradePlan} Plan&body=Hi Admin,%0D%0A%0D%0AI would like to request an upgrade for my account to the ${selectedUpgradePlan} Plan (${selectedUpgradePlan === 'Pro' ? '$3.5/mo' : '$7/mo'}).%0D%0A%0D%0AMy Account Email: ${user?.email}%0D%0A%0D%0AThank you.`}
                        className={`cursor-pointer w-full py-3 text-white rounded-xl text-sm font-bold shadow-lg transition-all flex items-center justify-center gap-2 ${selectedUpgradePlan === 'Enterprise' ? 'bg-purple-600 hover:bg-purple-500 shadow-purple-600/20' : 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/20'}`}
                    >
                        Request {selectedUpgradePlan} Upgrade
                    </a>
                    <button
                        onClick={() => setShowUpgradePrompt(false)}
                        className="cursor-pointer w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-bold text-gray-300 transition-all"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    </div>,
    document.body
  );

  const userRegions = regions.filter(r => !user || r.userId === user.id);

  // If in drawing mode, render a minimal UI overlay instead of the full modal
  if (interactionMode === 'draw_region') {
    const stats = calculateSize();
    const limit = subscriptionStatus === 'Enterprise' ? 25 : (subscriptionStatus === 'Pro' ? 10 : 1);
    const isOverLimit = Number(stats.size) > limit;

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
                            className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors cursor-pointer"
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
                                <span>Size: <strong className={isOverLimit ? "text-red-400" : "text-white"}>{stats.size} MB</strong></span>
                                <span>Includes: <strong className="text-white">2D + 3D Data</strong></span>
                            </div>

                            {isOverLimit && (
                                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-2.5 flex items-start gap-2">
                                    <div className="min-w-[16px] mt-0.5 text-yellow-500">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-[10px] font-bold text-yellow-500 mb-0.5">Download Limit Exceeded</p>
                                        <p className="text-[10px] text-yellow-200/70 leading-relaxed">
                                            This area ({stats.size} MB) exceeds your {subscriptionStatus} Plan limit of {limit} MB. Please reduce the area size or upgrade your plan.
                                        </p>
                                    </div>
                                </div>
                            )}

                            <button
                                disabled={isCalculating || (isOverLimit ? false : (!downloadName || stats.count > 5000))}
                                onClick={isOverLimit ? () => setShowUpgradePrompt(true) : handleDownload}
                                className={`cursor-pointer w-full py-2.5 text-white text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                                    isOverLimit 
                                    ? 'bg-yellow-600 hover:bg-yellow-500 shadow-lg shadow-yellow-900/20' 
                                    : 'bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-900/20 disabled:bg-gray-800 disabled:text-gray-500'
                                }`}
                            >
                                {isCalculating ? <Loader2 size={14} className="animate-spin" /> : (isOverLimit ? <span className="uppercase">Check Upgrade Options</span> : <><Download size={14} /> Download Region</>)}
                            </button>
                        </div>
                     )}
                </div>
             </div>
             {upgradeModal}
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
                className="cursor-pointer p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"
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
                            className="cursor-pointer px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 mx-auto shadow-lg shadow-blue-900/20"
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
                        <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full text-gray-300">{userRegions.length}</span>
                    </div>

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
                                                if (window.confirm(`Are you sure you want to delete "${region.name}"? This will remove it from all your devices.`)) {
                                                    handleRemoveRegion(region.id);
                                                }
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
            )}
        </div>
        
        {/* Footer */}
        <div className="p-4 bg-black/40 border-t border-white/5 text-center text-[10px] text-gray-600 font-mono">
            Storage Used: {userRegions.reduce((acc, r) => acc + r.sizeEstMB, 0).toFixed(2)} MB
        </div>
      </div>

      {upgradeModal}
    </div>
  );
};