import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getVisibleLocations, useMarkedLocationStore } from './useMarkedLocationStore';
import * as cloud from '../services/markedLocationSync';
import type { AdminMarkedLocation, MarkedLocation, SharedMarkedLocation } from '../types/markedLocation';

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
}));

const store = () => useMarkedLocationStore.getState();

const location = (id: string, overrides: Partial<MarkedLocation> = {}): MarkedLocation => ({
  id,
  userId: 'me',
  name: `Location ${id}`,
  category: 'poi',
  lng: 107,
  lat: -7,
  elevationM: null,
  description: null,
  address: null,
  contact: null,
  tags: [],
  createdAt: 0,
  updatedAt: 0,
  ...overrides,
});

const shared = (id: string): SharedMarkedLocation => ({
  ...location(id, { userId: 'friend' }),
  ownerName: 'Friend',
  ownerEmailMasked: 'f***@x.com',
  sharedAt: 0,
});

const input = { name: 'New', category: 'camp' as const, lng: 1, lat: 2, elevationM: null, description: null, address: null, contact: null, tags: [] };

describe('useMarkedLocationStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store().reset();
    vi.mocked(cloud.fetchMyLocations).mockResolvedValue([location('a')]);
    vi.mocked(cloud.fetchSharedWithMe).mockResolvedValue([shared('s1')]);
  });

  it('loads own and shared locations on init, and clears everything on reset', async () => {
    await store().init('me');
    expect(cloud.fetchMyLocations).toHaveBeenCalledWith('me');
    expect(store().locations.map((l) => l.id)).toEqual(['a']);
    expect(store().sharedLocations.map((l) => l.id)).toEqual(['s1']);

    store().reset();
    expect(store().userId).toBeNull();
    expect(store().locations).toEqual([]);
    expect(store().sharedLocations).toEqual([]);
  });

  it('discards results that arrive after the user changed', async () => {
    let resolve!: (value: MarkedLocation[]) => void;
    vi.mocked(cloud.fetchMyLocations).mockReturnValueOnce(new Promise((r) => (resolve = r)));
    const pending = store().init('me');
    store().reset();
    resolve([location('stale')]);
    await pending;
    expect(store().locations).toEqual([]);
  });

  it('stores load errors', async () => {
    vi.mocked(cloud.fetchMyLocations).mockRejectedValueOnce(new Error('offline'));
    await store().init('me');
    expect(store().error).toBe('offline');
  });

  it('adds created locations first and clears the picked point', async () => {
    await store().init('me');
    store().setPickedPoint({ lng: 1, lat: 2, elevationM: 5 });
    vi.mocked(cloud.createLocation).mockResolvedValue(location('b'));
    await store().createLocation(input);
    expect(store().locations.map((l) => l.id)).toEqual(['b', 'a']);
    expect(store().pickedPoint).toBeNull();
  });

  it('surfaces the plan limit error from the database', async () => {
    await store().init('me');
    vi.mocked(cloud.createLocation).mockRejectedValue(
      new Error('You have reached the maximum of 10 marked locations for your plan.'),
    );
    await expect(store().createLocation(input)).rejects.toThrow('maximum of 10');
    expect(store().locations).toHaveLength(1);
  });

  it('updates a location in both my list and the admin list', async () => {
    await store().init('me');
    useMarkedLocationStore.setState({
      adminLocations: [{ ...location('a'), ownerName: 'Me', ownerEmail: 'me@x.com' }],
    });
    vi.mocked(cloud.updateLocation).mockResolvedValue(location('a', { name: 'Renamed' }));
    await store().updateLocation('a', { ...input, name: 'Renamed' });
    expect(store().locations[0].name).toBe('Renamed');
    expect(store().adminLocations[0]).toMatchObject({ name: 'Renamed', ownerEmail: 'me@x.com' });
  });

  it('deletes a location and clears its selection', async () => {
    await store().init('me');
    store().select('a');
    vi.mocked(cloud.deleteLocation).mockResolvedValue(undefined);
    await store().deleteLocation('a');
    expect(store().locations).toEqual([]);
    expect(store().selectedId).toBeNull();
  });

  it('removes a shared location from my list by deleting my own share', async () => {
    await store().init('me');
    vi.mocked(cloud.removeShare).mockResolvedValue(undefined);
    await store().leaveShared('s1');
    expect(cloud.removeShare).toHaveBeenCalledWith('s1', 'me');
    expect(store().sharedLocations).toEqual([]);
  });

  it('stops picking when a point is set or the panel closes', () => {
    store().setPanelOpen(true);
    store().startPicking();
    expect(store().isPicking).toBe(true);
    store().setPickedPoint({ lng: 1, lat: 2, elevationM: null });
    expect(store().isPicking).toBe(false);

    store().startPicking();
    store().setPanelOpen(false);
    expect(store().isPicking).toBe(false);
  });
});

describe('getVisibleLocations', () => {
  const admin = (id: string, userId = 'other'): AdminMarkedLocation => ({
    ...location(id, { userId }),
    ownerName: null,
    ownerEmail: `${userId}@x.com`,
  });

  it('shows mine and shared; admin locations only when toggled', () => {
    const state = {
      locations: [location('a')],
      sharedLocations: [shared('s1')],
      adminLocations: [admin('x'), admin('a', 'me'), admin('s1', 'friend')],
      showAllOnMap: false,
    };
    expect(getVisibleLocations(state).map((v) => v.location.id)).toEqual(['s1', 'a']);

    const all = getVisibleLocations({ ...state, showAllOnMap: true });
    expect(all).toHaveLength(3); // a and s1 are not duplicated
    expect(all.find((v) => v.location.id === 'a')?.kind).toBe('mine');
    expect(all.find((v) => v.location.id === 's1')).toMatchObject({ kind: 'shared', owner: 'Friend' });
    expect(all.find((v) => v.location.id === 'x')).toMatchObject({ kind: 'other', owner: 'other@x.com' });
  });
});
