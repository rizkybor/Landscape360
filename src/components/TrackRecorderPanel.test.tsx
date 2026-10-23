import { render, screen } from '@testing-library/react';
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
}));

const mockAccount = (subscriptionStatus: string, isAdmin = false) =>
  (useSurveyStore as any).mockReturnValue({
    user: { id: 'u1', email: 'u1@example.com' },
    subscriptionStatus,
    isAdmin,
  });

describe('TrackRecorderPanel', () => {
  beforeEach(() => {
    useTrackRecorderStore.getState().reset();
    useTrackRecorderStore.setState({ userId: 'u1', isPanelOpen: true });
  });

  it('is not available for Free accounts', () => {
    mockAccount('Free');
    const { container } = render(<TrackRecorderPanel />);
    expect(container).toBeEmptyDOMElement();
  });

  it.each([
    ['Pro', false],
    ['Enterprise', false],
    ['Free', true],
  ])('is available for %s (admin: %s)', (plan, isAdmin) => {
    mockAccount(plan, isAdmin);
    render(<TrackRecorderPanel />);
    expect(screen.getByText('Track Recorder')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Online/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Offline/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start Recording/i })).toBeInTheDocument();
  });

  it('shows a compact REC indicator when hidden during a recording', async () => {
    mockAccount('Pro');
    await useTrackRecorderStore.getState().startTrack('Hike', 'offline');
    useTrackRecorderStore.setState({ isPanelOpen: false });

    render(<TrackRecorderPanel />);
    expect(screen.getByTitle('Open Track Recorder')).toHaveTextContent('REC');
  });
});
