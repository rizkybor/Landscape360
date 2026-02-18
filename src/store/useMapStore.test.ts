import { describe, it, expect, beforeEach } from 'vitest';
import { useMapStore } from './useMapStore';

describe('useMapStore', () => {
  beforeEach(() => {
    useMapStore.setState({
      center: [106.8456, -6.2088],
      zoom: 14,
      pitch: 60,
      bearing: 0,
      activeView: '3D',
      showContours: true,
      mapStyle: 'mapbox://styles/mapbox/satellite-streets-v12',
      flyToDestination: null
    });
  });

  it('should initialize with default values', () => {
    const state = useMapStore.getState();
    expect(state.zoom).toBe(14);
    expect(state.activeView).toBe('3D');
  });

  it('should update center and zoom', () => {
    useMapStore.getState().setCenter([0, 0]);
    useMapStore.getState().setZoom(10);
    
    expect(useMapStore.getState().center).toEqual([0, 0]);
    expect(useMapStore.getState().zoom).toBe(10);
  });

  it('should update view mode (2D/3D)', () => {
    useMapStore.getState().setActiveView('2D');
    expect(useMapStore.getState().activeView).toBe('2D');

    useMapStore.getState().setActiveView('3D');
    expect(useMapStore.getState().activeView).toBe('3D');
  });

  it('should toggle contour visibility', () => {
    useMapStore.getState().setShowContours(false);
    expect(useMapStore.getState().showContours).toBe(false);

    useMapStore.getState().setShowContours(true);
    expect(useMapStore.getState().showContours).toBe(true);
  });

  it('should set map style', () => {
    const newStyle = 'mapbox://styles/mapbox/outdoors-v12';
    useMapStore.getState().setMapStyle(newStyle);
    expect(useMapStore.getState().mapStyle).toBe(newStyle);
  });

  it('should trigger flyTo', () => {
    const dest = { center: [10, 10] as [number, number], zoom: 12, duration: 1000 };
    useMapStore.getState().triggerFlyTo(dest);
    expect(useMapStore.getState().flyToDestination).toEqual(dest);
  });
});
