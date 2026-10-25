import React, { useState, useEffect } from "react";
import { Plus, Minus, Compass, Crosshair, Camera, Loader2, X } from "lucide-react";
import type { MapRef } from "react-map-gl/mapbox";
import landscapeLogo from "../assets/LandscapeLogo.png";
import { useSurveyStore } from "../store/useSurveyStore";
import { useMapStore } from "../store/useMapStore";
import { useShallow } from "zustand/react/shallow";
import { getAzimuthData, toDMS } from "../utils/surveyUtils";
import { getElevationAtPoint } from "../utils/elevationUtils";
import { getVisibleLocations, useMarkedLocationStore } from "../store/useMarkedLocationStore";
import { CATEGORY_META } from "../utils/markedLocations";
import { requestCompassPermission } from "../lib/deviceHeading";

import { SosButton } from "./SosButton";
interface NavigationControlsProps {
  mapRef: React.RefObject<MapRef | null>;
  onGeolocate: () => void;
  bearing: number;
  pitch: number;
}

// Point names are typed by users; escape them before building the PDF table with innerHTML
const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");


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
  const { setPitch, setBearing } = useMapStore(
    useShallow((s) => ({ setPitch: s.setPitch, setBearing: s.setBearing })),
  );
  
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
        // Dynamically import heavy libraries only when needed
        const [html2canvasModule, jsPDFModule, JSZipModule] = await Promise.all([
            import('html2canvas'),
            import('jspdf'),
            import('jszip')
        ]);
        
        const html2canvasLib = html2canvasModule.default;
        const jsPDFLib = jsPDFModule.default;
        const JSZipLib = JSZipModule.default;

        const map = mapRef.current.getMap();
        const canvas = map.getCanvas();
        
        // Read the map pixels inside the render callback: phones run without
        // preserveDrawingBuffer, so after the frame is shown the canvas reads back empty
        const mapDataUrl = await new Promise<string>((resolve) => {
             map.once('render', () => resolve(canvas.toDataURL('image/jpeg', 0.9)));
             map.triggerRepaint();
        });

        // Facts for the report, read before the page is built
        const center = map.getCenter();
        const centerElevation = await getElevationAtPoint(map, center.lng, center.lat).catch(() => null);
        const mapEl = map.getContainer();
        const viewW = mapEl.clientWidth;
        const viewH = mapEl.clientHeight;
        const exportedAt = new Date();

        // Wait for fonts to load
        await document.fonts.ready;

        // Gather Survey Data: distances are measured like on the map (WGS84 geodesic) and
        // start again at 0 for every survey line
        let profileOffset = 0;
        const processedPoints = groups.flatMap((g) => {
            let total = 0;
            const rows = g.points.map((p, i) => {
                const dist = i > 0 ? getAzimuthData(g.points[i - 1], p).horizontalDistance : 0;
                total += dist;
                return { ...p, dist, totalDist: total, profileDist: profileOffset + total, first: i === 0, groupName: g.name, color: g.color };
            });
            profileOffset += total;
            return rows;
        });
        const allPoints = processedPoints;
        const hasData = allPoints.length > 0;
        const showGroupColumn = groups.filter((g) => g.points.length > 0).length > 1;

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
        
        // 1.25x keeps text sharp when zoomed in while keeping files small (2x made
        // 3200 x 4500 px pages, tens of MB as PNG)
        const captureScale = 1.25;

        // Helper to capture a specific DOM element as a page
        const capturePage = async (pageContent: HTMLElement) => {
            // Ensure no scrollbars
            pageContent.style.overflow = 'hidden';
            
            return await html2canvasLib(pageContent, {
                useCORS: true,
                allowTaint: true,
                scale: captureScale, // High res capture
                backgroundColor: '#ffffff',
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
        pageContainer.style.backgroundColor = '#ffffff';
        pageContainer.style.color = '#1a2214';
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
                    <img src="${landscapeLogo}" style="width: ${40 * scale}px; height: ${40 * scale}px; object-fit: contain;" />
                    <div>
                        <h1 style="color: #1a2214; font-family: 'Inter', sans-serif; font-weight: 800; font-size: ${20 * scale}px; line-height: 1; margin: 0; letter-spacing: -0.02em;">Landscape 360</h1>
                        <p style="color: #365b25; font-family: 'Inter', monospace; font-size: ${10 * scale}px; margin: ${4 * scale}px 0 0 0; letter-spacing: 0.1em; text-transform: uppercase;">${isFirstPage ? 'Professional Survey Report' : 'Survey Report Continuation'}</p>
                    </div>
                </div>
                <div style="text-align: right;">
                    <div style="color: #1a2214; font-family: 'Inter', monospace; font-size: ${12 * scale}px; font-weight: bold;">${exportedAt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                    <div style="color: #7f7965; font-family: 'Inter', monospace; font-size: ${10 * scale}px; margin-top: ${4 * scale}px;">${exportedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
            </div>
            <div style="height: 1px; background: #e7e2d4; margin: 0 ${MARGIN}px;"></div>
        `;

        // Table Constants
        const tableHeaderHeight = 50 * scale;
        const rowHeight = 45 * scale;
        const footerHeight = 60 * scale;
        
        // Footer Render Function
        const renderPageFooter = (pageNum: number) => `
            <div style="position: absolute; bottom: 0; left: 0; width: 100%; height: ${footerHeight}px; padding: 0 ${MARGIN}px; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #e7e2d4; background-color: #ffffff; z-index: 50;">
                <div style="display: flex; gap: ${16 * scale}px; align-items: center;">
                    <span style="color: #7f7965; font-size: ${10 * scale}px;">© ${new Date().getFullYear()} Landscape 360</span>
                    <span style="color: #a9a28b; font-size: ${10 * scale}px;">|</span>
                    <span style="color: #7f7965; font-size: ${10 * scale}px;">Professional Survey Report</span>
                </div>
                <div style="color: #1a2214; font-size: ${10 * scale}px; font-weight: 500; text-align: right;">
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
        mapImage.src = mapDataUrl;
        mapImage.crossOrigin = "anonymous";
        
        await new Promise((resolve) => {
            mapImage.onload = resolve;
            mapImage.onerror = resolve; 
            setTimeout(resolve, 1000);
        });
        
        // Map size on the page. A phone screen is much taller than wide: at full width the
        // map would fill the page and push the info box off it, so it is cropped to at most
        // 55% of the page height (centered). Markers live in mapInner so they stay aligned.
        const mapDisplayWidth = PAGE_WIDTH - (MARGIN * 2);
        const mapDisplayHeight = mapDisplayWidth * (viewH / viewW);
        const mapBoxHeight = Math.min(mapDisplayHeight, PAGE_HEIGHT * 0.55);
        const cropTopPx = ((mapDisplayHeight - mapBoxHeight) / 2) * (viewH / mapDisplayHeight); // in map screen px
        const visibleTop = cropTopPx;
        const visibleBottom = viewH - cropTopPx;
        const inView = (lng: number, lat: number) => {
            const pos = map.project([lng, lat]);
            return pos.x >= 0 && pos.x <= viewW && pos.y >= visibleTop && pos.y <= visibleBottom;
        };
        const markedInView = getVisibleLocations(useMarkedLocationStore.getState())
            .map((v) => v.location)
            .filter((l) => inView(l.lng, l.lat));

        const mapInner = document.createElement('div');
        mapInner.style.position = 'absolute';
        mapInner.style.left = '0';
        mapInner.style.width = '100%';
        mapInner.style.height = `${mapDisplayHeight}px`;
        mapInner.style.top = `${-(mapDisplayHeight - mapBoxHeight) / 2}px`;
        mapInner.appendChild(mapImage);
        mapContainer.appendChild(mapInner);

        // --- Add Survey Points Overlay (Prisma Markers) ---
        if (hasData) {
            const mapContainerEl = map.getContainer();
            const containerWidth = mapContainerEl.clientWidth;
            const containerHeight = mapContainerEl.clientHeight;
            
            allPoints.forEach((p, pointIndex) => {
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
                    markerEl.style.backgroundColor = p.color || '#e46c24';
                    markerEl.style.border = `${2 * scale}px solid white`;
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
                    labelEl.style.backgroundColor = 'rgba(255, 255, 255, 0.92)';
                    labelEl.style.backdropFilter = 'blur(4px)'; // Blur effect
                    // @ts-ignore
                    labelEl.style.webkitBackdropFilter = 'blur(4px)';
                    labelEl.style.border = `${1.5 * scale}px solid #365b25`;
                    
                    labelEl.style.borderRadius = `${24 * scale}px`;
                    // labelEl.style.padding = `${6 * scale}px ${16 * scale}px`;
                    labelEl.style.padding = `${6 * scale}px ${14 * scale}px`;
                    labelEl.style.display = 'flex';
                    labelEl.style.alignItems = 'center';
                    labelEl.style.justifyContent = 'center'; 
                    labelEl.style.gap = `${12 * scale}px`;
                    labelEl.style.whiteSpace = 'nowrap';
                    labelEl.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'; // Softer shadow
                    labelEl.style.fontFamily = "'Inter', sans-serif";

                    const nameSpan = document.createElement('span');
                    // Same number as in the table below, plus the name when it has one
                    nameSpan.textContent = p.name ? `${pointIndex + 1}. ${p.name}` : `${pointIndex + 1}`;
                    nameSpan.style.color = '#1a2214';
                    nameSpan.style.fontWeight = '700';
                    nameSpan.style.fontSize = `${14 * scale}px`;
                    nameSpan.style.letterSpacing = '0.02em';
                    nameSpan.style.textTransform = 'uppercase';
                    nameSpan.style.lineHeight = '1';
                    labelEl.appendChild(nameSpan);

                    const elevSpan = document.createElement('span');
                    elevSpan.textContent = `${p.elevation.toFixed(1)} mdpl`;
                    elevSpan.style.color = '#365b25';
                    elevSpan.style.fontWeight = '500';
                    elevSpan.style.fontSize = `${14 * scale}px`;
                    elevSpan.style.letterSpacing = '0.02em';
                    elevSpan.style.lineHeight = '1';
                    labelEl.appendChild(elevSpan);

                    markerWrapper.appendChild(labelEl);
                    mapInner.appendChild(markerWrapper);
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
               
            </div>

            <!-- Bottom Footer -->
            <div style="display: flex; justify-content: space-between; align-items: end;">
                <div style="background: rgba(255,255,255,0.92); padding: ${16 * scale}px; border-radius: ${16 * scale}px; backdrop-filter: blur(10px); border: 1px solid #e7e2d4; display: grid; grid-template-columns: auto auto; gap: ${8 * scale}px ${24 * scale}px; color: #1a2214; font-family: 'Inter', monospace; font-size: ${12 * scale}px;">
                    <div style="color: #7f7965;">Map Center</div>
                    <div style="font-weight: bold;">${toDMS(center.lat, true)}, ${toDMS(center.lng, false)}<br/><span style="font-weight: normal; color: #7f7965;">${center.lat.toFixed(6)}, ${center.lng.toFixed(6)}</span></div>
                    
                    <div style="color: #7f7965;">Center Elevation</div>
                    <div style="font-weight: bold; color: #8a5e14;">${centerElevation ? `${centerElevation.toFixed(0)} mdpl` : '—'}</div>
                    
                    <div style="color: #7f7965;">Heading / Tilt</div>
                    <div style="font-weight: bold;">${(((map.getBearing() % 360) + 360) % 360).toFixed(1)}° / ${map.getPitch().toFixed(1)}°</div>

                    <div style="color: #7f7965;">Zoom</div>
                    <div style="font-weight: bold;">${map.getZoom().toFixed(1)}</div>
                </div>

                <div style="text-align: right; opacity: 0.8;">
                    <p style="color: white; font-family: 'Inter', sans-serif; font-size: ${10 * scale}px; font-weight: 600; margin: 0; text-shadow: 0 2px 4px rgba(0,0,0,0.5);">Generated by Landscape 360</p>
                    <p style="color: rgba(255,255,255,0.6); font-family: 'Inter', sans-serif; font-size: ${9 * scale}px; margin: 0;">Powered by Jendela Cakra Digital & Makopala UBL</p>
                </div>
            </div>
        `;
        mapContainer.appendChild(overlay);

        mapContainer.style.height = `${mapBoxHeight}px`;
        mapContainer.style.overflow = 'hidden';
        mapContainer.style.borderRadius = `${16 * scale}px`;
        mapContainer.style.border = `1px solid #e7e2d4`;
        
        mapImage.style.width = '100%';
        mapImage.style.height = '100%';
        mapImage.style.display = 'block';
        
        mapSection.appendChild(mapContainer);
        pageContainer.appendChild(mapSection);

        // 3. Table Header & Content
        let currentY = headerHeight + (20 * scale) + mapBoxHeight + (40 * scale); // Header + Map Section + Padding
        
        // Create Table Wrapper
        const createTableWrapper = () => {
            const w = document.createElement('div');
            w.style.padding = `0 ${MARGIN}px`;
            w.innerHTML = `
                <div style="display: flex; align-items: center; gap: ${12 * scale}px; margin-bottom: ${16 * scale}px;">
                    <div style="width: ${4 * scale}px; height: ${24 * scale}px; background-color: #e9b640; border-radius: 4px;"></div>
                    <h2 style="font-size: ${18 * scale}px; font-weight: bold; margin: 0; color: #1a2214;">Survey Data Points</h2>
                </div>
                <table style="width: 100%; border-collapse: collapse; font-size: ${12 * scale}px; text-align: left;">
                    <thead>
                        <tr style="background-color: #f3f0e7; color: #5e5a4a; text-transform: uppercase; font-size: ${10 * scale}px; letter-spacing: 0.05em; border-bottom: 2px solid #d3ccb8;">
                            <th style="padding: ${10 * scale}px;">#</th>
                            ${showGroupColumn ? `<th style="padding: ${10 * scale}px;">Line</th>` : ''}
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
            tr.style.borderBottom = '1px solid #e7e2d4';
            tr.innerHTML = `
                <td colspan="${showGroupColumn ? 7 : 6}" style="padding: ${60 * scale}px; text-align: center; color: #7f7965;">
                    <div style="display: flex; flex-direction: column; align-items: center; gap: ${16 * scale}px; opacity: 0.8;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="${48 * scale}" height="${48 * scale}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: #a9a28b;">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="12" y1="8" x2="12" y2="12"/>
                            <line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>
                        <div style="display: flex; flex-direction: column; gap: ${4 * scale}px;">
                            <span style="font-size: ${16 * scale}px; font-weight: 600; letter-spacing: 0.01em; color: #1a2214;">No Survey Data Available</span>
                            <span style="font-size: ${13 * scale}px; color: #7f7965;">Start adding points to generate a professional report</span>
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
                tr.style.borderBottom = '1px solid #e7e2d4';
                // Show "Point X" in table even if it's default name, unlike map overlay
                const displayName = escapeHtml(p.name || `Point ${i + 1}`);
                
                tr.innerHTML = `
                    <td style="padding: ${10 * scale}px; color: #b07b17; font-weight: bold;">${i + 1}</td>
                    ${showGroupColumn ? `<td style="padding: ${10 * scale}px; color: #45423a; white-space: nowrap;"><span style="display: inline-block; width: ${8 * scale}px; height: ${8 * scale}px; border-radius: 50%; background: ${p.color}; margin-right: ${6 * scale}px;"></span>${escapeHtml(p.groupName)}</td>` : ''}
                    <td style="padding: ${10 * scale}px; font-weight: 500; color: #1a2214;">${displayName}</td>
                    <td style="padding: ${10 * scale}px; font-family: monospace; color: #45423a; white-space: nowrap;">
                        ${toDMS(p.lat, true)}, ${toDMS(p.lng, false)}
                    </td>
                    <td style="padding: ${10 * scale}px; font-family: monospace; color: #8a5e14;">${p.elevation.toFixed(1)} m</td>
                    <td style="padding: ${10 * scale}px; font-family: monospace; color: #45423a;">${p.first ? '-' : `${p.dist.toFixed(1)} m`}</td>
                    <td style="padding: ${10 * scale}px; font-family: monospace; color: #7f7965;">${p.totalDist.toFixed(1)} m</td>
                `;
                tbody.appendChild(tr);
                currentY += rowHeight;
            }
        }

        // 4. Chart Section (Check if fits on last page, else new page)
        const chartHeight = 350 * scale;
        // The whole block: title, stats cards, plot and paddings (not just the plot)
        const chartBlockHeight = chartHeight + 330 * scale;
        if (hasData && currentY + chartBlockHeight > PAGE_HEIGHT - footerHeight - (20 * scale)) {
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
            // Increased padding for professional axis labels
            const chartPadding = { top: 60 * scale, right: 60 * scale, bottom: 80 * scale, left: 100 * scale };
            const graphWidth = chartWidth - chartPadding.left - chartPadding.right;
            const graphHeight = chartHeight - chartPadding.top - chartPadding.bottom;

            const elevations = processedPoints.map(p => p.elevation);
            const maxElev = Math.max(...elevations);
            const minElev = Math.min(...elevations);
            // Sum of every survey line (lines are not joined to each other)
            const totalDist = profileOffset;
            
            // Calculate Elevation Gain
            let gain = 0;
            for(let i=1; i<processedPoints.length; i++) {
                if (processedPoints[i].first) continue; // a new line starts: no climb between lines
                const diff = processedPoints[i].elevation - processedPoints[i-1].elevation;
                if(diff > 0) gain += diff;
            }

            const elevBuffer = (maxElev - minElev) * 0.1 || 5; 
            const yMax = maxElev + elevBuffer;
            const yMin = minElev - elevBuffer;
            const yRange = yMax - yMin || 1;
            
            const pointsCoords = processedPoints.map((p, i) => ({
                x: chartPadding.left + (p.profileDist / (totalDist || 1)) * graphWidth,
                y: chartPadding.top + graphHeight - ((p.elevation - yMin) / yRange) * graphHeight,
                val: p.elevation,
                dist: p.profileDist,
                label: `${i + 1}`
            }));

            // One segment per survey line: lines are separate, so they are not joined
            const baseY = chartPadding.top + graphHeight;
            const segments: (typeof pointsCoords)[] = [];
            pointsCoords.forEach((c, i) => {
                if (processedPoints[i].first || segments.length === 0) segments.push([]);
                segments[segments.length - 1].push(c);
            });
            const linePath = segments
                .map((seg) => seg.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x},${c.y}`).join(' '))
                .join(' ');
            const areaPath = segments
                .filter((seg) => seg.length > 1)
                .map((seg) => `${seg.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x},${c.y}`).join(' ')} L ${seg[seg.length - 1].x},${baseY} L ${seg[0].x},${baseY} Z`)
                .join(' ');
            const gradientId = `elevGradient-${Date.now()}`;

             const chartContainer = document.createElement('div');
             chartContainer.style.padding = `0 ${MARGIN}px`;
             chartContainer.style.marginTop = `${40 * scale}px`;
             
             // Professional Stats Header
             const statsHtml = `
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: ${16 * scale}px; margin-bottom: ${32 * scale}px;">
                    <div style="background: #faf8f3; border: 1px solid #e7e2d4; padding: ${20 * scale}px; border-radius: ${12 * scale}px;">
                        <div style="color: #7f7965; font-size: ${12 * scale}px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: ${8 * scale}px; font-weight: 600;">Min Elevation</div>
                        <div style="color: #1a2214; font-size: ${24 * scale}px; font-weight: 800; font-family: monospace;">${minElev.toFixed(1)} <span style="font-size: ${14 * scale}px; color: #a9a28b; font-weight: 600;">m</span></div>
                    </div>
                    <div style="background: #faf8f3; border: 1px solid #e7e2d4; padding: ${20 * scale}px; border-radius: ${12 * scale}px;">
                        <div style="color: #7f7965; font-size: ${12 * scale}px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: ${8 * scale}px; font-weight: 600;">Max Elevation</div>
                        <div style="color: #1a2214; font-size: ${24 * scale}px; font-weight: 800; font-family: monospace;">${maxElev.toFixed(1)} <span style="font-size: ${14 * scale}px; color: #a9a28b; font-weight: 600;">m</span></div>
                    </div>
                    <div style="background: #faf8f3; border: 1px solid #e7e2d4; padding: ${20 * scale}px; border-radius: ${12 * scale}px;">
                        <div style="color: #7f7965; font-size: ${12 * scale}px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: ${8 * scale}px; font-weight: 600;">Total Distance</div>
                        <div style="color: #1a2214; font-size: ${24 * scale}px; font-weight: 800; font-family: monospace;">${totalDist >= 1000 ? (totalDist / 1000).toFixed(2) : totalDist.toFixed(1)} <span style="font-size: ${14 * scale}px; color: #a9a28b; font-weight: 600;">${totalDist >= 1000 ? 'km' : 'm'}</span></div>
                    </div>
                     <div style="background: #faf8f3; border: 1px solid #e7e2d4; padding: ${20 * scale}px; border-radius: ${12 * scale}px;">
                        <div style="color: #7f7965; font-size: ${12 * scale}px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: ${8 * scale}px; font-weight: 600;">Elev. Gain</div>
                        <div style="color: #365b25; font-size: ${24 * scale}px; font-weight: 800; font-family: monospace;">+${gain.toFixed(1)} <span style="font-size: ${14 * scale}px; color: #a9a28b; font-weight: 600;">m</span></div>
                    </div>
                </div>
             `;

             chartContainer.innerHTML = `
                <div style="padding: ${40 * scale}px; background: #ffffff; border-radius: ${24 * scale}px; border: 1px solid #e7e2d4; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: ${32 * scale}px;">
                         <div style="display: flex; align-items: center; gap: ${16 * scale}px;">
                            <div style="width: ${6 * scale}px; height: ${32 * scale}px; background-color: #365b25; border-radius: 4px;"></div>
                            <div>
                                <h3 style="font-size: ${24 * scale}px; font-weight: 800; color: #1a2214; margin: 0; letter-spacing: -0.02em; line-height: 1.2;">Elevation Profile Analysis</h3>
                                <p style="font-size: ${12 * scale}px; color: #7f7965; margin: 0; font-weight: 500;">Terrain cross-section and gradient analysis</p>
                            </div>
                         </div>
                    </div>
                    
                    ${statsHtml}

                    <div style="position: relative; width: 100%; height: ${chartHeight}px; border: 1px solid #e7e2d4; border-radius: ${16 * scale}px; padding: ${20 * scale}px; background: #faf8f3;">
                        <svg width="100%" height="100%" viewBox="0 0 ${chartWidth} ${chartHeight}" preserveAspectRatio="none" style="overflow: visible;">
                             <defs>
                                <linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stop-color="#365b25" stop-opacity="0.22"/>
                                    <stop offset="100%" stop-color="#365b25" stop-opacity="0.0"/>
                                </linearGradient>
                             </defs>
                             
                             <!-- Grid Lines (Y-Axis) -->
                             ${[0, 0.25, 0.5, 0.75, 1].map(t => {
                                const y = chartPadding.top + (graphHeight * t);
                                const labelValue = yMax - (yRange * t);
                                return `
                                    <line x1="${chartPadding.left}" y1="${y}" x2="${chartWidth - chartPadding.right}" y2="${y}" stroke="#d3ccb8" stroke-dasharray="4" stroke-width="1" opacity="0.8" />
                                    <text x="${chartPadding.left - (16 * scale)}" y="${y + (4 * scale)}" text-anchor="end" fill="#7f7965" font-size="${11 * scale}px" font-family="monospace" font-weight="500">${labelValue.toFixed(0)}</text>
                                `;
                             }).join('')}

                             <!-- Y-Axis Label -->
                             <text x="${30 * scale}" y="${chartHeight / 2}" transform="rotate(-90, ${30 * scale}, ${chartHeight / 2})" text-anchor="middle" fill="#7f7965" font-size="${12 * scale}px" font-weight="bold" font-family="'Inter', sans-serif" letter-spacing="0.1em">ELEVATION (m)</text>

                             <!-- Chart Area -->
                            <path d="${areaPath}" fill="url(#${gradientId})" />
                            <path d="${linePath}" fill="none" stroke="#284a1b" stroke-width="${3 * scale}" stroke-linejoin="round" stroke-linecap="round" />
                            
                            <!-- Data Points -->
                            ${pointsCoords.map((p) => `
                                <g>
                                    <line x1="${p.x}" y1="${p.y}" x2="${p.x}" y2="${chartPadding.top + graphHeight}" stroke="#d3ccb8" stroke-width="1" stroke-dasharray="2" opacity="0.7" />
                                    <circle cx="${p.x}" cy="${p.y}" r="${4 * scale}" fill="#ffffff" stroke="#284a1b" stroke-width="${2 * scale}" />
                                    
                                    <!-- Point Label Group (Staggered or simplified based on density) -->
                                    <g transform="translate(${p.x}, ${p.y - (12 * scale)})">
                                        <!-- Only show every Nth label if too dense, or use smarter logic. For now, we keep all but ensure clean rendering -->
                                        <rect x="${-(18 * scale)}" y="${-(22 * scale)}" width="${36 * scale}" height="${18 * scale}" rx="${4 * scale}" fill="#f2cc6c" stroke="#ffffff" stroke-width="1" />
                                        <text x="0" y="${-(10 * scale)}" text-anchor="middle" fill="#1a2214" font-size="${10 * scale}px" font-weight="bold" font-family="monospace">${p.val.toFixed(0)}</text>
                                    </g>
                                    
                                    <!-- Point Name Label (Only Numbers) -->
                                    <text x="${p.x}" y="${chartPadding.top + graphHeight + (20 * scale)}" text-anchor="middle" fill="#7f7965" font-size="${11 * scale}px" font-weight="600" font-family="monospace">${p.label}</text>
                                </g>
                            `).join('')}

                            <!-- Axes Lines -->
                            <line x1="${chartPadding.left}" y1="${chartPadding.top + graphHeight}" x2="${chartWidth - chartPadding.right}" y2="${chartPadding.top + graphHeight}" stroke="#a9a28b" stroke-width="2" />
                            <line x1="${chartPadding.left}" y1="${chartPadding.top}" x2="${chartPadding.left}" y2="${chartPadding.top + graphHeight}" stroke="#a9a28b" stroke-width="2" />
                        </svg>
                    </div>
                </div>
             `;
             
             pageContainer.appendChild(chartContainer);
             currentY += chartBlockHeight;
        }

        // 5. Marked Locations visible on the exported map
        if (markedInView.length > 0) {
            const markedTitle = (cont: boolean) => `
                <div style="display: flex; align-items: center; gap: ${12 * scale}px; margin: ${32 * scale}px 0 ${16 * scale}px;">
                    <div style="width: ${4 * scale}px; height: ${24 * scale}px; background-color: #d49b22; border-radius: 4px;"></div>
                    <h2 style="font-size: ${18 * scale}px; font-weight: bold; margin: 0; color: #1a2214;">Marked Locations in View${cont ? ' (continued)' : ''}</h2>
                </div>
                <table style="width: 100%; border-collapse: collapse; font-size: ${12 * scale}px; text-align: left;">
                    <thead>
                        <tr style="background-color: #f3f0e7; color: #5e5a4a; text-transform: uppercase; font-size: ${10 * scale}px; letter-spacing: 0.05em; border-bottom: 2px solid #d3ccb8;">
                            <th style="padding: ${10 * scale}px;">#</th>
                            <th style="padding: ${10 * scale}px;">Name</th>
                            <th style="padding: ${10 * scale}px;">Category</th>
                            <th style="padding: ${10 * scale}px;">Coordinates</th>
                            <th style="padding: ${10 * scale}px;">Elevation</th>
                        </tr>
                    </thead>
                    <tbody class="marked-body"></tbody>
                </table>`;
            const startMarkedTable = (cont: boolean) => {
                const w = document.createElement('div');
                w.style.padding = `0 ${MARGIN}px`;
                w.innerHTML = markedTitle(cont);
                pageContainer.appendChild(w);
                currentY += (72 + 50) * scale;
                return w.querySelector('.marked-body')!;
            };
            const roomLeft = () => PAGE_HEIGHT - footerHeight - (20 * scale) - currentY;

            if (roomLeft() < (72 + 50) * scale + rowHeight) {
                pageCanvases.push(await capturePage(pageContainer));
                currentPageNum++;
                pageContainer.innerHTML = renderHeader(false);
                addFooter(currentPageNum);
                currentY = headerHeight + (20 * scale);
            }
            let markedBody = startMarkedTable(false);
            for (let i = 0; i < markedInView.length; i++) {
                if (roomLeft() < rowHeight) {
                    pageCanvases.push(await capturePage(pageContainer));
                    currentPageNum++;
                    pageContainer.innerHTML = renderHeader(false);
                    addFooter(currentPageNum);
                    currentY = headerHeight + (20 * scale);
                    markedBody = startMarkedTable(true);
                }
                const l = markedInView[i];
                const meta = CATEGORY_META[l.category];
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid #e7e2d4';
                tr.innerHTML = `
                    <td style="padding: ${10 * scale}px; color: #b07b17; font-weight: bold;">${i + 1}</td>
                    <td style="padding: ${10 * scale}px; font-weight: 500; color: #1a2214;">${escapeHtml(l.name)}</td>
                    <td style="padding: ${10 * scale}px; color: #45423a; white-space: nowrap;"><span style="display: inline-block; width: ${8 * scale}px; height: ${8 * scale}px; border-radius: 50%; background: ${meta?.color ?? '#d49b22'}; margin-right: ${6 * scale}px;"></span>${escapeHtml(meta?.label ?? l.category)}</td>
                    <td style="padding: ${10 * scale}px; font-family: monospace; color: #45423a; white-space: nowrap;">${toDMS(l.lat, true)}, ${toDMS(l.lng, false)}</td>
                    <td style="padding: ${10 * scale}px; font-family: monospace; color: #8a5e14;">${l.elevationM != null ? `${Math.round(l.elevationM)} m` : '—'}</td>
                `;
                markedBody.appendChild(tr);
                currentY += rowHeight;
            }
        }

        // Capture Final Page
        pageCanvases.push(await capturePage(pageContainer));
        
        // Cleanup
        document.body.removeChild(pageContainer);

        // --- EXPORT BASED ON FORMAT ---
        if (format === 'pdf') {
            const pdf = new jsPDFLib({ orientation: 'p', unit: 'pt', format: 'a4', compress: true });
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();

            pageCanvases.forEach((canvas, index) => {
                if (index > 0) pdf.addPage();
                pdf.addImage(canvas.toDataURL('image/jpeg', 0.82), 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
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
                }, format === 'png' ? 'image/png' : 'image/jpeg', 0.85);
            } else {
                // 2. Multi Page -> ZIP Download
                const zip = new JSZipLib();
                const folder = zip.folder("Survey_Report_Images");
                
                // Add all pages to zip
                pageCanvases.forEach((canvas, index) => {
                    const dataUrl = canvas.toDataURL(format === 'png' ? 'image/png' : 'image/jpeg', 0.85);
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
            className="bg-white/90 backdrop-blur-sm p-2.5 rounded-xl shadow-lg border border-white/20 hover:bg-white hover:text-forest-800 transition-all active:scale-95 group cursor-pointer"
            title="Take Screenshot / Export"
        >
            {isCapturing ? <Loader2 size={20} className="animate-spin text-forest-800" /> : <Camera size={20} className="text-sand-700 group-hover:text-forest-800 transition-colors" />}
        </button>

        {/* Dropdown Menu */}
        {showExportMenu && (
            <div className="absolute top-0 right-14 bg-white/95 backdrop-blur-xl border border-white/20 rounded-xl shadow-2xl p-2 flex flex-col gap-1 min-w-[140px] animate-in fade-in slide-in-from-right-4 z-30">
                <div className="text-[10px] font-bold text-sand-400 px-2 py-1 uppercase tracking-wider">Export As</div>
                <button 
                    onClick={() => handleCapture('png')}
                    className="cursor-pointer flex items-center justify-between px-3 py-2 text-xs font-medium text-sand-700 hover:bg-forest-50 hover:text-forest-800 rounded-lg transition-colors text-left"
                >
                    <span>High-Res PNG</span>
                    <span className="text-[9px] bg-forest-100 text-forest-800 px-1.5 py-0.5 rounded">HD</span>
                </button>
                <button 
                    onClick={() => handleCapture('jpg')}
                    className="cursor-pointer flex items-center justify-between px-3 py-2 text-xs font-medium text-sand-700 hover:bg-forest-50 hover:text-forest-800 rounded-lg transition-colors text-left"
                >
                    <span>Compact JPG</span>
                    <span className="text-[9px] bg-sand-100 text-sand-500 px-1.5 py-0.5 rounded">Light</span>
                </button>
                <div className="h-px bg-sand-200 my-0.5"></div>
                <button 
                    onClick={() => handleCapture('pdf')}
                    className="cursor-pointer flex items-center justify-between px-3 py-2 text-xs font-medium text-sand-700 hover:bg-brick-50 hover:text-brick-600 rounded-lg transition-colors text-left"
                >
                    <span>Report PDF</span>
                    <span className="text-[9px] bg-brick-100 text-brick-600 px-1.5 py-0.5 rounded">Doc</span>
                </button>
            </div>
        )}
      </div>

      {/* Find My Location Button */}
      <button
        onClick={() => {
          // iPhone / iPad only share the compass after a tap; this is that tap
          requestCompassPermission();
          onGeolocate();
        }}
        className="bg-white/90 backdrop-blur-sm p-2.5 rounded-xl shadow-lg border border-white/20 hover:bg-white hover:text-forest-800 transition-all active:scale-95 group cursor-pointer"
        title="Find My Location"
      >
        <Crosshair
          size={20}
          className="text-sand-700 group-hover:text-forest-800 transition-colors"
        />
      </button>

      {/* Navigation Stack */}
      <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-white/20 flex flex-col">
        {/* Zoom In */}
        <button
          onClick={handleZoomIn}
          className="p-2.5 hover:bg-sand-100 transition-colors active:bg-sand-200 border-b border-sand-200/50 cursor-pointer group first:rounded-t-xl"
          title="Zoom In"
        >
          <Plus size={20} className="text-sand-700 group-hover:text-ink transition-colors" />
        </button>

        {/* Zoom Out */}
        <button
          onClick={handleZoomOut}
          className="p-2.5 hover:bg-sand-100 transition-colors active:bg-sand-200 border-b border-sand-200/50 cursor-pointer group"
          title="Zoom Out"
        >
          <Minus size={20} className="text-sand-700 group-hover:text-ink transition-colors" />
        </button>

        {/* Reset Bearing / Compass Menu */}
        <div className="relative compass-menu-container">
            <button
            onClick={() => setShowCompassMenu(!showCompassMenu)}
            className="p-2.5 hover:bg-sand-100 transition-colors active:bg-sand-200 group cursor-pointer relative w-full last:rounded-b-xl"
            title="Compass Control"
            >
            <div
                className="transition-transform duration-300 ease-out relative flex items-center justify-center"
                style={{ transform: `rotate(${-bearing}deg)` }}
            >
                <Compass
                size={20}
                className={`text-sand-700 group-hover:text-forest-800 transition-colors ${bearing !== 0 ? "text-forest-800" : ""}`}
                style={{ transform: "rotate(-45deg)" }}
                />
                {/* North Indicator "N" */}
                <span className="absolute -top-1 left-1/2 -translate-x-1/2 text-[8px] font-bold text-brick-500 bg-white/80 rounded-full px-0.5 leading-none shadow-sm z-10">
                N
                </span>
            </div>
            </button>

            {/* Compass Popover Menu */}
            {showCompassMenu && (
                <div className="absolute top-0 right-12 bg-white border border-sand-200 rounded-xl shadow-2xl shadow-sand-900/10 p-4 w-[240px] animate-in fade-in slide-in-from-right-4 z-50 text-ink">
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-xs font-bold text-sand-500 uppercase tracking-wider">View Settings</span>
                        <button 
                            onClick={() => setShowCompassMenu(false)}
                            className="cursor-pointer p-1 -m-1 rounded-md text-sand-500 hover:text-ink hover:bg-sand-100 transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    {/* Tilt Slider */}
                    <div className="mb-4">
                        <div className="flex justify-between text-xs font-medium mb-1.5">
                            <span className="text-ink">Tilt</span>
                            <span className="font-mono text-forest-800">{localPitch.toFixed(0)}°</span>
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
                            className="w-full h-1 bg-sand-200 rounded-lg appearance-none cursor-pointer accent-forest-700"
                        />
                    </div>

                    {/* Heading Slider */}
                    <div className="mb-6">
                        <div className="flex justify-between text-xs font-medium mb-1.5">
                            <span className="text-ink">Heading</span>
                            <span className="font-mono text-forest-800">{localBearing.toFixed(0)}°</span>
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
                            className="w-full h-1 bg-sand-200 rounded-lg appearance-none cursor-pointer accent-forest-700"
                        />
                    </div>

                    {/* Reset Button */}
                    <button
                        onClick={handleResetNorth}
                        className="cursor-pointer w-full py-2 flex items-center justify-center text-xs font-bold text-forest-800 bg-forest-50 border border-forest-200 hover:bg-forest-100 rounded-lg transition-colors"
                    >
                        Reset to north
                    </button>
                </div>
            )}
        </div>
      </div>
      {/* S.O.S, for accounts the admin allowed (renders nothing otherwise) */}
      <SosButton />
    </div>
  );
};
