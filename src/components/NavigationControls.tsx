import React, { useState } from "react";
import { Plus, Minus, Compass, Crosshair, Camera, Loader2 } from "lucide-react";
import type { MapRef } from "react-map-gl/mapbox";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import geoportalLogo from "../assets/geoportal360.png";
import { useSurveyStore } from "../store/useSurveyStore";

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
        let surveyTableHTML = '';
        const allPoints = groups.flatMap(g => g.points);
        const hasData = allPoints.length > 0;

        // Determine if we need to resize the container to fit the table
        const baseWidth = canvas.width;
        // Calculate dynamic scale based on resolution (High DPI screens need bigger text)
        const scale = Math.max(1, baseWidth / 1920); 
        
        // Estimate table height if data exists
        const tableHeight = hasData ? (allPoints.length * 30 * scale) + (100 * scale) : 0;
        const totalHeight = canvas.height + (format === 'pdf' ? tableHeight : 0); // Only extend height for PDF usually, but let's do it for all for completeness

        // Create a temporary container for the watermark composition
        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.left = '-9999px';
        container.style.top = '0';
        container.style.width = `${baseWidth}px`;
        // For PDF, we might want a vertical layout if table is long
        // But for images, maybe overlay table? 
        // Let's go with a professional "Report Layout" where map is top, table is bottom
        container.style.minHeight = `${canvas.height}px`;
        container.style.background = '#111827'; // Dark background for the report container
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        
        document.body.appendChild(container);

        // 1. Map Image Container
        const mapContainer = document.createElement('div');
        mapContainer.style.position = 'relative';
        mapContainer.style.width = '100%';
        mapContainer.style.height = `${canvas.height}px`;
        
        const mapImage = new Image();
        mapImage.src = canvas.toDataURL('image/png', 1.0);
        mapImage.style.width = '100%';
        mapImage.style.height = '100%';
        mapImage.style.objectFit = 'cover';
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
                    <div style="font-weight: bold;">${map.getCenter().lat.toFixed(5)}, ${map.getCenter().lng.toFixed(5)}</div>
                    
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

        // 2. Data Table Section (If points exist)
        if (hasData) {
            const tableSection = document.createElement('div');
            tableSection.style.padding = `${40 * scale}px`;
            tableSection.style.backgroundColor = '#111827';
            tableSection.style.color = 'white';
            tableSection.style.fontFamily = "'Inter', sans-serif";
            
            // Group points by survey group
            const rows = groups.map(group => {
                if (group.points.length === 0) return '';
                return group.points.map((p, idx) => `
                    <tr style="border-bottom: 1px solid #374151;">
                        <td style="padding: ${12 * scale}px; color: ${group.color}; font-weight: bold;">${idx + 1}</td>
                        <td style="padding: ${12 * scale}px; font-weight: 500;">${p.name || `Point ${idx + 1}`}</td>
                        <td style="padding: ${12 * scale}px; color: #9ca3af;">${group.name}</td>
                        <td style="padding: ${12 * scale}px; font-family: monospace;">${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}</td>
                        <td style="padding: ${12 * scale}px; font-family: monospace; color: #fde047;">${p.elevation.toFixed(1)} m</td>
                    </tr>
                `).join('');
            }).join('');

            tableSection.innerHTML = `
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
                            <th style="padding: ${12 * scale}px;">Group</th>
                            <th style="padding: ${12 * scale}px;">Coordinates (Lat, Lng)</th>
                            <th style="padding: ${12 * scale}px; border-radius: 0 8px 8px 0;">Elevation</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            `;
            container.appendChild(tableSection);
        }

        // 3. Render Composition to Image using html2canvas
        const compositionCanvas = await html2canvas(container, {
            useCORS: true,
            scale: 1, // Already handled by element sizing
            backgroundColor: '#111827',
            logging: false
        });

        // 4. Export based on format
        if (format === 'pdf') {
            const pdf = new jsPDF({
                orientation: compositionCanvas.width > compositionCanvas.height ? 'landscape' : 'portrait',
                unit: 'px',
                format: [compositionCanvas.width, compositionCanvas.height]
            });
            pdf.addImage(compositionCanvas.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, compositionCanvas.width, compositionCanvas.height);
            pdf.save(`Landscape360_Report_${Date.now()}.pdf`);
        } else {
            const link = document.createElement('a');
            link.download = `Landscape360_Survey_${Date.now()}.${format}`;
            link.href = compositionCanvas.toDataURL(format === 'png' ? 'image/png' : 'image/jpeg', 0.9);
            link.click();
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
