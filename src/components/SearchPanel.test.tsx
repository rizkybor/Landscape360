import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SearchPanel } from './SearchPanel';
import { useMapStore } from '../store/useMapStore';

// Mock useMapStore
vi.mock('../store/useMapStore', () => ({
  useMapStore: vi.fn(),
}));

describe('SearchPanel', () => {
  const mockSetCenter = vi.fn();
  const mockSetZoom = vi.fn();
  const mockSetShowSearch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useMapStore as any).mockReturnValue({
      showSearch: true,
      setShowSearch: mockSetShowSearch,
      setCenter: mockSetCenter,
      setZoom: mockSetZoom,
    });
    
    // Mock global fetch with default success
    globalThis.fetch = vi.fn().mockResolvedValue({
        json: async () => ({ features: [] })
    });
  });

  it('renders correctly when showSearch is true', () => {
    render(<SearchPanel />);
    expect(screen.getByPlaceholderText(/Search mountains, basecamp, or cities/i)).toBeInTheDocument();
  });

  it('does not render when showSearch is false', () => {
    (useMapStore as any).mockReturnValue({ showSearch: false });
    const { container } = render(<SearchPanel />);
    expect(container).toBeEmptyDOMElement();
  });

  it('performs search on input change with debounce', async () => {
    render(<SearchPanel />);
    const input = screen.getByPlaceholderText(/Search mountains, basecamp, or cities/i);

    // Mock API response
    (globalThis.fetch as any).mockResolvedValue({
      json: async () => ({
        features: [
          {
            id: '1',
            place_name: 'Universitas Indonesia, Depok',
            center: [106.8, -6.3],
            place_type: ['poi']
          }
        ]
      })
    });

    fireEvent.change(input, { target: { value: 'Universitas Indonesia' } });

    // Wait for debounce and fetch
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled();
    });

    // Check if result is displayed
    expect(await screen.findByText('Universitas Indonesia')).toBeInTheDocument();
  });

  it('filters out results irrelevant to Indonesia via API params', async () => {
    render(<SearchPanel />);
    const input = screen.getByPlaceholderText(/Search mountains, basecamp, or cities/i);

    fireEvent.change(input, { target: { value: 'Gunung' } });

    await waitFor(() => {
      const url = (globalThis.fetch as any).mock.calls[0][0];
      expect(url).toContain('country=id'); // Ensure country=id is present
      expect(url).toContain('types=country,region,district,place,locality,neighborhood,address,poi');
    });
  });

  it('handles coordinate input correctly', async () => {
    render(<SearchPanel />);
    const input = screen.getByPlaceholderText(/Search mountains, basecamp, or cities/i);

    // Input "Lat, Lon"
    fireEvent.change(input, { target: { value: '-6.2, 106.8' } });

    await waitFor(() => {
      const url = (globalThis.fetch as any).mock.calls[0][0];
      // Should convert "Lat, Lon" to "Lon, Lat" for Mapbox: "106.8,-6.2"
      // URL encoded comma is %2C
      expect(url).toContain('106.8%2C-6.2');
      expect(url).not.toContain('country=id');
    });
  });

  it('zooms to location on result click', async () => {
    render(<SearchPanel />);
    const input = screen.getByPlaceholderText(/Search mountains, basecamp, or cities/i);

    (globalThis.fetch as any).mockResolvedValue({
        json: async () => ({
          features: [
            {
              id: '1',
              place_name: 'Jakarta',
              center: [106.8, -6.2],
              place_type: ['place']
            }
          ]
        })
      });

    fireEvent.change(input, { target: { value: 'Jakarta' } });
    const result = await screen.findByText('Jakarta');
    
    fireEvent.click(result);
    
    expect(mockSetCenter).toHaveBeenCalledWith([106.8, -6.2]);
    expect(mockSetZoom).toHaveBeenCalledWith(16);
    expect(mockSetShowSearch).toHaveBeenCalledWith(false);
  });
});
