import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SurveyorPanel } from './SurveyorPanel';
import { useSurveyStore } from '../store/useSurveyStore';

vi.mock('../store/useSurveyStore', () => ({
  useSurveyStore: vi.fn(),
}));

const groups = [
  {
    id: 'g1',
    name: 'Survey 1',
    color: '#facc15',
    points: [
      { id: 'p1', lng: 106.8, lat: -6.2, elevation: 10 },
      { id: 'p2', lng: 106.9, lat: -6.3, elevation: 20 },
    ],
  },
];

const mockStore = (overrides: Record<string, unknown>) => {
  (useSurveyStore as any).mockReturnValue({
    groups,
    activeGroupId: 'g1',
    isPlotMode: true,
    createGroup: vi.fn(),
    deleteGroup: vi.fn(),
    setActiveGroup: vi.fn(),
    removePoint: vi.fn(),
    clearPoints: vi.fn(),
    updateGroupName: vi.fn(),
    updatePointName: vi.fn(),
    setPlotMode: vi.fn(),
    saveCurrentSurvey: vi.fn(),
    isSyncing: false,
    user: null,
    errorMessage: null,
    clearError: vi.fn(),
    ...overrides,
  });
};

describe('SurveyorPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the panel when Navigator is on', () => {
    mockStore({ isPlotMode: true });
    render(<SurveyorPanel />);
    expect(screen.getByText('Navigator Tool')).toBeInTheDocument();
  });

  it('hides the panel when Navigator is off, even with survey data', () => {
    mockStore({ isPlotMode: false });
    const { container } = render(<SurveyorPanel />);
    expect(container).toBeEmptyDOMElement();
  });

  it('hides the minimized panel when Navigator is turned off', () => {
    mockStore({ isPlotMode: true });
    const { container, rerender } = render(<SurveyorPanel />);

    fireEvent.click(screen.getByText('Hide'));
    expect(screen.getByText('Show')).toBeInTheDocument();

    mockStore({ isPlotMode: false });
    rerender(<SurveyorPanel />);
    expect(container).toBeEmptyDOMElement();
  });
});
