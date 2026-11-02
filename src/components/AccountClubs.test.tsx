import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AccountClubs } from './AccountClubs';
import { useCommunityStore } from '../store/useCommunityStore';
import { useTrackRecorderStore } from '../store/useTrackRecorderStore';
import { fetchMyClubs, type Club } from '../lib/community';

vi.mock('../lib/supabaseClient', () => ({ supabase: {} }));
vi.mock('../lib/community', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/community')>()),
  fetchMyClubs: vi.fn(),
  photoUrl: (p: string) => `https://cdn/${p}`,
}));

const club = (overrides: Partial<Club> = {}): Club => ({
  id: 'c1', name: 'Makopala UBL', description: null, role: 'owner', memberCount: 3, ownerName: 'Dodi', createdAt: 0,
  region: null, contact: null, photoPath: null, updatedAt: null, newPosts: 0, canManage: true,
  ...overrides,
});

describe('AccountClubs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCommunityStore.setState({ isPanelOpen: false, view: 'feed', clubId: null });
  });

  it('shows nothing when the account is in no club', async () => {
    vi.mocked(fetchMyClubs).mockResolvedValue([]);
    const { container } = render(<AccountClubs onOpen={() => undefined} />);
    await Promise.resolve();
    expect(container.innerHTML).toBe('');
  });

  it('lists each club with its logo, role and members', async () => {
    vi.mocked(fetchMyClubs).mockResolvedValue([
      club(),
      club({ id: 'c2', name: 'Wanadri', role: 'member', memberCount: 1, photoPath: 'clubs/c2.jpg' }),
    ]);
    render(<AccountClubs onOpen={() => undefined} />);
    expect(await screen.findByText('Makopala UBL')).toBeTruthy();
    expect(screen.getByText('Clubs')).toBeTruthy();
    expect(screen.getByText('Leader · 3 members')).toBeTruthy();
    expect(screen.getByText('Member · 1 member')).toBeTruthy();
    // Logo when the club has one, its initial otherwise
    expect(document.querySelector('img')?.getAttribute('src')).toBe('https://cdn/clubs/c2.jpg');
    expect(screen.getByText('M')).toBeTruthy();
  });

  it('opens the club in Community and closes the account menu', async () => {
    vi.mocked(fetchMyClubs).mockResolvedValue([club()]);
    useTrackRecorderStore.setState({ isPanelOpen: true });
    const onOpen = vi.fn();
    render(<AccountClubs onOpen={onOpen} />);
    expect(await screen.findByText('Club')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Makopala UBL/ }));
    expect(onOpen).toHaveBeenCalled();
    expect(useCommunityStore.getState()).toMatchObject({ isPanelOpen: true, view: 'club', clubId: 'c1' });
    expect(useTrackRecorderStore.getState().isPanelOpen).toBe(false);
  });
});
