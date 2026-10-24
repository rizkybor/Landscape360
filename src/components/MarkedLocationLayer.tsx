import { useEffect, useMemo, useState } from 'react';
import { Source, Layer, Marker, Popup, useMap } from 'react-map-gl/mapbox';
import type { FeatureCollection, Point } from 'geojson';
import type { ExpressionSpecification, MapMouseEvent } from 'mapbox-gl';
import { Copy, MapPin, Navigation, PanelRightOpen } from 'lucide-react';
import { getVisibleLocations, useMarkedLocationStore } from '../store/useMarkedLocationStore';
import { CATEGORY_META, directionsUrl, formatLatLng } from '../utils/markedLocations';
import { getElevationAtPoint } from '../utils/elevationUtils';
import { toDMS } from '../utils/surveyUtils';

const POINTS_LAYER = 'marked-locations-points';

const categoryColorExpression = [
  'match',
  ['get', 'category'],
  ...Object.entries(CATEGORY_META).flatMap(([category, meta]) => [category, meta.color]),
  CATEGORY_META.poi.color,
] as ExpressionSpecification;

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

  const visible = useMemo(
    () => getVisibleLocations({ locations, sharedLocations, adminLocations, showAllOnMap }),
    [locations, sharedLocations, adminLocations, showAllOnMap],
  );

  const geojson = useMemo<FeatureCollection<Point>>(
    () => ({
      type: 'FeatureCollection',
      features: visible.map(({ location, kind }) => ({
        type: 'Feature',
        properties: { id: location.id, name: location.name, category: location.category, kind },
        geometry: { type: 'Point', coordinates: [location.lng, location.lat] },
      })),
    }),
    [visible],
  );

  const selected = visible.find((v) => v.location.id === selectedId) ?? null;

  // Click a marker to open its details; pointer cursor on hover
  useEffect(() => {
    const map = mapRef?.getMap();
    if (!map || isPicking) return;
    const onClick = (e: MapMouseEvent) => {
      const id = e.features?.[0]?.properties?.id;
      if (id) select(String(id));
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
          type="circle"
          paint={{
            'circle-color': categoryColorExpression,
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 4, 12, 7, 16, 9],
            'circle-stroke-width': ['match', ['get', 'kind'], 'mine', 2, 3],
            // White ring: mine; gold ring: shared with me; grey ring: other accounts (admin)
            'circle-stroke-color': ['match', ['get', 'kind'], 'mine', '#ffffff', 'shared', '#e9b640', '#9ca3af'],
          }}
        />
        <Layer
          id="marked-locations-labels"
          type="symbol"
          minzoom={11}
          layout={{
            'text-field': ['get', 'name'],
            'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
            'text-size': 11,
            'text-offset': [0, 1.2],
            'text-anchor': 'top',
            'text-max-width': 12,
          }}
          paint={{
            'text-color': '#1a2214',
            'text-halo-color': '#ffffff',
            'text-halo-width': 1.5,
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
          anchor="bottom"
          offset={14}
          onClose={() => select(null)}
          closeOnClick={false}
          maxWidth="280px"
        >
          <div className="p-1 text-ink space-y-2">
            <div className="flex items-start gap-2 pr-4">
              <span
                className="mt-1 w-3 h-3 rounded-full shrink-0 border-2 border-white shadow"
                style={{ backgroundColor: CATEGORY_META[selected.location.category]?.color }}
              />
              <div className="min-w-0">
                <h3 className="font-bold text-sm leading-tight break-words">{selected.location.name}</h3>
                <p className="text-[10px] text-sand-600 uppercase tracking-wide">
                  {CATEGORY_META[selected.location.category]?.label}
                </p>
              </div>
            </div>

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

            <div className="flex gap-1 pt-1 border-t border-sand-100">
              <a
                href={directionsUrl(selected.location.lat, selected.location.lng)}
                target="_blank"
                rel="noreferrer"
                className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-forest-800 hover:bg-forest-700 text-white text-[10px] font-bold"
              >
                <Navigation size={11} /> Directions
              </a>
              <button
                onClick={() => copyCoordinates(selected.location.lat, selected.location.lng)}
                className="cursor-pointer flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-sand-100 hover:bg-sand-200 text-ink text-[10px] font-bold"
              >
                <Copy size={11} /> {copied ? 'Copied' : 'Copy'}
              </button>
              <button
                onClick={() => setPanelOpen(true)}
                className="cursor-pointer flex items-center justify-center px-2 py-1.5 rounded-lg bg-sand-100 hover:bg-sand-200 text-ink"
                title="Open in Marked Locations"
              >
                <PanelRightOpen size={12} />
              </button>
            </div>
          </div>
        </Popup>
      )}
    </>
  );
};
