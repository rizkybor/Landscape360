import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Source, Layer, Marker, Popup, useMap } from 'react-map-gl/mapbox';
import type { FeatureCollection, Point } from 'geojson';
import type { Map as MapboxMap, MapMouseEvent } from 'mapbox-gl';
import { Check, ChevronDown, ChevronUp, Copy, MapPin, Navigation, PanelRightOpen } from 'lucide-react';
import { getVisibleLocations, useMarkedLocationStore, type VisibleLocation } from '../store/useMarkedLocationStore';
import { CATEGORY_META, directionsUrl, formatLatLng } from '../utils/markedLocations';
import { CATEGORY_ICONS } from '../utils/markedLocationIcons';
import { getElevationAtPoint } from '../utils/elevationUtils';
import { toDMS } from '../utils/surveyUtils';
import type { MarkedLocationCategory } from '../types/markedLocation';

const POINTS_LAYER = 'marked-locations-points';

// Ring around the marker: white = mine, gold = shared with me, grey = other accounts (admin)
const RING: Record<VisibleLocation['kind'], string> = { mine: '#ffffff', shared: '#e9b640', other: '#9ca3af' };
const MARKER_PX = 30;
const imageId = (category: string, kind: string) => `marked-${category}-${kind}`;

// Marker images: the category's own icon (the one picked in the form) in white on its
// colour, drawn once from the lucide icon and kept for later style changes
const markerImages = new Map<string, Promise<HTMLImageElement>>();
const iconSvg = (category: MarkedLocationCategory) => {
  const Icon = CATEGORY_ICONS[category] ?? MapPin;
  const host = document.createElement('div');
  const root = createRoot(host);
  flushSync(() => root.render(<Icon size={16} color="#ffffff" strokeWidth={2.5} x={7} y={7} />));
  const svg = host.innerHTML;
  root.unmount();
  return svg;
};
const loadMarkerImage = (category: MarkedLocationCategory, kind: VisibleLocation['kind']) => {
  const id = imageId(category, kind);
  let image = markerImages.get(id);
  if (!image) {
    const color = CATEGORY_META[category]?.color ?? CATEGORY_META.poi.color;
    // Built after the current React work (flushSync is not allowed inside an effect)
    image = Promise.resolve().then(() => new Promise<HTMLImageElement>((resolve, reject) => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${MARKER_PX * 2}" height="${MARKER_PX * 2}" viewBox="0 0 30 30"><circle cx="15" cy="15" r="13" fill="${color}" stroke="${RING[kind]}" stroke-width="${kind === 'mine' ? 2 : 2.5}"/>${iconSvg(category)}</svg>`;
      const img = new Image(MARKER_PX * 2, MARKER_PX * 2);
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    }));
    markerImages.set(id, image);
  }
  return image;
};
// Rounded white "pill" behind the name above each marker; stretches to fit the text
const LABEL_BG = 'marked-label-bg';
const addLabelBackground = (map: MapboxMap) => {
  if (map.hasImage(LABEL_BG)) return;
  const size = 48; // 24 px at pixelRatio 2
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#e7e2d4';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(1, 1, size - 2, size - 2, 16);
  ctx.fill();
  ctx.stroke();
  map.addImage(LABEL_BG, ctx.getImageData(0, 0, size, size), {
    pixelRatio: 2,
    stretchX: [[18, 30]],
    stretchY: [[18, 30]],
    content: [12, 8, 36, 40],
  });
};

const addMarkerImages = (map: MapboxMap) => {
  addLabelBackground(map);
  for (const category of Object.keys(CATEGORY_META) as MarkedLocationCategory[]) {
    for (const kind of Object.keys(RING) as VisibleLocation['kind'][]) {
      const id = imageId(category, kind);
      loadMarkerImage(category, kind)
        .then((img) => {
          if (!map.hasImage(id)) map.addImage(id, img, { pixelRatio: 2 });
        })
        .catch(() => undefined);
    }
  }
};

// Map rendering for Marked Locations: saved places (mine, shared with me, and for admins
// every account's), the details popup, and picking a position by clicking the map.
export const MarkedLocationLayer = () => {
  const { current: mapRef } = useMap();
  const locations = useMarkedLocationStore((s) => s.locations);
  const sharedLocations = useMarkedLocationStore((s) => s.sharedLocations);
  const adminLocations = useMarkedLocationStore((s) => s.adminLocations);
  const showAllOnMap = useMarkedLocationStore((s) => s.showAllOnMap);
  const selectedId = useMarkedLocationStore((s) => s.selectedId);
  const select = useMarkedLocationStore((s) => s.select);
  const isPicking = useMarkedLocationStore((s) => s.isPicking);
  const pickedPoint = useMarkedLocationStore((s) => s.pickedPoint);
  const setPickedPoint = useMarkedLocationStore((s) => s.setPickedPoint);
  const setPanelOpen = useMarkedLocationStore((s) => s.setPanelOpen);
  const [copied, setCopied] = useState(false);
  // Phones: the popup starts small (name + buttons) so it does not cover the map
  const [showDetails, setShowDetails] = useState(() => !window.matchMedia?.('(max-width: 767px)').matches);

  const visible = useMemo(
    () => getVisibleLocations({ locations, sharedLocations, adminLocations, showAllOnMap }),
    [locations, sharedLocations, adminLocations, showAllOnMap],
  );

  const geojson = useMemo<FeatureCollection<Point>>(
    () => ({
      type: 'FeatureCollection',
      features: visible.map(({ location, kind }) => ({
        type: 'Feature',
        properties: { id: location.id, name: location.name, icon: imageId(location.category, kind) },
        geometry: { type: 'Point', coordinates: [location.lng, location.lat] },
      })),
    }),
    [visible],
  );

  const selected = visible.find((v) => v.location.id === selectedId) ?? null;

  // Category icons for the markers; added again when the basemap style changes
  useEffect(() => {
    const map = mapRef?.getMap();
    if (!map) return;
    const add = () => addMarkerImages(map);
    add();
    map.on('style.load', add);
    return () => {
      map.off('style.load', add);
    };
  }, [mapRef]);

  // Click a marker to open its details, click it again to close them; pointer cursor on hover
  useEffect(() => {
    const map = mapRef?.getMap();
    if (!map || isPicking) return;
    const onClick = (e: MapMouseEvent) => {
      const id = e.features?.[0]?.properties?.id;
      if (!id) return;
      select(useMarkedLocationStore.getState().selectedId === String(id) ? null : String(id));
    };
    const onEnter = () => (map.getCanvas().style.cursor = 'pointer');
    const onLeave = () => (map.getCanvas().style.cursor = '');
    map.on('click', POINTS_LAYER, onClick);
    map.on('mouseenter', POINTS_LAYER, onEnter);
    map.on('mouseleave', POINTS_LAYER, onLeave);
    return () => {
      map.off('click', POINTS_LAYER, onClick);
      map.off('mouseenter', POINTS_LAYER, onEnter);
      map.off('mouseleave', POINTS_LAYER, onLeave);
    };
  }, [mapRef, isPicking, select]);

  // Picking mode: the next map click sets the position (with terrain elevation)
  useEffect(() => {
    const map = mapRef?.getMap();
    if (!map || !isPicking) return;
    const canvas = map.getCanvas();
    canvas.style.cursor = 'crosshair';
    const onClick = async (e: MapMouseEvent) => {
      const { lng, lat } = e.lngLat;
      setPickedPoint({ lng, lat, elevationM: null });
      try {
        const elevationM = await getElevationAtPoint(map, lng, lat);
        const current = useMarkedLocationStore.getState().pickedPoint;
        if (current?.lng === lng && current?.lat === lat) {
          setPickedPoint({ lng, lat, elevationM: Math.round(elevationM * 10) / 10 });
        }
      } catch {
        // Elevation is optional; the user can type it in
      }
    };
    map.once('click', onClick);
    return () => {
      map.off('click', onClick);
      canvas.style.cursor = '';
    };
  }, [mapRef, isPicking, setPickedPoint]);

  const copyCoordinates = async (lat: number, lng: number) => {
    try {
      await navigator.clipboard.writeText(formatLatLng(lat, lng));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard not available (http or permissions)
    }
  };

  return (
    <>
      <Source id="marked-locations" type="geojson" data={geojson}>
        <Layer
          id={POINTS_LAYER}
          type="symbol"
          layout={{
            'icon-image': ['get', 'icon'],
            'icon-size': ['interpolate', ['linear'], ['zoom'], 5, 0.55, 12, 0.8, 16, 1],
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
          }}
        />
        <Layer
          id="marked-locations-labels"
          type="symbol"
          minzoom={11}
          // The open location shows its name in the popup instead
          filter={['!=', ['get', 'id'], selectedId ?? '']}
          layout={{
            'text-field': ['get', 'name'],
            'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
            'text-size': 11,
            'text-anchor': 'bottom',
            'text-offset': [0, -1.9],
            'text-max-width': 12,
            'icon-image': LABEL_BG,
            'icon-text-fit': 'both',
            'icon-text-fit-padding': [3, 7, 3, 7],
          }}
          paint={{
            'text-color': '#1a2214',
          }}
        />
      </Source>

      {pickedPoint && (
        <Marker longitude={pickedPoint.lng} latitude={pickedPoint.lat} anchor="bottom">
          <MapPin size={30} className="text-gold-500 fill-gold-200 drop-shadow-lg animate-bounce" />
        </Marker>
      )}

      {selected && (
        <Popup
          longitude={selected.location.lng}
          latitude={selected.location.lat}
          offset={18}
          onClose={() => select(null)}
          closeOnClick={false}
          focusAfterOpen={false}
          className="marked-popup"
          maxWidth="280px"
        >
          <div className="p-1 text-ink space-y-2">
            <div className="flex items-start gap-2 pr-6">
              {(() => {
                const Icon = CATEGORY_ICONS[selected.location.category] ?? MapPin;
                return (
                  <span
                    className="mt-0.5 w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-white shadow"
                    style={{ backgroundColor: CATEGORY_META[selected.location.category]?.color }}
                  >
                    <Icon size={13} strokeWidth={2.5} />
                  </span>
                );
              })()}
              <div className="min-w-0">
                <h3 className="mt-1 font-bold text-sm leading-tight break-words">{selected.location.name}</h3>
              </div>
            </div>

            {showDetails && (
            <>

            <div className="text-[11px] font-mono text-sand-700 space-y-0.5">
              <div>{formatLatLng(selected.location.lat, selected.location.lng)}</div>
              <div>
                {toDMS(selected.location.lat, true)} {toDMS(selected.location.lng, false)}
              </div>
              {selected.location.elevationM != null && <div>Elevation {Math.round(selected.location.elevationM)} m</div>}
            </div>

            {selected.location.address && <p className="text-[11px] text-sand-700">{selected.location.address}</p>}
            {selected.location.description && (
              <p className="text-[11px] text-sand-700 whitespace-pre-wrap break-words max-h-24 overflow-y-auto">
                {selected.location.description}
              </p>
            )}
            {selected.location.contact && <p className="text-[11px] text-sand-700">Contact: {selected.location.contact}</p>}
            {selected.location.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {selected.location.tags.map((tag) => (
                  <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-full bg-sand-100 text-sand-700">
                    {tag}
                  </span>
                ))}
              </div>
            )}
            {selected.kind !== 'mine' && (
              <p className="text-[10px] text-gold-700">
                {selected.kind === 'shared' ? 'Shared by' : 'Owner:'} {selected.owner ?? 'another account'}
              </p>
            )}
            </>
            )}

            <button
              onClick={() => setShowDetails((v) => !v)}
              className="cursor-pointer w-full flex items-center justify-center gap-1 py-1 rounded-lg text-[10px] font-bold text-sand-600 hover:text-ink hover:bg-sand-50"
              aria-expanded={showDetails}
            >
              {showDetails ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {showDetails ? 'Hide details' : 'Show details'}
            </button>

            <div className="flex gap-1 pt-1 border-t border-sand-100">
              <a
                href={directionsUrl(selected.location.lat, selected.location.lng)}
                target="_blank"
                rel="noreferrer"
                className="flex-1 flex items-center justify-center py-2 rounded-lg bg-forest-800 hover:bg-forest-700 text-white"
                title="Directions"
                aria-label="Directions"
              >
                <Navigation size={14} />
              </a>
              <button
                onClick={() => copyCoordinates(selected.location.lat, selected.location.lng)}
                className="cursor-pointer flex-1 flex items-center justify-center py-2 rounded-lg bg-sand-100 hover:bg-sand-200 text-ink"
                title={copied ? 'Copied' : 'Copy coordinates'}
                aria-label={copied ? 'Copied' : 'Copy coordinates'}
              >
                {copied ? <Check size={14} className="text-forest-700" /> : <Copy size={14} />}
              </button>
              <button
                onClick={() => setPanelOpen(true)}
                className="cursor-pointer flex-1 flex items-center justify-center py-2 rounded-lg bg-sand-100 hover:bg-sand-200 text-ink"
                title="Open in Marked Locations"
                aria-label="Open in Marked Locations"
              >
                <PanelRightOpen size={14} />
              </button>
            </div>
          </div>
        </Popup>
      )}
    </>
  );
};
