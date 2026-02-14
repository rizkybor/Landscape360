import React, { useState, useEffect } from "react";
import { Plus, Minus, Compass, Crosshair, Camera, Loader2, X } from "lucide-react";
import type { MapRef } from "react-map-gl/mapbox";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import JSZip from "jszip";
import geoportalLogo from "../assets/geoportal360.png";
import { useSurveyStore } from "../store/useSurveyStore";
import { useMapStore } from "../store/useMapStore";
import { distance, point } from "@turf/turf";

interface NavigationControlsProps {
  mapRef: React.RefObject<MapRef | null>;
  onGeolocate: () => void;
  bearing: number;
  pitch: number;
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
  pitch,
}) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showCompassMenu, setShowCompassMenu] = useState(false);
  const { groups } = useSurveyStore();
  const { setPitch, setBearing } = useMapStore();
  
  // Local state for smooth slider interaction without re-rendering the whole map store on every pixel
  const [localPitch, setLocalPitch] = useState(pitch);
  const [localBearing, setLocalBearing] = useState(bearing);
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);

  // Sync local state with props when NOT dragging
  useEffect(() => {
    if (!isDraggingSlider) {
        setLocalPitch(pitch);
        setLocalBearing(bearing);
    }
  }, [pitch, bearing, isDraggingSlider]);

  const handlePitchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = Number(e.target.value);
      setLocalPitch(val);
      
      // Direct map manipulation for 60fps performance
      if (mapRef.current) {
          const map = mapRef.current.getMap();
          map.setPitch(val);
      }
  };

  const handleBearingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = Number(e.target.value);
      setLocalBearing(val);
      
      // Direct map manipulation
      if (mapRef.current) {
          const map = mapRef.current.getMap();
          map.setBearing(val);
      }
  };

  const handleSliderCommit = () => {
      // Sync to store only when interaction ends
      setIsDraggingSlider(false);
      setPitch(localPitch);
      setBearing(localBearing);
  };

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showCompassMenu && !(event.target as Element).closest('.compass-menu-container')) {
        setShowCompassMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showCompassMenu]);

  const handleZoomIn = () => {
    mapRef.current?.getMap().zoomIn();
  };

  const handleZoomOut = () => {
    mapRef.current?.getMap().zoomOut();
  };

  const handleResetNorth = () => {
    setBearing(0);
    setPitch(0);
    // mapRef.current?.getMap().resetNorthPitch(); // Store update will trigger map sync
  };

  const handleCapture = async (format: 'png' | 'jpg' | 'pdf') => {
    if (!mapRef.current) return;
    setIsCapturing(true);
    setShowExportMenu(false);

    try {
        const map = mapRef.current.getMap();
        const canvas = map.getCanvas();
        
        // Force a render to ensure everything is sharp
        await new Promise<void>((resolve) => {
             map.once('render', () => resolve());
             map.triggerRepaint();
        });

        // Wait for fonts to load
        await document.fonts.ready;

        // Gather Survey Data
        const allPoints = groups.flatMap(g => g.points);
        const hasData = allPoints.length > 0;

        // Determine if we need to resize the container to fit the table
        // const baseWidth = canvas.width;
        
        // Mobile Fix: Detect if on mobile (screen width < 768px) and cap the width/scale
        const isMobile = window.innerWidth < 768;
        
        // Professional Output: Standardize width for consistency across devices
        // Use 1600px as standard high-quality width for both desktop and mobile exports
        const exportWidth = 1600;

        // Calculate dynamic scale based on reference width (1600px)
        // This ensures relative proportions are identical regardless of actual screen size
        const scale = exportWidth / 1600; 
        
        // --- PROFESSIONAL GENERATION (MULTI-PAGE / ZIP) ---
        
        // Define Layout Constants (A4 Aspect Ratio: 1 : 1.414)
        const PAGE_WIDTH = exportWidth;
        const PAGE_HEIGHT = Math.floor(exportWidth * 1.414);
        const MARGIN = 40 * scale;
        
        const captureScale = 2; // High quality export

        // Helper to capture a specific DOM element as a page
        const capturePage = async (pageContent: HTMLElement) => {
            // Ensure no scrollbars
            pageContent.style.overflow = 'hidden';
            
            return await html2canvas(pageContent, {
                useCORS: true,
                allowTaint: true,
                scale: captureScale, // High res capture
                backgroundColor: '#111827',
                logging: false,
                width: PAGE_WIDTH,
                height: PAGE_HEIGHT,
                windowWidth: PAGE_WIDTH,
                windowHeight: PAGE_HEIGHT,
                onclone: (doc) => {
                    // Safety: Ensure fonts in cloned doc are ready (usually inherits, but good practice)
                    const el = doc.getElementById('page-container-clone');
                    if (el) el.style.fontFamily = "'Inter', sans-serif";
                }
            });
        };

        // Container for building pages
        const pageContainer = document.createElement('div');
        pageContainer.id = 'page-container-clone'; // ID for reference
        pageContainer.style.position = 'fixed';
        pageContainer.style.left = '-9999px';
        pageContainer.style.top = '0';
        pageContainer.style.width = `${PAGE_WIDTH}px`;
        pageContainer.style.height = `${PAGE_HEIGHT}px`;
        pageContainer.style.backgroundColor = '#111827';
        pageContainer.style.color = 'white';
        pageContainer.style.fontFamily = "'Inter', sans-serif";
        pageContainer.style.overflow = 'hidden'; // Clip content
        pageContainer.style.display = 'flex';
        pageContainer.style.flexDirection = 'column';
        document.body.appendChild(pageContainer);

        // Store captured canvases
        const pageCanvases: HTMLCanvasElement[] = [];

        // --- PAGE 1: HEADER + MAP + TABLE START ---
        
        // 1. Add Header
        const headerHeight = 100 * scale;
        const renderHeader = (isFirstPage: boolean) => `
            <div style="height: ${headerHeight}px; padding: ${MARGIN}px ${MARGIN}px 0 ${MARGIN}px; display: flex; justify-content: space-between; align-items: start; margin-bottom: ${20 * scale}px;">
                <div style="display: flex; align-items: center; gap: ${16 * scale}px;">
                    <img src="${geoportalLogo}" style="width: ${40 * scale}px; height: ${40 * scale}px; object-fit: contain;" />
                    <div>
                        <h1 style="color: white; font-family: 'Inter', sans-serif; font-weight: 800; font-size: ${20 * scale}px; line-height: 1; margin: 0; letter-spacing: -0.02em;">Landscape 360</h1>
                        <p style="color: #60a5fa; font-family: 'Inter', monospace; font-size: ${10 * scale}px; margin: ${4 * scale}px 0 0 0; letter-spacing: 0.1em; text-transform: uppercase;">${isFirstPage ? 'Professional Survey Report' : 'Survey Report Continuation'}</p>
                    </div>
                </div>
                <div style="text-align: right;">
                    <div style="color: white; font-family: 'Inter', monospace; font-size: ${12 * scale}px; font-weight: bold;">${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                </div>
            </div>
            <div style="height: 1px; background: #374151; margin: 0 ${MARGIN}px;"></div>
        `;

        // Table Constants
        const tableHeaderHeight = 50 * scale;
        const rowHeight = 45 * scale;
        const footerHeight = 60 * scale;
        
        // Footer Render Function
        const renderPageFooter = (pageNum: number) => `
            <div style="position: absolute; bottom: 0; left: 0; width: 100%; height: ${footerHeight}px; padding: 0 ${MARGIN}px; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #374151; background-color: #111827; z-index: 50;">
                <div style="display: flex; gap: ${16 * scale}px; align-items: center;">
                    <span style="color: #6b7280; font-size: ${10 * scale}px;">© ${new Date().getFullYear()} Landscape 360</span>
                    <span style="color: #4b5563; font-size: ${10 * scale}px;">|</span>
                    <span style="color: #6b7280; font-size: ${10 * scale}px;">Professional Survey Report</span>
                </div>
                <div style="color: #f3f4f6; font-size: ${10 * scale}px; font-weight: 500; text-align: right;">
                    Page ${pageNum}
                </div>
            </div>
        `;
        
        // Helper to add footer to current page container
        const addFooter = (pageNum: number) => {
            const f = document.createElement('div');
            f.innerHTML = renderPageFooter(pageNum).trim();
            if (f.firstElementChild) {
                pageContainer.appendChild(f.firstElementChild);
            }
        };
        
        // Initialize Page 1
        let currentPageNum = 1;
        pageContainer.innerHTML = renderHeader(true);
        
        // 2. Add Map (Only on Page 1)
        const mapSection = document.createElement('div');
        mapSection.style.padding = `${20 * scale}px ${MARGIN}px`;
        
        // 1. Map Image Container
        const mapContainer = document.createElement('div');
        mapContainer.style.position = 'relative';
        mapContainer.style.width = '100%';
        
        const mapImage = new Image();
        mapImage.src = canvas.toDataURL('image/png', 0.9); 
        mapImage.crossOrigin = "anonymous";
        
        await new Promise((resolve) => {
            mapImage.onload = resolve;
            mapImage.onerror = resolve; 
            setTimeout(resolve, 1000);
        });
        
        mapContainer.appendChild(mapImage);

        // --- Add Survey Points Overlay (Prisma Markers) ---
        if (hasData) {
            const mapContainerEl = map.getContainer();
            const containerWidth = mapContainerEl.clientWidth;
            const containerHeight = mapContainerEl.clientHeight;
            
            allPoints.forEach((p) => {
                if (!p.name) return;

                const pos = map.project([p.lng, p.lat]);
                
                if (pos.x >= -100 && pos.x <= containerWidth + 100 && 
                    pos.y >= -100 && pos.y <= containerHeight + 100) {
                    
                    const leftPct = (pos.x / containerWidth) * 100;
                    const topPct = (pos.y / containerHeight) * 100;
                    
                    const markerWrapper = document.createElement('div');
                    markerWrapper.style.position = 'absolute';
                    markerWrapper.style.left = `${leftPct}%`;
                    markerWrapper.style.top = `${topPct}%`;
                    markerWrapper.style.width = '0';
                    markerWrapper.style.height = '0';
                    markerWrapper.style.overflow = 'visible';
                    markerWrapper.style.zIndex = '10'; 
                    
                    // 1. The Diamond Marker
                    const markerSize = 12 * scale;
                    const markerEl = document.createElement('div');
                    markerEl.style.position = 'absolute';
                    markerEl.style.width = `${markerSize}px`;
                    markerEl.style.height = `${markerSize}px`;
                    markerEl.style.backgroundColor = '#6366f1'; 
                    markerEl.style.border = `${2 * scale}px solid black`;
                    markerEl.style.left = `-${markerSize/2}px`;
                    markerEl.style.top = `-${markerSize/2}px`;
                    markerEl.style.transform = 'rotate(45deg)';
                    markerWrapper.appendChild(markerEl);

                    // 2. The Label (Glassmorphism Pill Style)
                    const labelEl = document.createElement('div');
                    labelEl.style.position = 'absolute';
                    labelEl.style.bottom = `${markerSize + (8 * scale)}px`;
                    labelEl.style.left = '50%';
                    labelEl.style.transform = 'translateX(-50%)';
                    
                    // Glassmorphism Styles
                    labelEl.style.backgroundColor = 'rgba(23, 25, 59, 0.65)'; // Semi-transparent dark blue
                    labelEl.style.backdropFilter = 'blur(4px)'; // Blur effect
                    // @ts-ignore
                    labelEl.style.webkitBackdropFilter = 'blur(4px)';
                    labelEl.style.border = `${1.5 * scale}px solid rgba(99, 102, 241, 0.6)`; // Semi-transparent Indigo border
                    
                    labelEl.style.borderRadius = `${24 * scale}px`;
                    // labelEl.style.padding = `${6 * scale}px ${16 * scale}px`;
                    labelEl.style.padding = `${5 * scale}px ${20 * scale}px ${20 * scale}px`;
                    labelEl.style.display = 'flex';
                    labelEl.style.alignItems = 'center';
                    labelEl.style.justifyContent = 'center'; 
                    labelEl.style.gap = `${12 * scale}px`;
                    labelEl.style.whiteSpace = 'nowrap';
                    labelEl.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'; // Softer shadow
                    labelEl.style.fontFamily = "'Inter', sans-serif";

                    const nameSpan = document.createElement('span');
                    nameSpan.textContent = p.name;
                    nameSpan.style.color = 'white'; // White text for better contrast
                    nameSpan.style.fontWeight = '700';
                    nameSpan.style.fontSize = `${14 * scale}px`;
                    nameSpan.style.letterSpacing = '0.02em';
                    nameSpan.style.textTransform = 'uppercase';
                    nameSpan.style.lineHeight = '1';
                    labelEl.appendChild(nameSpan);

                    const elevSpan = document.createElement('span');
                    elevSpan.textContent = `${p.elevation.toFixed(1)} mdpl`;
                    elevSpan.style.color = '#bfdbfe'; // Light blue text
                    elevSpan.style.fontWeight = '500';
                    elevSpan.style.fontSize = `${14 * scale}px`;
                    elevSpan.style.letterSpacing = '0.02em';
                    elevSpan.style.lineHeight = '1';
                    labelEl.appendChild(elevSpan);

                    markerWrapper.appendChild(labelEl);
                    mapContainer.appendChild(markerWrapper);
                }
            });
        }
        
        // Add Overlay to Map Image
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

            <!-- Bottom Footer -->
            <div style="display: flex; justify-content: space-between; align-items: end;">
                <div style="background: rgba(0,0,0,0.6); padding: ${16 * scale}px; border-radius: ${16 * scale}px; backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.15); display: grid; grid-template-columns: auto auto; gap: ${8 * scale}px ${24 * scale}px; color: white; font-family: 'Inter', monospace; font-size: ${12 * scale}px;">
                    <div style="color: #9ca3af;">Center Point</div>
                    <div style="font-weight: bold;">${toDMS(map.getCenter().lat, true)}, ${toDMS(map.getCenter().lng, false)}</div>
                    
                    <div style="color: #9ca3af;">Avg Elevation</div>
                    <div style="font-weight: bold; color: #fde047;">${(() => {
                        const raw = map.queryTerrainElevation ? map.queryTerrainElevation(map.getCenter()) : 0;
                        const terrain = map.getTerrain();
                        const exaggeration = (terrain && typeof terrain.exaggeration === 'number') ? terrain.exaggeration : 1;
                        return ((raw || 0) / exaggeration).toFixed(1);
                    })()} mdpl</div>
                    
                    <div style="color: #9ca3af;">Heading/Pitch</div>
                    <div style="font-weight: bold;">${map.getBearing().toFixed(1)}° / ${map.getPitch().toFixed(1)}°</div>
                </div>

                <div style="text-align: right; opacity: 0.8;">
                    <p style="color: white; font-family: 'Inter', sans-serif; font-size: ${10 * scale}px; font-weight: 600; margin: 0; text-shadow: 0 2px 4px rgba(0,0,0,0.5);">Generated by Landscape 360</p>
                    <p style="color: rgba(255,255,255,0.6); font-family: 'Inter', sans-serif; font-size: ${9 * scale}px; margin: 0;">In Collaboration with Jendela Cakra Digital & Makopala UBL</p>
                </div>
            </div>
        `;
        mapContainer.appendChild(overlay);

        // Calculate Map Height based on Aspect Ratio
        const mapAspectRatio = canvas.height / canvas.width;
        const mapDisplayWidth = PAGE_WIDTH - (MARGIN * 2);
        const mapDisplayHeight = mapDisplayWidth * mapAspectRatio;

        mapContainer.style.height = `${mapDisplayHeight}px`; 
        mapContainer.style.overflow = 'hidden';
        mapContainer.style.borderRadius = `${16 * scale}px`;
        mapContainer.style.border = `1px solid #374151`;
        
        mapImage.style.width = '100%';
        mapImage.style.height = '100%';
        mapImage.style.objectFit = 'contain'; 
        
        mapSection.appendChild(mapContainer);
        pageContainer.appendChild(mapSection);

        // 3. Table Header & Content
        let currentY = headerHeight + (20 * scale) + mapDisplayHeight + (40 * scale); // Header + Map Section + Padding
        
        // Data Processing
        let cumulativeDist = 0;
        const processedPoints = hasData ? allPoints.map((p, idx) => {
            let dist = 0;
            if (idx > 0) {
                const prev = allPoints[idx - 1];
                const from = point([prev.lng, prev.lat]);
                const to = point([p.lng, p.lat]);
                dist = distance(from, to, { units: 'meters' });
                cumulativeDist += dist;
            }
            return { ...p, dist, totalDist: cumulativeDist };
        }) : [];

        // Create Table Wrapper
        const createTableWrapper = () => {
            const w = document.createElement('div');
            w.style.padding = `0 ${MARGIN}px`;
            w.innerHTML = `
                <div style="display: flex; align-items: center; gap: ${12 * scale}px; margin-bottom: ${16 * scale}px;">
                    <div style="width: ${4 * scale}px; height: ${24 * scale}px; background-color: #3b82f6; border-radius: 4px;"></div>
                    <h2 style="font-size: ${18 * scale}px; font-weight: bold; margin: 0; color: white;">Survey Data Points</h2>
                </div>
                <table style="width: 100%; border-collapse: collapse; font-size: ${12 * scale}px; text-align: left;">
                    <thead>
                        <tr style="background-color: #1f2937; color: #9ca3af; text-transform: uppercase; font-size: ${10 * scale}px; letter-spacing: 0.05em; border-bottom: 2px solid #374151;">
                            <th style="padding: ${10 * scale}px;">#</th>
                            <th style="padding: ${10 * scale}px;">Point Name</th>
                            <th style="padding: ${10 * scale}px;">Coordinates</th>
                            <th style="padding: ${10 * scale}px;">Elevation</th>
                            <th style="padding: ${10 * scale}px;">Dist.</th>
                            <th style="padding: ${10 * scale}px;">Total</th>
                        </tr>
                    </thead>
                    <tbody id="pdf-table-body"></tbody>
                </table>
            `;
            return w;
        };

        let currentTableWrapper = createTableWrapper();
        pageContainer.appendChild(currentTableWrapper);
        addFooter(currentPageNum); // Add footer to first page
        
        let tbody = currentTableWrapper.querySelector('#pdf-table-body')!;
        
        // Render Rows
        if (processedPoints.length === 0) {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid #374151';
            tr.innerHTML = `
                <td colspan="6" style="padding: ${60 * scale}px; text-align: center; color: #9ca3af;">
                    <div style="display: flex; flex-direction: column; align-items: center; gap: ${16 * scale}px; opacity: 0.8;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="${48 * scale}" height="${48 * scale}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: #6b7280;">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="12" y1="8" x2="12" y2="12"/>
                            <line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>
                        <div style="display: flex; flex-direction: column; gap: ${4 * scale}px;">
                            <span style="font-size: ${16 * scale}px; font-weight: 600; letter-spacing: 0.01em; color: white;">No Survey Data Available</span>
                            <span style="font-size: ${13 * scale}px; color: #6b7280;">Start adding points to generate a professional report</span>
                        </div>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
            currentY += 200 * scale;
        } else {
            for (let i = 0; i < processedPoints.length; i++) {
                const p = processedPoints[i];
                
                // Check overflow
                if (currentY + rowHeight > PAGE_HEIGHT - footerHeight - (20 * scale)) {
                    // Capture Current Page
                    pageCanvases.push(await capturePage(pageContainer));
                    currentPageNum++;
                    
                    // Reset Container for New Page
                    pageContainer.innerHTML = renderHeader(false);
                    addFooter(currentPageNum);
                    
                    // New Table Wrapper
                    currentTableWrapper = createTableWrapper();
                    pageContainer.appendChild(currentTableWrapper);
                    tbody = currentTableWrapper.querySelector('#pdf-table-body')!;
                    
                    currentY = headerHeight + (20 * scale) + tableHeaderHeight + (40 * scale); // Reset Y
                }
                
                // Add Row
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid #374151';
                // Show "Point X" in table even if it's default name, unlike map overlay
                const displayName = p.name || `Point ${i + 1}`;
                
                tr.innerHTML = `
                    <td style="padding: ${10 * scale}px; color: #3b82f6; font-weight: bold;">${i + 1}</td>
                    <td style="padding: ${10 * scale}px; font-weight: 500; color: white;">${displayName}</td>
                    <td style="padding: ${10 * scale}px; font-family: monospace; color: #d1d5db; white-space: nowrap;">
                        ${toDMS(p.lat, true)}, ${toDMS(p.lng, false)}
                    </td>
                    <td style="padding: ${10 * scale}px; font-family: monospace; color: #fde047;">${p.elevation.toFixed(1)} m</td>
                    <td style="padding: ${10 * scale}px; font-family: monospace; color: #d1d5db;">${i === 0 ? '-' : p.dist.toFixed(1)} m</td>
                    <td style="padding: ${10 * scale}px; font-family: monospace; color: #9ca3af;">${p.totalDist.toFixed(1)} m</td>
                `;
                tbody.appendChild(tr);
                currentY += rowHeight;
            }
        }

        // 4. Chart Section (Check if fits on last page, else new page)
        const chartHeight = 350 * scale;
        if (currentY + chartHeight > PAGE_HEIGHT - footerHeight - (20 * scale)) {
            pageCanvases.push(await capturePage(pageContainer));
            currentPageNum++;
            
            pageContainer.innerHTML = renderHeader(false);
            addFooter(currentPageNum);
            currentY = headerHeight + (20 * scale);
        }
        
        // Add Chart
        if (hasData) {
            // Generate Chart Data
            const chartWidth = exportWidth - (80 * scale);
            const chartPadding = { top: 40 * scale, right: 40 * scale, bottom: 60 * scale, left: 60 * scale };
            const graphWidth = chartWidth - chartPadding.left - chartPadding.right;
            const graphHeight = chartHeight - chartPadding.top - chartPadding.bottom;

            const maxElev = Math.max(...processedPoints.map(p => p.elevation));
            const minElev = Math.min(...processedPoints.map(p => p.elevation));
            const elevBuffer = (maxElev - minElev) * 0.1 || 5; 
            const yMax = maxElev + elevBuffer;
            const yMin = minElev - elevBuffer;
            const yRange = yMax - yMin || 1;
            const maxDist = cumulativeDist || 1;

            const pointsCoords = processedPoints.map(p => ({
                x: chartPadding.left + (p.totalDist / maxDist) * graphWidth,
                y: chartPadding.top + graphHeight - ((p.elevation - yMin) / yRange) * graphHeight,
                val: p.elevation,
                dist: p.totalDist,
                label: (p.name || '').substring(0, 3)
            }));

            const linePath = pointsCoords.map((p, i) => `${i===0?'M':'L'} ${p.x},${p.y}`).join(' ');
            const areaPath = `${linePath} L ${pointsCoords[pointsCoords.length-1].x},${chartPadding.top + graphHeight} L ${pointsCoords[0].x},${chartPadding.top + graphHeight} Z`;
            const gradientId = `elevGradient-${Date.now()}`;

             const chartContainer = document.createElement('div');
             chartContainer.style.padding = `0 ${MARGIN}px`;
             chartContainer.style.marginTop = `${40 * scale}px`;
             
             chartContainer.innerHTML = `
                <div style="padding: ${32 * scale}px; background: #1f2937; border-radius: ${16 * scale}px; border: 1px solid #374151; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: ${24 * scale}px;">
                         <div style="display: flex; align-items: center; gap: ${12 * scale}px;">
                            <div style="width: ${4 * scale}px; height: ${20 * scale}px; background-color: #fde047; border-radius: 4px;"></div>
                            <h3 style="font-size: ${18 * scale}px; font-weight: bold; color: white; margin: 0;">Elevation Profile Analysis</h3>
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
                             ${[0, 0.2, 0.4, 0.6, 0.8, 1].map(t => {
                                const y = chartPadding.top + (graphHeight * t);
                                const labelValue = yMax - (yRange * t);
                                return `<line x1="${chartPadding.left}" y1="${y}" x2="${chartWidth - chartPadding.right}" y2="${y}" stroke="#374151" stroke-dasharray="4" stroke-width="1" />
                                    <text x="${chartPadding.left - (12 * scale)}" y="${y + (4 * scale)}" text-anchor="end" fill="#6b7280" font-size="${11 * scale}px" font-family="monospace" font-weight="500">${labelValue.toFixed(0)}</text>`;
                             }).join('')}
                            <path d="${areaPath}" fill="url(#${gradientId})" />
                            <path d="${linePath}" fill="none" stroke="#fde047" stroke-width="${3 * scale}" stroke-linejoin="round" stroke-linecap="round" />
                            ${pointsCoords.map((p, i) => `
                                <g>
                                    <line x1="${p.x}" y1="${p.y}" x2="${p.x}" y2="${chartPadding.top + graphHeight}" stroke="#374151" stroke-width="1" stroke-dasharray="2" opacity="0.5" />
                                    <circle cx="${p.x}" cy="${p.y}" r="${5 * scale}" fill="#1f2937" stroke="#fde047" stroke-width="${2 * scale}" />
                                    <rect x="${p.x - (18 * scale)}" y="${p.y - (26 * scale)}" width="${36 * scale}" height="${18 * scale}" rx="${4 * scale}" fill="#fde047" />
                                    <text x="${p.x}" y="${p.y - (14 * scale)}" text-anchor="middle" fill="#000" font-size="${10 * scale}px" font-weight="bold" font-family="monospace">${p.val.toFixed(0)}</text>
                                    <text x="${p.x}" y="${chartPadding.top + graphHeight + (20 * scale)}" text-anchor="middle" fill="#9ca3af" font-size="${11 * scale}px" font-weight="bold" font-family="monospace">${i + 1}</text>
                                </g>
                            `).join('')}
                            <line x1="${chartPadding.left}" y1="${chartPadding.top + graphHeight}" x2="${chartWidth - chartPadding.right}" y2="${chartPadding.top + graphHeight}" stroke="#4b5563" stroke-width="2" />
                        </svg>
                    </div>
                </div>
             `;
             
             pageContainer.appendChild(chartContainer);
        }

        // Capture Final Page
        pageCanvases.push(await capturePage(pageContainer));
        
        // Cleanup
        document.body.removeChild(pageContainer);

        // --- EXPORT BASED ON FORMAT ---
        if (format === 'pdf') {
            const pdf = new jsPDF('p', 'pt', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();

            pageCanvases.forEach((canvas, index) => {
                if (index > 0) pdf.addPage();
                pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pdfWidth, pdfHeight);
            });
            
            if (isMobile) {
                 try {
                     pdf.save(`Landscape360_Report_${Date.now()}.pdf`);
                 } catch (e) {
                     const pdfBlob = pdf.output('blob');
                     const pdfUrl = URL.createObjectURL(pdfBlob);
                     window.open(pdfUrl, '_blank');
                 }
            } else {
                 pdf.save(`Landscape360_Report_${Date.now()}.pdf`);
            }

        } else {
            // PNG / JPG Export Logic (Unified Mobile/Desktop Handler)
            const downloadBlob = (blob: Blob, fileName: string) => {
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = fileName;
                document.body.appendChild(link);
                
                if (isMobile) {
                    // Mobile: Try click, fallback to open in new tab if blocked
                    try {
                        link.click();
                    } catch (e) {
                        window.open(url, '_blank');
                    }
                } else {
                    // Desktop: Standard click
                    link.click();
                }
                
                // Cleanup
                setTimeout(() => {
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                }, 100);
            };

            if (pageCanvases.length === 1) {
                // 1. Single Page -> Standard Download
                const canvas = pageCanvases[0];
                canvas.toBlob((blob) => {
                    if (blob) downloadBlob(blob, `Landscape360_Survey_${Date.now()}.${format}`);
                }, format === 'png' ? 'image/png' : 'image/jpeg', 0.9);
            } else {
                // 2. Multi Page -> ZIP Download
                const zip = new JSZip();
                const folder = zip.folder("Survey_Report_Images");
                
                // Add all pages to zip
                pageCanvases.forEach((canvas, index) => {
                    const dataUrl = canvas.toDataURL(format === 'png' ? 'image/png' : 'image/jpeg', 0.9);
                    const base64Data = dataUrl.split(',')[1];
                    folder?.file(`Page_${index + 1}.${format}`, base64Data, { base64: true });
                });
                
                const content = await zip.generateAsync({ type: "blob" });
                downloadBlob(content, `Landscape360_Report_${Date.now()}.zip`);
            }
        }

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
      <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-white/20 flex flex-col">
        {/* Zoom In */}
        <button
          onClick={handleZoomIn}
          className="p-2.5 hover:bg-gray-100 transition-colors active:bg-gray-200 border-b border-gray-200/50 cursor-pointer group first:rounded-t-xl"
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

        {/* Reset Bearing / Compass Menu */}
        <div className="relative compass-menu-container">
            <button
            onClick={() => setShowCompassMenu(!showCompassMenu)}
            className="p-2.5 hover:bg-gray-100 transition-colors active:bg-gray-200 group cursor-pointer relative w-full last:rounded-b-xl"
            title="Compass Control"
            >
            <div
                className="transition-transform duration-300 ease-out relative flex items-center justify-center"
                style={{ transform: `rotate(${-bearing}deg)` }}
            >
                <Compass
                size={20}
                className={`text-gray-700 group-hover:text-blue-600 transition-colors ${bearing !== 0 ? "text-blue-600" : ""}`}
                style={{ transform: "rotate(-45deg)" }}
                />
                {/* North Indicator "N" */}
                <span className="absolute -top-1 left-1/2 -translate-x-1/2 text-[8px] font-bold text-red-500 bg-white/80 rounded-full px-0.5 leading-none shadow-sm z-10">
                N
                </span>
            </div>
            </button>

            {/* Compass Popover Menu */}
            {showCompassMenu && (
                <div className="absolute top-0 right-12 bg-[#1f2937] border border-gray-700 rounded-xl shadow-2xl p-4 w-[240px] animate-in fade-in slide-in-from-right-4 z-50 text-white">
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">View Settings</span>
                        <button 
                            onClick={() => setShowCompassMenu(false)}
                            className="text-gray-400 hover:text-white transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    {/* Tilt Slider */}
                    <div className="mb-4">
                        <div className="flex justify-between text-xs font-medium mb-1.5">
                            <span>Tilt</span>
                            <span className="text-gray-400">{localPitch.toFixed(0)}°</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="85" // Max pitch usually 85 to prevent under-map view
                            value={localPitch}
                            onChange={handlePitchChange}
                            onMouseDown={() => setIsDraggingSlider(true)}
                            onMouseUp={handleSliderCommit}
                            onTouchStart={() => setIsDraggingSlider(true)}
                            onTouchEnd={handleSliderCommit}
                            className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                    </div>

                    {/* Heading Slider */}
                    <div className="mb-6">
                        <div className="flex justify-between text-xs font-medium mb-1.5">
                            <span>Heading</span>
                            <span className="text-gray-400">{localBearing.toFixed(0)}°</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="360"
                            value={((localBearing % 360) + 360) % 360} // Normalize to 0-360
                            onChange={handleBearingChange}
                            onMouseDown={() => setIsDraggingSlider(true)}
                            onMouseUp={handleSliderCommit}
                            onTouchStart={() => setIsDraggingSlider(true)}
                            onTouchEnd={handleSliderCommit}
                            className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                    </div>

                    {/* Reset Button */}
                    <button
                        onClick={handleResetNorth}
                        className="w-full py-2 text-xs font-bold text-blue-400 hover:text-blue-300 hover:bg-white/5 rounded-lg transition-colors text-right"
                    >
                        Reset to north
                    </button>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};
