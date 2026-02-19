
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RegionDrawingOverlay } from './RegionDrawingOverlay';
import { useMapStore } from '../store/useMapStore';
import { useOfflineStore } from '../store/useOfflineStore';
import { useSurveyStore } from '../store/useSurveyStore';
import * as tileUtils from '../utils/tileUtils'; // Import as namespace to spy on it

// Mocks
vi.mock('../store/useMapStore');
vi.mock('../store/useOfflineStore');
vi.mock('../store/useSurveyStore');
vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: { status_subscribe: 'Free' } }))
        }))
      })),
      insert: vi.fn(() => Promise.resolve({ error: null }))
    }))
  }
}));

// Mock tileUtils
vi.mock('../utils/tileUtils', () => ({
  getTilesInBounds: vi.fn(), 
  getMapboxTileUrl: vi.fn(),
  getMapboxVectorTileUrl: vi.fn(),
  getTerrainTileUrl: vi.fn(),
}));

describe('RegionDrawingOverlay', () => {
  beforeEach(() => {
    (useMapStore as any).mockReturnValue({
      zoom: 14,
      interactionMode: 'draw_region',
      setInteractionMode: vi.fn(),
      regionPoints: [[0, 0], [0, 1], [1, 1], [1, 0]], // 4 points
      clearRegionPoints: vi.fn()
    });

    (useOfflineStore as any).mockReturnValue({
      regions: [],
      addRegion: vi.fn(),
      updateRegionProgress: vi.fn()
    });

    (useSurveyStore as any).mockReturnValue({
      user: { id: 'test-user', email: 'test@example.com' },
      subscriptionStatus: 'Free'
    });

    // Default: Small area (5 tiles -> ~0.35MB < 1MB limit)
    (tileUtils.getTilesInBounds as any).mockReturnValue(new Array(5).fill({}));
  });

  it('should render when interaction mode is draw_region', () => {
    render(<RegionDrawingOverlay />);
    expect(screen.getByText(/Define Area/i)).toBeInTheDocument();
  });

  it('should show download button when 4 points are set and size is within limit', () => {
    render(<RegionDrawingOverlay />);
    expect(screen.getByText(/Download Region/i)).toBeInTheDocument();
  });

  it('should show "Download Limit Exceeded" if size is too big for Free plan', async () => {
    // Override mock for this test: Large area (500 tiles -> ~35MB > 1MB limit)
    (tileUtils.getTilesInBounds as any).mockReturnValue(new Array(500).fill({}));
    
    render(<RegionDrawingOverlay />);
    
    // Check if the warning appears
    await waitFor(() => {
      expect(screen.getByText(/Download Limit Exceeded/i)).toBeInTheDocument();
    });

    // Check if Check Upgrade Options button appears
    expect(screen.getByText(/CHECK UPGRADE OPTIONS/i)).toBeInTheDocument();
  });

  it('should open upgrade modal and default to Pro for Free user', async () => {
    // Override mock: Large area
    (tileUtils.getTilesInBounds as any).mockReturnValue(new Array(500).fill({}));

    render(<RegionDrawingOverlay />);
    
    // Click Upgrade Options
    const upgradeBtn = screen.getByText(/CHECK UPGRADE OPTIONS/i);
    fireEvent.click(upgradeBtn);

    // Check modal content
    expect(screen.getAllByText('Download Limit Exceeded')[0]).toBeInTheDocument();
    
    // Check for the paragraph containing the explanation
    const explanation = screen.getByText(/Your current/i);
    expect(explanation).toHaveTextContent(/Free Plan/i);
    expect(explanation).toHaveTextContent(/is limited to/i);
    
    // Check Prices
    expect(screen.getByText('Rp 55.000')).toBeInTheDocument();
    expect(screen.getByText('Rp 110.000')).toBeInTheDocument();

    // Check default selection
    expect(screen.getByText('Request Pro Upgrade')).toBeInTheDocument();
  });

  it('should default to Enterprise for Pro user upgrade', async () => {
    // Override mock: Large area
    (tileUtils.getTilesInBounds as any).mockReturnValue(new Array(500).fill({}));

    (useSurveyStore as any).mockReturnValue({
      user: { id: 'test-user', email: 'test@example.com' },
      subscriptionStatus: 'Pro'
    });

    render(<RegionDrawingOverlay />);
    
    // Click Upgrade Options
    const upgradeBtn = screen.getByText(/CHECK UPGRADE OPTIONS/i);
    fireEvent.click(upgradeBtn);

    // Check content text for Pro Plan
    const explanation = screen.getByText((content, element) => {
        return content.includes('Your current') && element?.tagName.toLowerCase() === 'p';
    });
    expect(explanation).toHaveTextContent(/Pro Plan/i);
    expect(explanation).toHaveTextContent(/is limited to/i);
    
    // Check default selection is Enterprise
    expect(screen.getByText('Request Enterprise Upgrade')).toBeInTheDocument();
  });
});
