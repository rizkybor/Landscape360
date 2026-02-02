import { useEffect, useRef } from 'react';
import { useMap } from 'react-map-gl/mapbox';
import mapboxgl from 'mapbox-gl';
import * as THREE from 'three';
import { useSurveyStore } from '../store/useSurveyStore';

interface ThreeCustomLayer extends mapboxgl.CustomLayerInterface {
  camera: THREE.Camera;
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer | null;
  map: mapboxgl.Map | null;
  updateMarkers: () => void;
}

export const ThreeScene = () => {
  const { current: mapRef } = useMap();
  const { groups } = useSurveyStore();
  
  // Ref to hold the scene so we can update it from other effects
  const sceneRef = useRef<THREE.Scene | null>(null);

  useEffect(() => {
    if (!mapRef) return;
    const map = mapRef.getMap();
    const customLayerId = 'three-layer';

    const customLayer: ThreeCustomLayer = {
      id: customLayerId,
      type: 'custom',
      renderingMode: '3d',
      camera: new THREE.Camera(),
      scene: new THREE.Scene(),
      renderer: null,
      map: null,
      updateMarkers: () => {}, // Placeholder

      onAdd: function (map: mapboxgl.Map, gl: WebGLRenderingContext) {
        this.camera = new THREE.Camera();
        this.scene = new THREE.Scene();
        sceneRef.current = this.scene; // Expose scene to component

        this.renderer = new THREE.WebGLRenderer({
          canvas: map.getCanvas(),
          context: gl,
          antialias: true,
        });
        this.renderer.autoClear = false;

        const light = new THREE.DirectionalLight(0xffffff);
        light.position.set(0, 0, 1);
        this.scene.add(light);
        this.scene.add(new THREE.AmbientLight(0x404040));
        
        this.map = map;
      },
      render: function (_gl: WebGLRenderingContext, matrix: number[]) {
        if (!this.renderer || !this.map) return;
        const m = new THREE.Matrix4().fromArray(matrix);
        this.camera.projectionMatrix = m;
        this.renderer.resetState();
        this.renderer.render(this.scene, this.camera);
        this.map.triggerRepaint();
      }
    };

    const addLayer = () => {
      if (!map.isStyleLoaded()) {
        map.once('style.load', addLayer);
        return;
      }

      if (map.getStyle() && !map.getLayer(customLayerId)) {
        try {
          map.addLayer(customLayer);
        } catch (e) {
          console.error("Failed to add Three.js layer:", e);
        }
      }
    };

    if (map.isStyleLoaded()) {
        addLayer();
    } else {
        map.once('style.load', addLayer);
    }

    return () => {
      map.off('style.load', addLayer);
      try {
        if (map.getStyle() && map.getLayer(customLayerId)) {
          map.removeLayer(customLayerId);
        }
      } catch (e) { console.warn(e); }
      sceneRef.current = null;
    };
  }, [mapRef]);

  // Effect to update markers when points change
  useEffect(() => {
      if (!sceneRef.current || !mapRef) return;
      const scene = sceneRef.current;
      
      // Remove old markers
      for (let i = scene.children.length - 1; i >= 0; i--) {
          if (scene.children[i].name === 'survey-marker') {
              scene.remove(scene.children[i]);
          }
      }

      const allPoints = groups.flatMap(g => g.points.map(p => ({ ...p, color: g.color })));

      // Add new markers
      if (allPoints.length === 0) {
          mapRef.getMap().triggerRepaint();
          return;
      }

      const geometry = new THREE.CylinderGeometry(2, 2, 200, 16); // Taller beam
      geometry.translate(0, 100, 0); // Pivot at bottom

      allPoints.forEach(p => {
          const material = new THREE.MeshPhongMaterial({ color: p.color, transparent: true, opacity: 0.6 });
          const modelOrigin = mapboxgl.MercatorCoordinate.fromLngLat(
              { lng: p.lng, lat: p.lat },
              p.elevation
          );
          const modelScale = modelOrigin.meterInMercatorCoordinateUnits();

          const mesh = new THREE.Mesh(geometry, material);
          mesh.name = 'survey-marker';
          mesh.position.set(modelOrigin.x, modelOrigin.y, modelOrigin.z);
          mesh.scale.set(modelScale, modelScale, modelScale);
          mesh.rotation.x = Math.PI / 2; 

          scene.add(mesh);
      });
      
      mapRef.getMap().triggerRepaint();
  }, [groups, mapRef]);

  return null;
};
