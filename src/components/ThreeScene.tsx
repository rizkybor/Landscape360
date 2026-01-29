import { useEffect } from 'react';
import { useMap } from 'react-map-gl/mapbox';
import mapboxgl from 'mapbox-gl';
import * as THREE from 'three';

interface ThreeCustomLayer extends mapboxgl.CustomLayerInterface {
  camera: THREE.Camera;
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  map: mapboxgl.Map;
}

export const ThreeScene = () => {
  const { current: mapRef } = useMap();

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
      renderer: null as any, // Initialized in onAdd
      map: null as any, // Initialized in onAdd

      onAdd: function (map: mapboxgl.Map, gl: WebGLRenderingContext) {
        this.camera = new THREE.Camera();
        this.scene = new THREE.Scene();

        // Use the Mapbox GL context
        this.renderer = new THREE.WebGLRenderer({
          canvas: map.getCanvas(),
          context: gl,
          antialias: true,
        });
        this.renderer.autoClear = false;

        // Add a directional light
        const light = new THREE.DirectionalLight(0xffffff);
        light.position.set(0, 0, 1);
        this.scene.add(light);
        
        // Add ambient light
        const ambientLight = new THREE.AmbientLight(0x404040);
        this.scene.add(ambientLight);

        // Add dummy objects (cones) to visualize "slope" or just 3D markers
        // We will add them around the center
        const center = map.getCenter();
        
        // Create a grid of cones
        const gridSize = 5;
        const spacing = 0.005; // degrees roughly

        const geometry = new THREE.ConeGeometry(5, 20, 8);
        const material = new THREE.MeshPhongMaterial({ color: 0xff0000, flatShading: true });

        for (let i = -gridSize; i <= gridSize; i++) {
          for (let j = -gridSize; j <= gridSize; j++) {
            const lng = center.lng + i * spacing;
            const lat = center.lat + j * spacing;
            
            const modelOrigin = mapboxgl.MercatorCoordinate.fromLngLat(
              { lng, lat } as mapboxgl.LngLatLike,
              0
            );
            const modelScale = modelOrigin.meterInMercatorCoordinateUnits();

            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(modelOrigin.x, modelOrigin.y, modelOrigin.z);
            mesh.scale.set(modelScale, modelScale, modelScale);
            // Point up
            mesh.rotation.x = Math.PI / 2; 

            this.scene.add(mesh);
          }
        }
        
        this.map = map;
      },
      render: function (_gl: WebGLRenderingContext, matrix: number[]) {
        const m = new THREE.Matrix4().fromArray(matrix);
        this.camera.projectionMatrix = m;
        
        this.renderer.resetState();
        this.renderer.render(this.scene, this.camera);
        this.map.triggerRepaint();
      }
    };

    const addLayer = () => {
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
      } catch (e) {
        // Ignore cleanup errors if map is already destroyed or style is gone
        console.warn("Error removing Three.js layer:", e);
      }
    };
  }, [mapRef]);

  return null;
};
