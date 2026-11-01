import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CommunityPanel } from './CommunityPanel';
import { useCommunityStore } from '../store/useCommunityStore';
import { useSurveyStore } from '../store/useSurveyStore';
import { fetchFeed, fetchMyClubs, fetchMyPosts, type FeedPost } from '../lib/community';

vi.mock('../lib/supabaseClient', () => ({ supabase: {} }));
vi.mock('../lib/community', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/community')>()),
  fetchFeed: vi.fn(),
  fetchMyClubs: vi.fn(() => Promise.resolve([])),
  fetchMyPosts: vi.fn(() => Promise.resolve([])),
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
