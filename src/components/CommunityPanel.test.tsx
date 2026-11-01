import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CommunityPanel } from './CommunityPanel';
import { useCommunityStore } from '../store/useCommunityStore';
import { useSurveyStore } from '../store/useSurveyStore';
import {
  decideParticipant,
  fetchChecklist,
  fetchClubEvent,
  fetchFeed,
  fetchLiveLatest,
  fetchMyClubs,
  fetchMyPosts,
  fetchParticipants,
  type ClubEvent,
  type FeedPost,
} from '../lib/community';

vi.mock('../lib/supabaseClient', () => ({ supabase: {} }));
vi.mock('../lib/community', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/community')>()),
  fetchFeed: vi.fn(),
  fetchMyClubs: vi.fn(() => Promise.resolve([])),
  fetchMyPosts: vi.fn(() => Promise.resolve([])),
  fetchClubEvent: vi.fn(),
  fetchParticipants: vi.fn(),
  fetchChecklist: vi.fn(),
  fetchLiveLatest: vi.fn(),
  fetchLiveTrail: vi.fn(() => Promise.resolve([])),
  decideParticipant: vi.fn(() => Promise.resolve()),
  markClubRead: vi.fn(() => Promise.resolve()),
  photoUrl: (p: string) => `https://cdn/${p}`,
}));

const post = (over: Partial<FeedPost>): FeedPost => ({
  id: 'p1',
  kind: 'report',
  title: null,
  body: 'Sumber air Kandang Badak kering',
  truncated: false,
  conditions: ['water_dry'],
  happenedOn: new Date().toISOString().slice(0, 10),
  lat: -6.7,
  lng: 106.9,
  placeName: 'Kandang Badak',
  attachmentKind: null,
  photos: [],
  helpfulCount: 4,
  commentCount: 2,
  createdAt: Date.now() - 2 * 3600000,
  editedAt: null,
  authorName: 'Budi S.',
  authorOrganization: null,
  isMine: false,
  iFoundHelpful: false,
  clubId: null,
  clubName: null,
  pinned: false,
  ...over,
});

const signIn = (signedIn: boolean) =>
  useSurveyStore.setState({ user: signedIn ? ({ id: 'u1' } as never) : null, isAdmin: false } as never);

describe('CommunityPanel', () => {
  beforeEach(() => {
    vi.mocked(fetchFeed).mockReset();
    useCommunityStore.setState({ isPanelOpen: true, view: 'feed', listView: 'feed', feedClub: null, viewBounds: [106, -7, 107, -6], lowered: false });
  });

  it('shows posts as cards with their conditions, place and stats', async () => {
    signIn(false);
    vi.mocked(fetchFeed).mockResolvedValue([
      post({}),
      post({ id: 'p2', kind: 'story', title: 'Gede via Putri', conditions: [], body: 'Cerita', photos: [{ path: 'u/p2-0.jpg', width: 10, height: 10 }] }),
    ]);
    render(<CommunityPanel />);
    expect(await screen.findByText('Sumber air Kandang Badak kering')).toBeTruthy();
    expect(screen.getByText('Gede via Putri')).toBeTruthy();
    expect(screen.getAllByText('Water source dry').length).toBeGreaterThan(0);
    expect(screen.getAllByText('· Kandang Badak', { exact: false })).toHaveLength(2);
    // Guests read, without tabs or the post button
    expect(screen.queryByRole('tab', { name: 'Mine' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Write a post' })).toBeNull();
    expect(screen.getByText(/Read freely/)).toBeTruthy();
  });

  it('filters by a condition chip and offers to clear it when nothing matches', async () => {
    signIn(false);
    vi.mocked(fetchFeed).mockResolvedValue([]);
    render(<CommunityPanel />);
    await screen.findByText('Quiet around here');
    fireEvent.click(screen.getByRole('button', { name: 'Landslide' }));
    await waitFor(() => expect(fetchFeed).toHaveBeenLastCalledWith(expect.objectContaining({ conditions: ['landslide'] })));
    expect(await screen.findByText('No posts match')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => expect(fetchFeed).toHaveBeenLastCalledWith(expect.objectContaining({ conditions: null })));
  });

  it('gives signed-in accounts the Feed / Clubs / Mine tabs and a post button', async () => {
    signIn(true);
    vi.mocked(fetchFeed).mockResolvedValue([post({})]);
    vi.mocked(fetchMyClubs).mockResolvedValue([]);
    render(<CommunityPanel />);
    await screen.findByText('Sumber air Kandang Badak kering');
    expect(screen.getByRole('button', { name: 'Write a post' })).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Mine' }));
    expect(await screen.findByText('You have not posted yet')).toBeTruthy();
    expect(fetchMyPosts).toHaveBeenCalled();
  });
});

describe('CommunityPanel event page', () => {
  const event: ClubEvent = {
    id: 'e1', clubId: 'c1', clubName: 'Makopala', title: 'Gede-Pangrango', description: 'Bawa jas hujan',
    startsAt: Date.now() - 3600000, endsAt: Date.now() + 86400000, state: 'running',
    meetingName: 'Cibodas', meetingLat: -6.74, meetingLng: 106.99, routeItemId: null, routeName: null,
    quota: 10, needsApproval: true, goingCount: 2, pendingCount: 1, createdByName: 'Dodi',
    myStatus: 'going', myEmergencyName: null, myEmergencyPhone: null, iAmSharing: false, canShare: true, canManage: true,
  };

  it('shows live positions, warns about someone not seen for an hour, and lets the organiser approve', async () => {
    signIn(true);
    vi.mocked(fetchClubEvent).mockResolvedValue(event);
    vi.mocked(fetchParticipants).mockResolvedValue([
      { userId: 'u2', name: 'Budi S.', organization: null, status: 'going', joinedAt: 0, isMe: false, emergencyName: 'Ibu', emergencyPhone: '0812 000', checkedCount: 1, sharing: true, lastSeenAt: Date.now() - 70 * 60000 },
      { userId: 'u3', name: 'Ani P.', organization: null, status: 'pending', joinedAt: 0, isMe: false, emergencyName: null, emergencyPhone: null, checkedCount: 0, sharing: false, lastSeenAt: null },
    ]);
    vi.mocked(fetchChecklist).mockResolvedValue([{ id: 'i1', label: 'Headlamp', checked: false, checkedCount: 1 }]);
    vi.mocked(fetchLiveLatest).mockResolvedValue([
      { userId: 'u2', name: 'Budi S.', lat: -6.75, lng: 106.96, accuracyM: 8, altitudeM: 1400, battery: 40, recordedAt: Date.now() - 70 * 60000, sharing: true, isMe: false },
    ]);
    useCommunityStore.setState({ isPanelOpen: true, view: 'event', eventId: 'e1', clubId: 'c1', lowered: false });
    render(<CommunityPanel />);
    expect(await screen.findByText('Gede-Pangrango')).toBeTruthy();
    expect(await screen.findByText(/Not seen for 70 min/)).toBeTruthy();
    expect(screen.getByText(/battery 40%/)).toBeTruthy();
    expect(screen.getByText(/Landscape 360 Mobile App/)).toBeTruthy();
    expect(screen.getByRole('link', { name: '0812 000' }).getAttribute('href')).toBe('tel:0812000');
    expect(useCommunityStore.getState().live?.positions).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(decideParticipant).toHaveBeenCalledWith('e1', 'u3', 'going'));
  });
});
