import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ControlPanel } from './ControlPanel';
import { useMapStore } from '../store/useMapStore';
import { useSurveyStore } from '../store/useSurveyStore';
import { useTrackerStore } from '../store/useTrackerStore';
import { BrowserRouter } from 'react-router-dom';

// Mocks
vi.mock('../store/useMapStore');
vi.mock('../store/useSurveyStore');
vi.mock('../store/useTrackerStore');
vi.mock('./AuthControl', () => ({ AuthControl: () => <div data-testid="auth-control">Auth</div> }));

describe('ControlPanel', () => {
  let mockSetMapStyle: any;
  let mockSetActiveView: any;
  let mockToggleLiveTracking: any;

  beforeEach(() => {
    mockSetMapStyle = vi.fn();
    mockSetActiveView = vi.fn();
    mockToggleLiveTracking = vi.fn();

    (useMapStore as any).mockReturnValue({
      activeView: '3D',
      setActiveView: mockSetActiveView,
      mapStyle: 'mapbox://styles/mapbox/satellite-streets-v12',
      setMapStyle: mockSetMapStyle,
      showContours: true,
      setShowContours: vi.fn(),
      opacity: 0.8,
      setOpacity: vi.fn(),
      contourInterval: 50,
      setContourInterval: vi.fn(),
      elevationExaggeration: 1.5,
      setElevationExaggeration: vi.fn(),
      showSearch: false,
      setShowSearch: vi.fn(),
      showWeather: false,
      setShowWeather: vi.fn(),
      setPitch: vi.fn(), // Added
      setBearing: vi.fn(), // Added
      pitch: 60,
      bearing: 0,
      mouseControlMode: 'map',
      setMouseControlMode: vi.fn(),
      gridOpacity: 0.5,
      setGridOpacity: vi.fn(),
      gridStep: 'auto',
      setGridStep: vi.fn(),
      showGridDMS: false,
      setShowGridDMS: vi.fn(),
    });

    (useSurveyStore as any).mockReturnValue({
      isPlotMode: false,
      togglePlotMode: vi.fn(),
      user: { id: 'user1' },
      subscriptionStatus: 'Enterprise',
      userRole: 'monitor360'
    });

    (useTrackerStore as any).mockReturnValue({
      isLiveTrackingEnabled: false,
      toggleLiveTracking: mockToggleLiveTracking,
      isSimulationEnabled: false,
      isLocalBroadcastEnabled: false,
      connectionStatus: 'disconnected'
    });
  });

  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <ControlPanel />
      </BrowserRouter>
    );
  };

  it('should render map style options', () => {
    renderComponent();
    expect(screen.getByText('Streets')).toBeInTheDocument();
    expect(screen.getByText('Outdoors')).toBeInTheDocument();
    expect(screen.getByText('Satellite')).toBeInTheDocument();
  });

  it('should change map style on click', () => {
    renderComponent();
    fireEvent.click(screen.getByText('Streets'));
    expect(mockSetMapStyle).toHaveBeenCalledWith(expect.stringContaining('streets'));
  });

  it('should toggle view mode 2D/3D', () => {
    renderComponent();
    fireEvent.click(screen.getByText('2D Topo'));
    expect(mockSetActiveView).toHaveBeenCalledWith('2D');
  });

  it('should show GPS Monitoring button for Enterprise Monitor', () => {
    renderComponent();
    expect(screen.getByText('Start GPS Monitoring')).toBeInTheDocument();
  });

  it('should toggle GPS Tracking', () => {
    renderComponent();
    fireEvent.click(screen.getByText('Start GPS Monitoring'));
    expect(mockToggleLiveTracking).toHaveBeenCalled();
  });

  it('should render AuthControl', () => {
    renderComponent();
    expect(screen.getByTestId('auth-control')).toBeInTheDocument();
  });
});
