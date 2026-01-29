import React, { useEffect, useCallback, useState } from 'react';
import { useMap, Source, Layer } from 'react-map-gl/mapbox';
import { useSurveyStore } from '../store/useSurveyStore';
import mapboxgl from 'mapbox-gl';
import type { FeatureCollection } from 'geojson';

export const PlottingLayer = () => {
  const { current: mapRef } = useMap();
  const { isPlotMode, points, addPoint } = useSurveyStore();
  const [cursorLocation, setCursorLocation] = useState<[number, number] | null>(null);

  // Handle Map Click
  useEffect(() => {
    if (!mapRef || !isPlotMode) return;
    const map = mapRef.getMap();

    const handleClick = (e: mapboxgl.MapMouseEvent) => {
      // Prevent clicking on existing points/UI if possible, but map click is global
      // e.preventDefault(); // This might block other interactions if not careful
      
      const { lng, lat } = e.lngLat;
      
      // Query elevation
      let elevation = 0;
      try {
        if (map.isStyleLoaded()) {
            elevation = map.queryTerrainElevation(e.lngLat) || 0;
        }
      } catch (err) {
        console.warn("Elevation query failed", err);
      }

      addPoint({ lng, lat, elevation });
    };

    const handleMouseMove = (e: mapboxgl.MapMouseEvent) => {
        setCursorLocation([e.lngLat.lng, e.lngLat.lat]);
        map.getCanvas().style.cursor = 'crosshair';
    };

    map.on('click', handleClick);
    map.on('mousemove', handleMouseMove);

    return () => {
      map.off('click', handleClick);
      map.off('mousemove', handleMouseMove);
      map.getCanvas().style.cursor = '';
    };
  }, [mapRef, isPlotMode, addPoint]);

  // Prepare GeoJSON
  const pointsGeoJSON: FeatureCollection = {
    type: 'FeatureCollection',
    features: points.map(p => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: { id: p.id, elevation: p.elevation }
    }))
  };

  const linesGeoJSON: FeatureCollection = {
    type: 'FeatureCollection',
    features: []
  };

  if (points.length >= 2) {
    // Create lines between sequential points
    const coordinates = points.map(p => [p.lng, p.lat]);
    linesGeoJSON.features.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates },
      properties: {}
    });
  }

  // Preview line from last point to cursor
  if (isPlotMode && points.length > 0 && cursorLocation) {
      const lastPoint = points[points.length - 1];
      linesGeoJSON.features.push({
          type: 'Feature',
          geometry: { 
              type: 'LineString', 
              coordinates: [[lastPoint.lng, lastPoint.lat], cursorLocation] 
          },
          properties: { type: 'preview' }
      });
  }

  if (!points.length && !isPlotMode) return null;

  return (
    <>
      <Source id="survey-points" type="geojson" data={pointsGeoJSON}>
        <Layer
          id="survey-points-circle"
          type="circle"
          paint={{
            'circle-radius': 6,
            'circle-color': '#FFD700', // Gold
            'circle-stroke-width': 2,
            'circle-stroke-color': '#000000',
            // To prevent z-fighting/sinking, standard circles are draped on terrain by default in Mapbox GL JS v2/v3
            'circle-pitch-alignment': 'viewport'
          }}
        />
      </Source>

      <Source id="survey-lines" type="geojson" data={linesGeoJSON}>
        <Layer
          id="survey-lines-path"
          type="line"
          paint={{
            'line-color': ['match', ['get', 'type'], 'preview', '#FFFFFF', '#FFD700'],
            'line-width': ['match', ['get', 'type'], 'preview', 2, 4],
            'line-dasharray': ['match', ['get', 'type'], 'preview', [2, 2], [1]],
            // Clamping strategy
            // 'line-z-offset' helps lift it slightly if supported, but typically not needed for draped lines
          }}
          layout={{
              'line-join': 'round',
              'line-cap': 'round'
          }}
        />
      </Source>
    </>
  );
};
