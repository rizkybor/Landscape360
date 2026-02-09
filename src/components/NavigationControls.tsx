import React, { useState } from "react";
import { Plus, Minus, Compass, Crosshair, Camera, Loader2 } from "lucide-react";
import type { MapRef } from "react-map-gl/mapbox";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import geoportalLogo from "../assets/geoportal360.png";
import { useSurveyStore } from "../store/useSurveyStore";
import { distance, point } from "@turf/turf";

interface NavigationControlsProps {
  mapRef: React.RefObject<MapRef | null>;
  onGeolocate: () => void;
  bearing: number;
}

const toDMS = (deg: number, isLat: boolean): string => {
    const absolute = Math.abs(deg);
    const degrees = Math.floor(absolute);
    const minutesNotTruncated = (absolute - degrees) * 60;
    const minutes = Math.floor(minutesNotTruncated);
    const seconds = ((minutesNotTruncated - minutes) * 60).toFixed(1);
    
    const dir = isLat 
        ? (deg >= 0 ? "N" : "S") 
        : (deg >= 0 ? "E" : "W");
        
    return `${degrees}° ${minutes}' ${seconds}" ${dir}`;
};

export const NavigationControls: React.FC<NavigationControlsProps> = ({
  mapRef,
  onGeolocate,
  bearing,
}) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const { groups } = useSurveyStore();

  const handleZoomIn = () => {
    mapRef.current?.getMap().zoomIn();
  };

  const handleZoomOut = () => {
    mapRef.current?.getMap().zoomOut();
  };

  const handleResetNorth = () => {
    mapRef.current?.getMap().resetNorthPitch();
  };

  const handleCapture = async (format: 'png' | 'jpg' | 'pdf') => {
    if (!mapRef.current) return;
    setIsCapturing(true);
    setShowExportMenu(false);

    try {
        const map = mapRef.current.getMap();
        const canvas = map.getCanvas();
        
        // Force a render to ensure everything is sharp
        map.triggerRepaint();

        // Wait a frame
        await new Promise(resolve => setTimeout(resolve, 100));

        // Gather Survey Data
        const allPoints = groups.flatMap(g => g.points);
        const hasData = allPoints.length > 0;

        // Determine if we need to resize the container to fit the table
        const baseWidth = canvas.width;
        
        // Mobile Fix: Detect if on mobile (screen width < 768px) and cap the width/scale
        // Mobile browsers often have high DPR but low memory. 
        // If canvas.width is huge (e.g. 3000px on retina mobile), we should scale it down for export.
        const isMobile = window.innerWidth < 768;
        let exportWidth = baseWidth;
        let exportScale = 1;
        
        if (isMobile && baseWidth > 1200) {
            exportWidth = 1200; // Cap width to safe limit for mobile
            exportScale = exportWidth / baseWidth;
        }

        // Calculate dynamic scale based on resolution (High DPI screens need bigger text)
        // But for mobile export, we want readable text relative to the exported image size
        const scale = Math.max(1, exportWidth / 1920); 
        
        // Create a temporary container for the watermark composition
        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.left = '-9999px';
        container.style.top = '0';
        container.style.width = `${exportWidth}px`;
        // container.style.minHeight = `${canvas.height * exportScale}px`; // Scale height proportionally
        container.style.background = '#111827'; // Dark background for the report container
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        
        document.body.appendChild(container);

        // 1. Map Image Container
        const mapContainer = document.createElement('div');
        mapContainer.style.position = 'relative';
        mapContainer.style.width = '100%';
        // mapContainer.style.height = `${canvas.height * exportScale}px`;
        
        const mapImage = new Image();
        mapImage.src = canvas.toDataURL('image/png', 0.8); // Use 0.8 quality to save memory on mobile
        mapImage.style.width = '100%';
        mapImage.style.height = 'auto'; // Let it maintain aspect ratio
        mapImage.style.display = 'block'; // Remove inline spacing
        // mapImage.style.objectFit = 'cover';
        await new Promise(resolve => mapImage.onload = resolve);
        
        mapContainer.appendChild(mapImage);
        
        // Add Overlay to Map Image (Header/Footer Watermark)
        const overlay = document.createElement('div');
        overlay.style.position = 'absolute';
        overlay.style.inset = '0';
        overlay.style.display = 'flex';
        overlay.style.flexDirection = 'column';
        overlay.style.justifyContent = 'space-between';
        overlay.style.padding = `${40 * scale}px`;
        overlay.style.pointerEvents = 'none';
        
        overlay.innerHTML = `
            <!-- Top Header -->
            <div style="display: flex; justify-content: space-between; align-items: start;">
                <div style="display: flex; align-items: center; gap: ${16 * scale}px; background: rgba(0,0,0,0.6); padding: ${16 * scale}px ${24 * scale}px; border-radius: ${16 * scale}px; backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.15);">
                    <img src="${geoportalLogo}" style="width: ${48 * scale}px; height: ${48 * scale}px; object-fit: contain;" />
                    <div>
                        <h1 style="color: white; font-family: 'Inter', sans-serif; font-weight: 800; font-size: ${24 * scale}px; line-height: 1; margin: 0; letter-spacing: -0.02em;">Landscape 360</h1>
                        <p style="color: #60a5fa; font-family: 'Inter', monospace; font-size: ${12 * scale}px; margin: ${4 * scale}px 0 0 0; letter-spacing: 0.1em; text-transform: uppercase;">Professional Survey Report</p>
                    </div>
                </div>
                
                <div style="background: rgba(0,0,0,0.6); padding: ${12 * scale}px ${20 * scale}px; border-radius: ${12 * scale}px; backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.15); text-align: right;">
                    <div style="color: white; font-family: 'Inter', monospace; font-size: ${14 * scale}px; font-weight: bold;">${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                    <div style="color: #9ca3af; font-family: 'Inter', monospace; font-size: ${12 * scale}px;">${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
            </div>

            <!-- Bottom Footer (Map Info) -->
            <div style="display: flex; justify-content: space-between; align-items: end;">
                <div style="background: rgba(0,0,0,0.6); padding: ${16 * scale}px; border-radius: ${16 * scale}px; backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.15); display: grid; grid-template-columns: auto auto; gap: ${8 * scale}px ${24 * scale}px; color: white; font-family: 'Inter', monospace; font-size: ${12 * scale}px;">
                    <div style="color: #9ca3af;">Center Point</div>
                    <div style="font-weight: bold;">${toDMS(map.getCenter().lat, true)}, ${toDMS(map.getCenter().lng, false)}</div>
                    
                    <div style="color: #9ca3af;">Avg Elevation</div>
                    <div style="font-weight: bold; color: #fde047;">${(map.queryTerrainElevation ? map.queryTerrainElevation(map.getCenter()) : 0)?.toFixed(1)}m</div>
                    
                    <div style="color: #9ca3af;">Heading/Pitch</div>
                    <div style="font-weight: bold;">${map.getBearing().toFixed(1)}° / ${map.getPitch().toFixed(1)}°</div>
                </div>

                <div style="text-align: right; opacity: 0.8;">
                    <p style="color: white; font-family: 'Inter', sans-serif; font-size: ${10 * scale}px; font-weight: 600; margin: 0; text-shadow: 0 2px 4px rgba(0,0,0,0.5);">Generated by Landscape 360</p>
                    <p style="color: rgba(255,255,255,0.6); font-family: 'Inter', sans-serif; font-size: ${9 * scale}px; margin: 0;">In Collaboration with JC Digital & Makopala UBL</p>
                </div>
            </div>
        `;
        mapContainer.appendChild(overlay);
        container.appendChild(mapContainer);

        // 2. Data Table & Graph Section (If points exist)
        if (hasData) {
            const contentSection = document.createElement('div');
            contentSection.style.padding = `${40 * scale}px`;
            contentSection.style.backgroundColor = '#111827';
            contentSection.style.color = 'white';
            contentSection.style.fontFamily = "'Inter', sans-serif";
            
            // Calculate distances and prepare data
            let cumulativeDist = 0;
            const processedPoints = allPoints.map((p, idx) => {
                let dist = 0;
                if (idx > 0) {
                    const prev = allPoints[idx - 1];
                    const from = point([prev.lng, prev.lat]);
                    const to = point([p.lng, p.lat]);
                    dist = distance(from, to, { units: 'meters' });
                    cumulativeDist += dist;
                }
                return {
                    ...p,
                    dist,
                    totalDist: cumulativeDist
                };
            });

            // Generate Table Rows
            const rows = processedPoints.map((p, idx) => `
                <tr style="border-bottom: 1px solid #374151;">
                    <td style="padding: ${12 * scale}px; color: #3b82f6; font-weight: bold;">${idx + 1}</td>
                    <td style="padding: ${12 * scale}px; font-weight: 500;">${p.name || `Point ${idx + 1}`}</td>
                    <td style="padding: ${12 * scale}px; font-family: monospace;">${toDMS(p.lat, true)} <br/> ${toDMS(p.lng, false)}</td>
                    <td style="padding: ${12 * scale}px; font-family: monospace;">${idx === 0 ? '-' : p.dist.toFixed(1) + ' m'}</td>
                    <td style="padding: ${12 * scale}px; font-family: monospace; color: #fde047;">${p.totalDist.toFixed(1)} m</td>
                </tr>
            `).join('');

            // Generate Elevation Chart (SVG) - Professional Styling
            const chartHeight = 300 * scale;
            const chartWidth = baseWidth - (80 * scale); // padding
            const chartPadding = { top: 40 * scale, right: 40 * scale, bottom: 60 * scale, left: 60 * scale };
            const graphWidth = chartWidth - chartPadding.left - chartPadding.right;
            const graphHeight = chartHeight - chartPadding.top - chartPadding.bottom;

            const maxElev = Math.max(...processedPoints.map(p => p.elevation));
            const minElev = Math.min(...processedPoints.map(p => p.elevation));
            const elevBuffer = (maxElev - minElev) * 0.1 || 5; // 10% buffer
            const yMax = maxElev + elevBuffer;
            const yMin = minElev - elevBuffer;
            const yRange = yMax - yMin || 1;
            const maxDist = cumulativeDist || 1;

            // Generate Point Coordinates
            const pointsCoords = processedPoints.map(p => ({
                x: chartPadding.left + (p.totalDist / maxDist) * graphWidth,
                y: chartPadding.top + graphHeight - ((p.elevation - yMin) / yRange) * graphHeight,
                val: p.elevation,
                dist: p.totalDist,
                label: (p.name || '').substring(0, 3)
            }));

            // SVG Path Commands
            const linePath = pointsCoords.map((p, i) => `${i===0?'M':'L'} ${p.x},${p.y}`).join(' ');
            const areaPath = `${linePath} L ${pointsCoords[pointsCoords.length-1].x},${chartPadding.top + graphHeight} L ${pointsCoords[0].x},${chartPadding.top + graphHeight} Z`;
            
            // Unique ID for gradient
            const gradientId = `elevGradient-${Date.now()}`;

            contentSection.innerHTML = `
                <div style="display: flex; gap: ${40 * scale}px; align-items: flex-start;">
                    <!-- Table Column -->
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: ${12 * scale}px; margin-bottom: ${24 * scale}px; border-bottom: 1px solid #374151; padding-bottom: ${16 * scale}px;">
                            <div style="width: ${4 * scale}px; height: ${24 * scale}px; background-color: #3b82f6; border-radius: 4px;"></div>
                            <h2 style="font-size: ${20 * scale}px; font-weight: bold; margin: 0;">Survey Data Points</h2>
                            <span style="background-color: #1f2937; color: #9ca3af; padding: ${4 * scale}px ${12 * scale}px; border-radius: 99px; font-size: ${12 * scale}px; font-weight: 500;">${allPoints.length} Points</span>
                        </div>
                        
                        <table style="width: 100%; border-collapse: collapse; font-size: ${14 * scale}px; text-align: left;">
                            <thead>
                                <tr style="background-color: #1f2937; color: #9ca3af; text-transform: uppercase; font-size: ${11 * scale}px; letter-spacing: 0.05em;">
                                    <th style="padding: ${12 * scale}px; border-radius: 8px 0 0 8px;">#</th>
                                    <th style="padding: ${12 * scale}px;">Point Name</th>
                                    <th style="padding: ${12 * scale}px;">Coordinates (DMS)</th>
                                    <th style="padding: ${12 * scale}px;">Distance</th>
                                    <th style="padding: ${12 * scale}px; border-radius: 0 8px 8px 0;">Total Dist.</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rows}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Elevation Profile Chart -->
                <div style="margin-top: ${40 * scale}px; padding: ${32 * scale}px; background: #1f2937; border-radius: ${16 * scale}px; border: 1px solid #374151; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: ${24 * scale}px;">
                         <div style="display: flex; align-items: center; gap: ${12 * scale}px;">
                            <div style="width: ${4 * scale}px; height: ${20 * scale}px; background-color: #fde047; border-radius: 4px;"></div>
                            <h3 style="font-size: ${18 * scale}px; font-weight: bold; color: white; margin: 0;">Elevation Profile Analysis</h3>
                         </div>
                         <div style="display: flex; gap: ${24 * scale}px; font-size: ${12 * scale}px; font-family: monospace; color: #9ca3af; background: rgba(0,0,0,0.2); padding: ${8 * scale}px ${16 * scale}px; border-radius: 8px;">
                            <div style="display: flex; align-items: center; gap: ${8 * scale}px;">
                                <span style="color: #6b7280;">MIN</span>
                                <span style="color: white; font-weight: bold;">${minElev.toFixed(1)}m</span>
                            </div>
                            <div style="width: 1px; background: #4b5563;"></div>
                            <div style="display: flex; align-items: center; gap: ${8 * scale}px;">
                                <span style="color: #6b7280;">MAX</span>
                                <span style="color: white; font-weight: bold;">${maxElev.toFixed(1)}m</span>
                            </div>
                            <div style="width: 1px; background: #4b5563;"></div>
                            <div style="display: flex; align-items: center; gap: ${8 * scale}px;">
                                <span style="color: #6b7280;">GAIN</span>
                                <span style="color: #fde047; font-weight: bold;">+${(maxElev - minElev).toFixed(1)}m</span>
                            </div>
                         </div>
                    </div>

                    <div style="position: relative; width: 100%; height: ${chartHeight}px;">
                        <svg width="100%" height="100%" viewBox="0 0 ${chartWidth} ${chartHeight}" preserveAspectRatio="none" style="overflow: visible;">
                             <defs>
                                <linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stop-color="#fde047" stop-opacity="0.3"/>
                                    <stop offset="100%" stop-color="#fde047" stop-opacity="0.05"/>
                                </linearGradient>
                             </defs>

                             <!-- Grid System -->
                             ${[0, 0.2, 0.4, 0.6, 0.8, 1].map(t => {
                                const y = chartPadding.top + (graphHeight * t);
                                const labelValue = yMax - (yRange * t);
                                return `
                                    <line x1="${chartPadding.left}" y1="${y}" x2="${chartWidth - chartPadding.right}" y2="${y}" stroke="#374151" stroke-dasharray="4" stroke-width="1" />
                                    <text x="${chartPadding.left - (12 * scale)}" y="${y + (4 * scale)}" text-anchor="end" fill="#6b7280" font-size="${11 * scale}px" font-family="monospace" font-weight="500">${labelValue.toFixed(0)}m</text>
                                `;
                             }).join('')}

                            <!-- Area & Line -->
                            <path d="${areaPath}" fill="url(#${gradientId})" />
                            <path d="${linePath}" fill="none" stroke="#fde047" stroke-width="${3 * scale}" stroke-linejoin="round" stroke-linecap="round" />
                            
                            <!-- Points & Labels -->
                            ${pointsCoords.map((p, i) => `
                                <g>
                                    <!-- Vertical Guide Line (Subtle) -->
                                    <line x1="${p.x}" y1="${p.y}" x2="${p.x}" y2="${chartPadding.top + graphHeight}" stroke="#374151" stroke-width="1" stroke-dasharray="2" opacity="0.5" />
                                    
                                    <!-- Point Marker -->
                                    <circle cx="${p.x}" cy="${p.y}" r="${5 * scale}" fill="#1f2937" stroke="#fde047" stroke-width="${2 * scale}" />
                                    
                                    <!-- Elevation Label -->
                                    <rect x="${p.x - (18 * scale)}" y="${p.y - (26 * scale)}" width="${36 * scale}" height="${18 * scale}" rx="${4 * scale}" fill="#fde047" />
                                    <text x="${p.x}" y="${p.y - (14 * scale)}" text-anchor="middle" fill="#000" font-size="${10 * scale}px" font-weight="bold" font-family="monospace">${p.val.toFixed(0)}</text>
                                    
                                    <!-- X-Axis Label (Point Index) -->
                                    <text x="${p.x}" y="${chartPadding.top + graphHeight + (20 * scale)}" text-anchor="middle" fill="#9ca3af" font-size="${11 * scale}px" font-weight="bold" font-family="monospace">${i + 1}</text>
                                    
                                    <!-- X-Axis Dist Label -->
                                    <text x="${p.x}" y="${chartPadding.top + graphHeight + (36 * scale)}" text-anchor="middle" fill="#4b5563" font-size="${9 * scale}px" font-family="monospace">${p.dist.toFixed(0)}m</text>
                                </g>
                            `).join('')}
                            
                            <!-- X-Axis Line -->
                            <line x1="${chartPadding.left}" y1="${chartPadding.top + graphHeight}" x2="${chartWidth - chartPadding.right}" y2="${chartPadding.top + graphHeight}" stroke="#4b5563" stroke-width="2" />
                        </svg>
                    </div>
                </div>
            `;
            container.appendChild(contentSection);
        }

        // 3. Render Composition to Image using html2canvas
        // Mobile Fix: Use lower scale for high-DPI devices to prevent crash
        const dpr = window.devicePixelRatio || 1;
        const captureScale = isMobile && dpr > 2 ? 2/dpr : 1; // Normalize to max 2x density effectively
        
        const compositionCanvas = await html2canvas(container, {
            useCORS: true,
            allowTaint: true, // Allow cross-origin images if any
            scale: captureScale, // Adjust scale for mobile
            backgroundColor: '#111827',
            logging: false,
            // ignoreElements: (element) => element.tagName === 'IFRAME' // Ignore mapbox iframes if any
        });

        // 4. Export based on format
        if (format === 'pdf') {
            const pdf = new jsPDF({
                orientation: compositionCanvas.width > compositionCanvas.height ? 'landscape' : 'portrait',
                unit: 'px',
                format: [compositionCanvas.width, compositionCanvas.height]
            });
            pdf.addImage(compositionCanvas.toDataURL('image/jpeg', 0.8), 'JPEG', 0, 0, compositionCanvas.width, compositionCanvas.height);
            pdf.save(`Landscape360_Report_${Date.now()}.pdf`);
        } else {
            // Mobile Fix: Direct link click often fails in PWA/WebView. 
            // Try to open in new tab if download fails or use specific mobile handling
            const dataUrl = compositionCanvas.toDataURL(format === 'png' ? 'image/png' : 'image/jpeg', 0.85);
            
            try {
                const link = document.createElement('a');
                link.download = `Landscape360_Survey_${Date.now()}.${format}`;
                link.href = dataUrl;
                document.body.appendChild(link); // Required for Firefox/Mobile
                link.click();
                document.body.removeChild(link);
            } catch (e) {
                // Fallback: Open image directly so user can long-press save
                window.open(dataUrl, '_blank');
            }
        }

        // Cleanup
        document.body.removeChild(container);

    } catch (err) {
        console.error("Screenshot failed:", err);
        alert("Failed to capture screenshot. Please try again.");
    } finally {
        setIsCapturing(false);
    }
  };

  return (
    <div className="absolute top-4 right-4 flex flex-col gap-4 z-20">
      {/* Export / Screenshot Button */}
      <div className="relative">
        <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            disabled={isCapturing}
            className="bg-white/90 backdrop-blur-sm p-2.5 rounded-xl shadow-lg border border-white/20 hover:bg-white hover:text-blue-600 transition-all active:scale-95 group cursor-pointer"
            title="Take Screenshot / Export"
        >
            {isCapturing ? <Loader2 size={20} className="animate-spin text-blue-600" /> : <Camera size={20} className="text-gray-700 group-hover:text-blue-600 transition-colors" />}
        </button>

        {/* Dropdown Menu */}
        {showExportMenu && (
            <div className="absolute top-0 right-14 bg-white/95 backdrop-blur-xl border border-white/20 rounded-xl shadow-2xl p-2 flex flex-col gap-1 min-w-[140px] animate-in fade-in slide-in-from-right-4 z-30">
                <div className="text-[10px] font-bold text-gray-400 px-2 py-1 uppercase tracking-wider">Export As</div>
                <button 
                    onClick={() => handleCapture('png')}
                    className="flex items-center justify-between px-3 py-2 text-xs font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors text-left"
                >
                    <span>High-Res PNG</span>
                    <span className="text-[9px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">HD</span>
                </button>
                <button 
                    onClick={() => handleCapture('jpg')}
                    className="flex items-center justify-between px-3 py-2 text-xs font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors text-left"
                >
                    <span>Compact JPG</span>
                    <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">Light</span>
                </button>
                <div className="h-px bg-gray-200 my-0.5"></div>
                <button 
                    onClick={() => handleCapture('pdf')}
                    className="flex items-center justify-between px-3 py-2 text-xs font-medium text-gray-700 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors text-left"
                >
                    <span>Report PDF</span>
                    <span className="text-[9px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded">Doc</span>
                </button>
            </div>
        )}
      </div>

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
