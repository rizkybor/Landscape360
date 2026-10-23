import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TrackRecorderPanel } from './TrackRecorderPanel';
import { useSurveyStore } from '../store/useSurveyStore';
import { useTrackRecorderStore } from '../store/useTrackRecorderStore';

vi.mock('../store/useSurveyStore', () => ({
  useSurveyStore: vi.fn(),
}));

vi.mock('../services/trackRecorderSync', () => ({
  uploadTrack: vi.fn(),
  fetchRemoteTracks: vi.fn().mockResolvedValue([]),
  fetchRemotePoints: vi.fn(),
  renameRemoteTrack: vi.fn(),
  deleteRemoteTrack: vi.fn(),
  fetchSharedWithMe: vi.fn().mockResolvedValue([]),
  shareTrack: vi.fn(),
  listShares: vi.fn(),
  revokeShare: vi.fn(),
  leaveSharedTrack: vi.fn(),
}));

const mockAccount = (subscriptionStatus: string, isAdmin = false, signedIn = true) =>
  (useSurveyStore as any).mockReturnValue({
    user: signedIn ? { id: 'u1', email: 'u1@example.com' } : null,
    subscriptionStatus,
    isAdmin,
  });

describe('TrackRecorderPanel', () => {
  beforeEach(() => {
    useTrackRecorderStore.getState().reset();
    useTrackRecorderStore.setState({ userId: 'u1', isPanelOpen: true });
  });

  it('is hidden when signed out', () => {
    mockAccount('Enterprise', false, false);
    const { container } = render(<TrackRecorderPanel />);
    expect(container).toBeEmptyDOMElement();
  });

  it.each([['Free'], ['Pro']])('lets %s accounts view tracks but not record', (plan) => {
    mockAccount(plan);
    render(<TrackRecorderPanel />);
    expect(screen.getByText('Track Recorder')).toBeInTheDocument();
    expect(screen.getByText(/Recording tracks is available for Enterprise accounts/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Start Recording/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Shared/ })).toBeInTheDocument();
  });

  it.each([
    ['Enterprise', false],
    ['Free', true],
  ])('lets %s (admin: %s) record', (plan, isAdmin) => {
    mockAccount(plan, isAdmin);
    render(<TrackRecorderPanel />);
    expect(screen.getByRole('button', { name: /^Online/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Offline/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start Recording/i })).toBeInTheDocument();
  });

  it('lists tracks shared with me with the owner email', () => {
    mockAccount('Free');
    useTrackRecorderStore.setState({
      sharedTracks: [
        {
          id: 's1', userId: 'owner', name: 'Rinjani summit', mode: 'online', status: 'completed',
          startedAt: 1, endedAt: 2, elapsedMs: 1000, lastResumedAt: null, distanceM: 1500, movingTimeMs: 1000,
          elevationGainM: 120, elevationLossM: 0, maxAltM: null, minAltM: null, pointCount: 10,
          syncStatus: 'remote', syncError: null, syncedAt: 2, updatedAt: 2,
          ownerEmail: 'owner@example.com', sharedAt: 3,
        },
      ],
    });
    render(<TrackRecorderPanel />);
    fireEvent.click(screen.getByRole('button', { name: /^Shared/ }));
    expect(screen.getByText('Rinjani summit')).toBeInTheDocument();
    expect(screen.getByText('by owner@example.com')).toBeInTheDocument();
    expect(screen.getByTitle('Remove from my list')).toBeInTheDocument();
  });

  it('shows a compact REC indicator when hidden during a recording', async () => {
    mockAccount('Enterprise');
    await useTrackRecorderStore.getState().startTrack('Hike', 'offline');
    useTrackRecorderStore.setState({ isPanelOpen: false });

    render(<TrackRecorderPanel />);
    expect(screen.getByTitle('Open Track Recorder')).toHaveTextContent('REC');
  });
});
