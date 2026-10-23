import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { canRecordTracks, useTrackRecorderStore } from './useTrackRecorderStore';
import * as localDb from '../utils/trackRecorderDb';
import * as cloud from '../services/trackRecorderSync';

vi.mock('../services/trackRecorderSync', () => ({
  uploadTrack: vi.fn(),
  fetchRemoteTracks: vi.fn(),
  fetchRemotePoints: vi.fn(),
  renameRemoteTrack: vi.fn(),
  deleteRemoteTrack: vi.fn(),
  fetchSharedWithMe: vi.fn(),
  shareTrack: vi.fn(),
  listShares: vi.fn(),
  revokeShare: vi.fn(),
  leaveSharedTrack: vi.fn(),
}));

const store = () => useTrackRecorderStore.getState();
let userCounter = 0;
let clock = 1_700_000_000_000;

// Walk north ~11 m every 5 s
const walk = (steps: number, alt = 1000) => {
  for (let i = 0; i < steps; i++) {
    clock += 5_000;
    store().recordFix({
      lat: -7.6 - (clock / 5_000) * 0.0001,
      lng: 110.45,
      alt: alt + i,
      accuracy: 5,
      speed: 2,
      timestamp: clock,
    });
  }
};

const setOnline = (online: boolean) =>
  Object.defineProperty(navigator, 'onLine', { value: online, configurable: true });

describe('useTrackRecorderStore', () => {
  let userId: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(cloud.fetchRemoteTracks).mockResolvedValue([]);
    vi.mocked(cloud.uploadTrack).mockResolvedValue(undefined);
    vi.mocked(cloud.deleteRemoteTrack).mockResolvedValue(undefined);
    vi.mocked(cloud.fetchSharedWithMe).mockResolvedValue([]);
    setOnline(true);
    store().reset();
    userId = `user-${++userCounter}`;
    await store().init(userId);
  });

  afterEach(() => setOnline(true));

  it('allows only Enterprise and admin accounts to record', () => {
    expect(canRecordTracks({ hasUser: true, subscriptionStatus: 'Free', isAdmin: false })).toBe(false);
    expect(canRecordTracks({ hasUser: true, subscriptionStatus: 'Pro', isAdmin: false })).toBe(false);
    expect(canRecordTracks({ hasUser: true, subscriptionStatus: 'Enterprise', isAdmin: false })).toBe(true);
    expect(canRecordTracks({ hasUser: true, subscriptionStatus: 'Free', isAdmin: true })).toBe(true);
    expect(canRecordTracks({ hasUser: false, subscriptionStatus: 'Enterprise', isAdmin: false })).toBe(false);
  });

  it('records an offline track on the device without uploading it', async () => {
    await store().startTrack('Offline hike', 'offline');
    walk(3);
    await store().stopTrack();

    const [saved] = await localDb.listTracks(userId);
    expect(saved).toMatchObject({ name: 'Offline hike', status: 'completed', mode: 'offline', syncStatus: 'local', pointCount: 3 });
    expect(saved.distanceM).toBeGreaterThan(20);
    expect(await localDb.getPoints(saved.id)).toHaveLength(3);
    expect(cloud.uploadTrack).not.toHaveBeenCalled();
    expect(store().activeTrack).toBeNull();
  });

  it('uploads an online track when it finishes', async () => {
    await store().startTrack('Online hike', 'online');
    walk(2);
    await store().stopTrack();

    expect(cloud.uploadTrack).toHaveBeenCalledTimes(1);
    const [track, points] = vi.mocked(cloud.uploadTrack).mock.calls[0];
    expect(track.status).toBe('completed');
    expect(points).toHaveLength(2);
    const [saved] = await localDb.listTracks(userId);
    expect(saved.syncStatus).toBe('synced');
  });

  it('keeps an online track on the device as pending when there is no signal', async () => {
    setOnline(false);
    await store().startTrack('No signal', 'online');
    walk(2);
    await store().stopTrack();

    expect(cloud.uploadTrack).not.toHaveBeenCalled();
    const [saved] = await localDb.listTracks(userId);
    expect(saved.syncStatus).toBe('pending');

    // Back online: pending online tracks are retried
    setOnline(true);
    await store().syncPending();
    expect(cloud.uploadTrack).toHaveBeenCalledTimes(1);
    expect((await localDb.listTracks(userId))[0].syncStatus).toBe('synced');
  });

  it('marks a failed upload as error and keeps the data on the device', async () => {
    vi.mocked(cloud.uploadTrack).mockRejectedValueOnce(new Error('network down'));
    await store().startTrack('Flaky', 'online');
    walk(2);
    await store().stopTrack();

    const [saved] = await localDb.listTracks(userId);
    expect(saved).toMatchObject({ syncStatus: 'error', syncError: 'network down' });
    expect(await localDb.getPoints(saved.id)).toHaveLength(2);
  });

  it('starts a new segment after resume so the pause is not counted', async () => {
    await store().startTrack('Paused', 'offline');
    walk(2);
    const distanceBeforePause = store().activeTrack!.distanceM;
    await store().pauseTrack();

    walk(2); // ignored while paused
    expect(store().activeTrack!.pointCount).toBe(2);

    clock += 600_000;
    await store().resumeTrack();
    walk(2);

    const points = store().activePoints;
    expect(points.map((p) => p.segment)).toEqual([0, 0, 1, 1]);
    // Only the distance inside each segment counts
    expect(store().activeTrack!.distanceM).toBeCloseTo(distanceBeforePause * 2, 0);
  });

  it('recovers an interrupted recording as paused after a reload', async () => {
    await store().startTrack('Interrupted', 'offline');
    walk(3);
    await store().pauseTrack();
    await store().resumeTrack();
    walk(1);
    const id = store().activeTrack!.id;
    await localDb.getPoints(id); // wait for queued writes

    // Simulate an app restart
    store().reset();
    await store().init(userId);

    const recovered = store().activeTrack!;
    expect(recovered.id).toBe(id);
    expect(recovered.status).toBe('paused');
    expect(recovered.pointCount).toBe(4);
    expect(store().activePoints).toHaveLength(4);
    expect(store().isPanelOpen).toBe(true);
  });

  it('discards a recording and its points', async () => {
    await store().startTrack('Discard me', 'offline');
    walk(2);
    const id = store().activeTrack!.id;
    await store().discardTrack();

    expect(store().activeTrack).toBeNull();
    expect(await localDb.getTrack(id)).toBeUndefined();
    expect(await localDb.getPoints(id)).toHaveLength(0);
  });

  it('deletes the cloud copy first and keeps the local track if that fails', async () => {
    await store().startTrack('Synced', 'online');
    walk(2);
    await store().stopTrack();
    const id = (await localDb.listTracks(userId))[0].id;

    vi.mocked(cloud.deleteRemoteTrack).mockRejectedValueOnce(new Error('offline'));
    await store().deleteTrack(id);
    expect(await localDb.getTrack(id)).toBeDefined();
    expect(store().error).toMatch(/cloud copy/);

    await store().deleteTrack(id);
    expect(cloud.deleteRemoteTrack).toHaveBeenCalledTimes(2);
    expect(await localDb.getTrack(id)).toBeUndefined();
  });

  it('lists cloud-only tracks next to device tracks', async () => {
    vi.mocked(cloud.fetchRemoteTracks).mockResolvedValueOnce([
      {
        id: 'remote-1', userId, name: 'From phone', mode: 'online', status: 'completed',
        startedAt: 1, endedAt: 2, elapsedMs: 1, lastResumedAt: null, distanceM: 10, movingTimeMs: 1,
        elevationGainM: 0, elevationLossM: 0, maxAltM: null, minAltM: null, pointCount: 2,
        syncStatus: 'remote', syncError: null, syncedAt: 2, updatedAt: 2,
      },
    ]);
    await store().startTrack('Local', 'offline');
    await store().stopTrack();
    await store().loadTracks();

    expect(store().tracks.map((t) => [t.name, t.syncStatus])).toEqual([
      ['Local', 'local'],
      ['From phone', 'remote'],
    ]);
  });

  it('exports GPX for a saved track', async () => {
    await store().startTrack('Export me', 'offline');
    walk(2);
    await store().stopTrack();
    const id = (await localDb.listTracks(userId))[0].id;

    const { filename, content } = await store().exportGpx(id);
    expect(filename).toBe('Export_me.gpx');
    expect(content.match(/<trkpt /g)).toHaveLength(2);
  });

  describe('sharing', () => {
    const sharedTrack = (overrides = {}) => ({
      id: 'shared-1', userId: 'someone-else', name: 'Friend hike', mode: 'online' as const, status: 'completed' as const,
      startedAt: 1, endedAt: 2, elapsedMs: 1, lastResumedAt: null, distanceM: 10, movingTimeMs: 1,
      elevationGainM: 0, elevationLossM: 0, maxAltM: null, minAltM: null, pointCount: 2,
      syncStatus: 'remote' as const, syncError: null, syncedAt: 2, updatedAt: 2,
      ownerEmail: 'friend@example.com', sharedAt: 3,
      ...overrides,
    });

    it('uploads an offline track before sharing it', async () => {
      vi.mocked(cloud.shareTrack).mockResolvedValue({ userId: 'r1', email: 'r1@example.com', sharedAt: 1 });
      await store().startTrack('To share', 'offline');
      walk(2);
      await store().stopTrack();
      const id = (await localDb.listTracks(userId))[0].id;

      const share = await store().shareTrack(id, 'r1@example.com');

      expect(cloud.uploadTrack).toHaveBeenCalledTimes(1);
      expect(cloud.shareTrack).toHaveBeenCalledWith(id, 'r1@example.com');
      expect(share.email).toBe('r1@example.com');
      expect((await localDb.getTrack(id))?.syncStatus).toBe('synced');
    });

    it('does not share when the upload fails', async () => {
      vi.mocked(cloud.uploadTrack).mockRejectedValueOnce(new Error('network down'));
      await store().startTrack('Will fail', 'offline');
      walk(2);
      await store().stopTrack();
      const id = (await localDb.listTracks(userId))[0].id;

      await expect(store().shareTrack(id, 'r1@example.com')).rejects.toThrow(/network down/);
      expect(cloud.shareTrack).not.toHaveBeenCalled();
    });

    it('refuses to share without a connection', async () => {
      await store().startTrack('Offline share', 'offline');
      await store().stopTrack();
      const id = (await localDb.listTracks(userId))[0].id;
      setOnline(false);

      await expect(store().shareTrack(id, 'r1@example.com')).rejects.toThrow(/internet/);
    });

    it('revokes a recipient', async () => {
      vi.mocked(cloud.revokeShare).mockResolvedValue(undefined);
      await store().revokeShare('track-1', 'r1');
      expect(cloud.revokeShare).toHaveBeenCalledWith('track-1', 'r1');
    });

    it('loads tracks shared with me, opens them from the cloud, and keeps them read-only', async () => {
      vi.mocked(cloud.fetchSharedWithMe).mockResolvedValue([sharedTrack()]);
      vi.mocked(cloud.fetchRemotePoints).mockResolvedValue([
        { lat: -7.6, lng: 110.45, alt: 1000, accuracy: 5, speed: null, timestamp: 1, segment: 0 },
      ]);
      await store().loadSharedTracks();
      expect(store().sharedTracks.map((t) => t.ownerEmail)).toEqual(['friend@example.com']);

      await store().viewTrack('shared-1');
      expect(cloud.fetchRemotePoints).toHaveBeenCalledWith('shared-1');
      expect(store().viewing?.track.id).toBe('shared-1');

      // Not the owner: rename, delete and sync are ignored
      await store().renameTrack('shared-1', 'Mine now');
      await store().deleteTrack('shared-1');
      await store().syncTrack('shared-1');
      expect(cloud.renameRemoteTrack).not.toHaveBeenCalled();
      expect(cloud.deleteRemoteTrack).not.toHaveBeenCalled();
      expect(cloud.uploadTrack).not.toHaveBeenCalled();
      await expect(store().shareTrack('shared-1', 'x@example.com')).rejects.toThrow(/your own/);
    });

    it('removes a shared track from my list', async () => {
      vi.mocked(cloud.fetchSharedWithMe).mockResolvedValue([sharedTrack()]);
      vi.mocked(cloud.leaveSharedTrack).mockResolvedValue(undefined);
      await store().loadSharedTracks();

      await store().leaveSharedTrack('shared-1');
      expect(cloud.leaveSharedTrack).toHaveBeenCalledWith('shared-1', userId);
      expect(store().sharedTracks).toHaveLength(0);
    });
  });
});
