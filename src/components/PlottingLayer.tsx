import React, { useEffect, useCallback, useState } from 'react';
import { useMap, Source, Layer } from 'react-map-gl/mapbox';
import { useSurveyStore } from '../store/useSurveyStore';
import mapboxgl from 'mapbox-gl';
import type { FeatureCollection } from 'geojson';

export const PlottingLayer = () => {
  const { current: mapRef } = useMap();
  const { isPlotMode, groups, activeGroupId, addPoint } = useSurveyStore();
  const [cursorLocation, setCursorLocation] = useState<[number, number] | null>(null);

  const activeGroup = groups.find(g => g.id === activeGroupId) || groups[0];

  // Handle Map Click
  useEffect(() => {
    if (!mapRef || !isPlotMode) return;
    const map = mapRef.getMap();

    const handleClick = (e: mapboxgl.MapMouseEvent) => {
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
    features: groups.flatMap(g => g.points.map(p => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: { 
        id: p.id, 
        elevation: p.elevation, 
        groupId: g.id, 
        color: g.color,
        isActive: g.id === activeGroupId
      }
    })))
  };

  const linesGeoJSON: FeatureCollection = {
    type: 'FeatureCollection',
    features: []
  };

  groups.forEach(g => {
    if (g.points.length >= 2) {
      const coordinates = g.points.map(p => [p.lng, p.lat]);
      linesGeoJSON.features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates },
        properties: { 
          groupId: g.id, 
          color: g.color,
          isActive: g.id === activeGroupId 
        }
      } as any);
    }
  });

  // Preview line from last point of active group to cursor
  if (isPlotMode && activeGroup && activeGroup.points.length > 0 && cursorLocation) {
      const lastPoint = activeGroup.points[activeGroup.points.length - 1];
      linesGeoJSON.features.push({
          type: 'Feature',
          geometry: { 
              type: 'LineString', 
              coordinates: [[lastPoint.lng, lastPoint.lat], cursorLocation] 
          },
          properties: { type: 'preview', color: activeGroup.color }
      } as any);
  }

  if (!groups.length && !isPlotMode) return null;

  return (
    <>
      <Source id="survey-points" type="geojson" data={pointsGeoJSON}>
        <Layer
          id="survey-points-circle"
          type="circle"
          paint={{
            'circle-radius': ['case', ['get', 'isActive'], 8, 6],
            'circle-color': ['get', 'color'],
            'circle-stroke-width': ['case', ['get', 'isActive'], 3, 2],
            'circle-stroke-color': '#000000',
            'circle-pitch-alignment': 'viewport'
          }}
        />
      </Source>

      <Source id="survey-lines" type="geojson" data={linesGeoJSON}>
        <Layer
          id="survey-lines-path"
          type="line"
          paint={{
            'line-color': ['get', 'color'],
            'line-width': ['case', ['match', ['get', 'type'], 'preview', true, false], 2, 4],
            'line-dasharray': ['case', ['match', ['get', 'type'], 'preview', true, false], [2, 2], [1]],
            'line-opacity': ['case', ['get', 'isActive'], 1, 0.5]
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
