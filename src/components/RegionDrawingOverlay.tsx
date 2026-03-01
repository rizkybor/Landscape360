import { useState, useEffect } from 'react';
import { useMapStore } from '../store/useMapStore';
import { useOfflineStore } from '../store/useOfflineStore';
import type { OfflineRegion } from '../store/useOfflineStore';
import { getTilesInBounds, getMapboxTileUrl, getMapboxVectorTileUrl, getTerrainTileUrl } from '../utils/tileUtils';
import type { Bounds } from '../utils/tileUtils';
import { Download, Map as MapIcon, Loader2, X } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useSurveyStore } from '../store/useSurveyStore';
import { createPortal } from 'react-dom';
import { saveTilesBulk, hasTile } from '../utils/offline-db';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

export const RegionDrawingOverlay = () => {
  const { 
    zoom, 
    interactionMode, 
    setInteractionMode, 
    regionPoints, 
    clearRegionPoints 
  } = useMapStore();
  const { regions, addRegion, updateRegionProgress } = useOfflineStore();
  const { user, subscriptionStatus: storeSubscriptionStatus } = useSurveyStore();
  
  const [downloadName, setDownloadName] = useState('');
  const [includeSatellite, setIncludeSatellite] = useState(true);
  const [includeVector, setIncludeVector] = useState(true);
  const [isCalculating, setIsCalculating] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>('Free');
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<'size' | 'count'>('size');
  const [selectedUpgradePlan, setSelectedUpgradePlan] = useState<'Pro' | 'Enterprise'>('Pro');

  useEffect(() => {
    if (storeSubscriptionStatus) {
        setSubscriptionStatus(storeSubscriptionStatus);
        // If user is already Pro, default upgrade option should be Enterprise
        if (storeSubscriptionStatus === 'Pro') {
            setSelectedUpgradePlan('Enterprise');
        } else {
            setSelectedUpgradePlan('Pro');
        }
    } else if (user) {
      supabase.from('profiles').select('status_subscribe').eq('id', user.id).single()
        .then(({ data }) => {
          if (data) {
            const status = data.status_subscribe || 'Free';
            setSubscriptionStatus(status);
             // If user is already Pro, default upgrade option should be Enterprise
            if (status === 'Pro') {
                setSelectedUpgradePlan('Enterprise');
            } else {
                setSelectedUpgradePlan('Pro');
            }
          }
        });
    }
  }, [user, storeSubscriptionStatus]);

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
    
    // Estimate Size
    // Satellite + DEM = 2 requests (~25KB each avg)
    // Vector = 1 request (~15-20KB avg)
    let sizeFactor = 0;
    if (includeSatellite) sizeFactor += 0.05; // 50KB (Sat + DEM)
    if (includeVector) sizeFactor += 0.02; // 20KB (Vector)
    
    const size = (tiles.length * sizeFactor).toFixed(2); 
    
    return { count: tiles.length, size, minZoom, maxZoom, bounds };
  };

  const fetchWithRetry = async (url: string, retries = 3, backoff = 1000): Promise<Response> => {
    try {
        const response = await fetch(url, { mode: 'cors' });
        
        if (response.status === 429 && retries > 0) {
            await new Promise(resolve => setTimeout(resolve, backoff));
            return fetchWithRetry(url, retries - 1, backoff * 2);
        }

        if (response.status >= 500 && retries > 0) {
            await new Promise(resolve => setTimeout(resolve, backoff));
            return fetchWithRetry(url, retries - 1, backoff * 2);
        }

        return response;
    } catch (err) {
        if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, backoff));
            return fetchWithRetry(url, retries - 1, backoff * 2);
        }
        throw err;
    }
  };

  const handleDownload = async () => {
    if (!MAPBOX_TOKEN) {
        alert("Configuration Error: Mapbox token is missing.");
        return;
    }

    const { count, size, minZoom, maxZoom, bounds } = calculateSize();
    if (!bounds || !downloadName || !minZoom || !maxZoom) return;

    // 1. Check Offline Map Count Limit
    const userRegions = regions.filter(r => !user || r.userId === user.id);
    const countLimits: Record<string, number> = { 'Free': 1, 'Pro': 3, 'Enterprise': 10 };
    const normalizedStatus = subscriptionStatus === 'PRO' ? 'Pro' : subscriptionStatus;
    const countLimit = countLimits[normalizedStatus] || 1;
    
    if (userRegions.length >= countLimit) {
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
    
    // 3. Warm up Cache
    const warmupUrls: string[] = [];
    warmupUrls.push(`https://api.mapbox.com/v4/mapbox.mapbox-terrain-dem-v1.json?access_token=${MAPBOX_TOKEN}`);

    if (includeSatellite) {
        warmupUrls.push(`https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12?access_token=${MAPBOX_TOKEN}`);
        warmupUrls.push(`https://api.mapbox.com/v4/mapbox.satellite.json?access_token=${MAPBOX_TOKEN}`);
    }

    if (includeVector) {
         warmupUrls.push(`https://api.mapbox.com/styles/v1/mapbox/outdoors-v12?access_token=${MAPBOX_TOKEN}`);
         warmupUrls.push(`https://api.mapbox.com/styles/v1/mapbox/streets-v12?access_token=${MAPBOX_TOKEN}`);
         warmupUrls.push(`https://api.mapbox.com/v4/mapbox.mapbox-streets-v8.json?access_token=${MAPBOX_TOKEN}`);
    }
    
    warmupUrls.forEach(url => fetch(url, { mode: 'cors' }).catch(e => console.warn("Warmup failed", e)));

    // Start background download
    const tiles = getTilesInBounds(bounds, minZoom, maxZoom);
    let completed = 0;
    let failed = 0;
    const BATCH_SIZE = 10;
    const urls: string[] = [];
    
    tiles.forEach(t => {
      if (includeSatellite) urls.push(getMapboxTileUrl(t.x, t.y, t.z, MAPBOX_TOKEN));
      if (includeVector) urls.push(getMapboxVectorTileUrl(t.x, t.y, t.z, MAPBOX_TOKEN));
      if (t.z <= 15) urls.push(getTerrainTileUrl(t.x, t.y, t.z, MAPBOX_TOKEN));
    });

    try {
        for (let i = 0; i < urls.length; i += BATCH_SIZE) {
            const batch = urls.slice(i, i + BATCH_SIZE);
            const tilesToSave: { url: string, blob: Blob }[] = [];

            await Promise.all(batch.map(async (url) => {
                try {
                    if (await hasTile(url)) return;
                    const response = await fetchWithRetry(url);
                    if (response.ok) {
                        const blob = await response.blob();
                        tilesToSave.push({ url, blob });
                    } else {
                        failed++;
                    }
                } catch (err) {
                    failed++;
                }
            }));
            
            if (tilesToSave.length > 0) {
                await saveTilesBulk(tilesToSave);
            }
            
            completed += batch.length;
            const progress = Math.min(100, Math.round((completed / urls.length) * 100));
            updateRegionProgress(regionId, progress);
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (failed > urls.length * 0.1) {
             console.warn(`Download finished with ${failed} failures.`);
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

  const upgradeModal = showUpgradePrompt && createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 pointer-events-auto">
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
                         <button
                            onClick={() => setSelectedUpgradePlan('Pro')}
                            className={`cursor-pointer relative p-3 rounded-xl border transition-all ${selectedUpgradePlan === 'Pro' ? 'bg-blue-600/20 border-blue-500 ring-1 ring-blue-500' : 'bg-white/5 border-white/10 hover:border-white/20'}`}
                         >
                             {selectedUpgradePlan === 'Pro' && <div className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>}
                             <div className="text-left">
                                 <div className="text-xs font-bold text-blue-400 mb-1">PRO PLAN</div>
                                 <div className="text-lg font-bold text-white mb-1">Rp 55.000<span className="text-[10px] text-gray-400 font-normal">/bln</span></div>
                                 <div className="text-[10px] text-gray-400">Up to 10 MB / download</div>
                             </div>
                         </button>

                         <button
                            onClick={() => setSelectedUpgradePlan('Enterprise')}
                            className={`cursor-pointer relative p-3 rounded-xl border transition-all ${selectedUpgradePlan === 'Enterprise' ? 'bg-purple-600/20 border-purple-500 ring-1 ring-purple-500' : 'bg-white/5 border-white/10 hover:border-white/20'}`}
                         >
                             {selectedUpgradePlan === 'Enterprise' && <div className="absolute top-2 right-2 w-2 h-2 bg-purple-500 rounded-full shadow-[0_0_10px_rgba(168,85,247,0.5)]"></div>}
                             <div className="text-left">
                                 <div className="text-xs font-bold text-purple-400 mb-1">ENTERPRISE</div>
                                 <div className="text-lg font-bold text-white mb-1">Available Upon Request</div>
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
                        href={selectedUpgradePlan === 'Pro' 
                            ? `mailto:contact@jcdigital.co.id?subject=Subscription Upgrade: Landscape360 Pro Plan&body=Dear Admin,%0D%0A%0D%0AI hope this message finds you well.%0D%0A%0D%0AI am writing to request an upgrade of my account to the Landscape360 Pro Plan. I am interested in utilizing the advanced field tools and GPS broadcasting features.%0D%0A%0D%0AMy Account Email: ${user?.email}%0D%0A%0D%0APlease guide me through the payment and activation process.%0D%0A%0D%0AThank you,%0D%0A[Your Name]`
                            : `mailto:contact@jcdigital.co.id?subject=Subscription Upgrade: Landscape360 Enterprise Plan&body=Dear Admin,%0D%0A%0D%0AI hope this message finds you well.%0D%0A%0D%0AWe are interested in upgrading our organization's access to the Landscape360 Enterprise Plan to leverage the Realtime Monitoring and dedicated support features.%0D%0A%0D%0AMy Account Email: ${user?.email}%0D%0A%0D%0APlease contact us to arrange the upgrade and discuss any specific requirements.%0D%0A%0D%0ABest regards,%0D%0A[Your Name/Organization]`}
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

  if (interactionMode !== 'draw_region') return null;

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
                        {/* Layer Selection */}
                        <div className="bg-white/5 p-3 rounded-lg border border-white/5 space-y-2">
                            <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Select Data to Download</p>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={includeSatellite}
                                    onChange={e => setIncludeSatellite(e.target.checked)}
                                    className="rounded bg-black/40 border-white/20 text-blue-500 focus:ring-blue-500/50"
                                />
                                <span className="text-xs text-gray-300">Satellite Imagery (Raster)</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={includeVector}
                                    onChange={e => setIncludeVector(e.target.checked)}
                                    className="rounded bg-black/40 border-white/20 text-blue-500 focus:ring-blue-500/50"
                                />
                                <span className="text-xs text-gray-300">Map Data (Streets/Outdoors)</span>
                            </label>
                        </div>

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
};
