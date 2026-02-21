
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

// Mock Lucide Icons for easier testing
vi.mock('lucide-react', async () => {
  const actual = await vi.importActual('lucide-react');
  return {
    ...actual,
    Navigation: (props: any) => <div data-testid="icon-navigation" {...props} />,
    Binoculars: (props: any) => <div data-testid="icon-binoculars" {...props} />,
  };
});

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
      setPitch: vi.fn(),
      setBearing: vi.fn(),
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

    // Default mock: Enterprise Monitor (should show Binoculars)
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
      connectionStatus: 'disconnected',
      trackers: {}
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

  it('should show "Team Monitor" and Binoculars icon for Enterprise Monitor', () => {
    renderComponent();
    expect(screen.getByText('Team Monitor')).toBeInTheDocument();
    expect(screen.getByTestId('icon-binoculars')).toBeInTheDocument();
    expect(screen.queryByTestId('icon-navigation')).not.toBeInTheDocument();
  });

  it('should show "GPS Tracking" and Navigation icon for Pro User (Not Monitor)', () => {
    (useSurveyStore as any).mockReturnValue({
      isPlotMode: false,
      togglePlotMode: vi.fn(),
      user: { id: 'user2' },
      subscriptionStatus: 'Pro',
      userRole: 'pengguna360'
    });

    renderComponent();
    expect(screen.getByText('GPS Tracking')).toBeInTheDocument();
    expect(screen.getByTestId('icon-navigation')).toBeInTheDocument();
    expect(screen.queryByTestId('icon-binoculars')).not.toBeInTheDocument();
  });

  it('should show "Team Monitor" and Binoculars icon if Monitor AND Enterprise', () => {
    (useSurveyStore as any).mockReturnValue({
      user: { id: 'monitor', email: 'monitor@app.com' },
      userRole: 'monitor360',
      subscriptionStatus: 'Enterprise', // Enterprise
    });

    renderComponent();
    expect(screen.getByText('Team Monitor')).toBeInTheDocument();
    expect(screen.getByTestId('icon-binoculars')).toBeInTheDocument();
  });

  it('should show "GPS Tracking" but Navigation icon if Monitor is NOT Enterprise (Logic check)', () => {
    // Logic: If Monitor but Free/Pro -> Fallback to GPS Tracking UI (though functionality might be disabled/limited by useEffect)
    // The component renders "GPS Tracking" unless (Monitor && Enterprise)
    (useSurveyStore as any).mockReturnValue({
        user: { id: 'monitor', email: 'monitor@app.com' },
        userRole: 'monitor360',
        subscriptionStatus: 'Pro', // Not Enterprise
    });

    renderComponent();
    expect(screen.getByText('GPS Tracking')).toBeInTheDocument(); // Fallback text
    expect(screen.getByTestId('icon-navigation')).toBeInTheDocument(); // Fallback icon
  });

  it('should toggle Tracking/Monitoring on click', () => {
    renderComponent();
    // Default mock is Enterprise Monitor -> "Team Monitor"
    fireEvent.click(screen.getByText('Team Monitor'));
    expect(mockToggleLiveTracking).toHaveBeenCalled();
  });

  it('should render AuthControl', () => {
    renderComponent();
    expect(screen.getByTestId('auth-control')).toBeInTheDocument();
  });
});
