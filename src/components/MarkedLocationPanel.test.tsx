import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MarkedLocationPanel } from './MarkedLocationPanel';
import { useSurveyStore } from '../store/useSurveyStore';
import { useMarkedLocationStore } from '../store/useMarkedLocationStore';
import * as cloud from '../services/markedLocationSync';
import type { MarkedLocation } from '../types/markedLocation';

vi.mock('../store/useSurveyStore', () => ({ useSurveyStore: vi.fn() }));
vi.mock('../services/markedLocationSync', () => ({
  fetchMyLocations: vi.fn(),
  fetchSharedWithMe: vi.fn(),
  fetchAllLocations: vi.fn(),
  createLocation: vi.fn(),
  updateLocation: vi.fn(),
  deleteLocation: vi.fn(),
  shareLocations: vi.fn(),
  listShares: vi.fn(),
  removeShare: vi.fn(),
  fetchShareSuggestions: vi.fn(() => Promise.resolve([])),
}));

const location = (id: string, overrides: Partial<MarkedLocation> = {}): MarkedLocation => ({
  id,
  userId: 'me',
  name: `Location ${id}`,
  category: 'camp',
  lng: 107.6,
  lat: -6.9,
  elevationM: 1500,
  description: null,
  address: 'Cibodas',
  contact: null,
  tags: ['basecamp'],
  createdAt: 0,
  updatedAt: 0,
  ...overrides,
});

const mockUser = (subscriptionStatus: string, isAdmin = false) => {
  vi.mocked(useSurveyStore).mockReturnValue({
    user: { id: 'me' },
    subscriptionStatus,
    isAdmin,
    isPlotMode: false,
    setPlotMode: vi.fn(),
  } as unknown as ReturnType<typeof useSurveyStore>);
};

const renderOpen = async (mine: MarkedLocation[] = [location('a')]) => {
  vi.mocked(cloud.fetchMyLocations).mockResolvedValue(mine);
  render(<MarkedLocationPanel />);
  useMarkedLocationStore.getState().setPanelOpen(true);
  return screen.findByText('Marked Locations');
};

describe('MarkedLocationPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useMarkedLocationStore.getState().reset();
    vi.mocked(cloud.fetchSharedWithMe).mockResolvedValue([]);
    vi.mocked(cloud.fetchAllLocations).mockResolvedValue([]);
  });

  it('Free: shows the 10-location usage and the sharing lock, without share buttons', async () => {
    mockUser('Free');
    await renderOpen();
    expect(await screen.findByText('Location a')).toBeInTheDocument();
    expect(screen.getByText('1 / 10')).toBeInTheDocument();
    expect(screen.getByText(/Sharing with other users needs Pro or Enterprise/)).toBeInTheDocument();
    expect(screen.queryByTitle('Share this location')).not.toBeInTheDocument();
    expect(screen.queryByText(/All Users/)).not.toBeInTheDocument();
  });

  it('Free at the limit cannot add more', async () => {
    mockUser('Free');
    await renderOpen(Array.from({ length: 10 }, (_, i) => location(`l${i}`)));
    expect(await screen.findByText('10 / 10')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add/ })).toBeDisabled();
  });

  it('Pro: can share a location by email or name', async () => {
    mockUser('Pro');
    vi.mocked(cloud.listShares).mockResolvedValue([]);
    vi.mocked(cloud.shareLocations).mockResolvedValue({
      userId: 'siti',
      name: 'Siti Aminah',
      emailMasked: 's***@x.com',
      sharedCount: 1,
    });
    await renderOpen();
    expect(await screen.findByText('1 / 100')).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Share this location'));
    fireEvent.change(screen.getByPlaceholderText('Name or email'), { target: { value: 'Siti Aminah' } });
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));

    await waitFor(() => expect(cloud.shareLocations).toHaveBeenCalledWith(['a'], 'Siti Aminah'));
    expect(await screen.findByText(/Shared location with Siti Aminah \(s\*\*\*@x.com\)/)).toBeInTheDocument();
  });

  it('Pro: suggests recent recipients and people matching what is typed, one tap shares', async () => {
    mockUser('Pro');
    vi.mocked(cloud.listShares).mockResolvedValue([]);
    vi.mocked(cloud.fetchShareSuggestions).mockImplementation(async (query: string) =>
      query
        ? [{ userId: 'siti-id', name: 'Siti Aminah', emailMasked: 's***@x.com', recent: false }]
        : [{ userId: 'budi-id', name: 'Budi', emailMasked: 'b***@x.com', recent: true }],
    );
    vi.mocked(cloud.shareLocations).mockResolvedValue({ userId: 'siti-id', name: 'Siti Aminah', emailMasked: 's***@x.com', sharedCount: 1 });
    await renderOpen();
    fireEvent.click(await screen.findByTitle('Share this location'));

    expect(await screen.findByText('Recent')).toBeInTheDocument();
    expect(screen.getByText('Budi')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Name or email'), { target: { value: 'sit' } });
    fireEvent.click(await screen.findByText('Siti Aminah', {}, { timeout: 2000 }));
    await waitFor(() => expect(cloud.shareLocations).toHaveBeenCalledWith(['a'], 'siti-id'));
    expect(cloud.fetchShareSuggestions).toHaveBeenCalledWith('sit');
  });

  it('Pro: shares several selected locations at once', async () => {
    mockUser('Pro');
    vi.mocked(cloud.shareLocations).mockResolvedValue({ userId: 'u', name: 'Budi', emailMasked: null, sharedCount: 2 });
    await renderOpen([location('a'), location('b')]);
    fireEvent.click(await screen.findByLabelText('Select Location a'));
    fireEvent.click(screen.getByLabelText('Select Location b'));
    expect(screen.getByText('2 selected')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    expect(screen.getByText('Share 2 locations')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Name or email'), { target: { value: 'budi@x.com' } });
    fireEvent.submit(screen.getByPlaceholderText('Name or email').closest('form')!);

    await waitFor(() => expect(cloud.shareLocations).toHaveBeenCalledWith(['a', 'b'], 'budi@x.com'));
  });

  it('Admin: unlimited, with an All Users tab listing every account', async () => {
    mockUser('Free', true);
    vi.mocked(cloud.fetchAllLocations).mockResolvedValue([
      { ...location('x', { userId: 'someone', name: 'Their Camp' }), ownerName: null, ownerEmail: 'someone@x.com' },
    ]);
    await renderOpen();
    expect(await screen.findByText('1 · Unlimited')).toBeInTheDocument();
    expect(screen.queryByText(/Sharing with other users needs/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByText(/All Users/));
    expect(await screen.findByText('Their Camp')).toBeInTheDocument();
    expect(screen.getByText('By someone@x.com')).toBeInTheDocument();
    expect(screen.getByTitle('Edit')).toBeInTheDocument();
    expect(screen.getByTitle('Delete')).toBeInTheDocument();
  });

  it('validates and saves a new location', async () => {
    mockUser('Pro');
    vi.mocked(cloud.createLocation).mockImplementation(async (input) => location('new', input));
    await renderOpen([]);
    fireEvent.click(await screen.findByRole('button', { name: /Add/ }));

    fireEvent.change(screen.getByPlaceholderText('e.g. Pos 3 Gunung Gede'), { target: { value: 'Mata Air' } });
    fireEvent.click(screen.getByText('Save Location'));
    expect(await screen.findByText(/Set a valid position/)).toBeInTheDocument();
    expect(cloud.createLocation).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTitle('Water Source'));
    fireEvent.change(screen.getByLabelText('Latitude'), { target: { value: '-6.78' } });
    fireEvent.change(screen.getByLabelText('Longitude'), { target: { value: '106.98' } });
    fireEvent.change(screen.getByLabelText('Elevation'), { target: { value: '2100' } });
    // Optional fields start hidden
    expect(screen.queryByPlaceholderText(/Comma separated/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Optional details/ }));
    fireEvent.change(screen.getByPlaceholderText(/Comma separated/), { target: { value: 'water, water, spring' } });
    fireEvent.click(screen.getByText('Save Location'));

    await waitFor(() =>
      expect(cloud.createLocation).toHaveBeenCalledWith({
        name: 'Mata Air',
        category: 'water',
        lat: -6.78,
        lng: 106.98,
        elevationM: 2100,
        address: '',
        contact: '',
        description: '',
        tags: ['water', 'spring'],
      }),
    );
    expect(await screen.findByText('Mata Air')).toBeInTheDocument();
  });

  it('fills the position from a point picked on the map', async () => {
    mockUser('Pro');
    await renderOpen([]);
    fireEvent.click(await screen.findByRole('button', { name: /Add/ }));
    fireEvent.click(screen.getByText('Pick on map'));
    expect(await screen.findByText('Tap the map to place the location')).toBeInTheDocument();

    useMarkedLocationStore.getState().setPickedPoint({ lng: 106.123456789, lat: -6.5, elevationM: 812.4 });
    expect(await screen.findByDisplayValue('106.123457')).toBeInTheDocument();
    expect(screen.getByDisplayValue('-6.5')).toBeInTheDocument();
    expect(screen.getByDisplayValue('812.4')).toBeInTheDocument();
  });
});
