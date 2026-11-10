import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useState } from 'react';
import { FriendsButton, FriendsHost } from './FriendsPanel';
import { useFriendsStore } from '../store/useFriendsStore';
import { useSurveyStore } from '../store/useSurveyStore';
import { fetchChatMessages, fetchChatUnread, fetchFriends, fetchFriendRequests, type Friend } from '../lib/friends';

vi.mock('../lib/supabaseClient', () => ({ supabase: {} }));
vi.mock('../lib/friends', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/friends')>()),
  fetchChatUnread: vi.fn(),
  fetchFriends: vi.fn(),
  fetchFriendRequests: vi.fn(),
  fetchChatMessages: vi.fn(),
  markChatRead: vi.fn(() => Promise.resolve()),
}));

const signIn = (signedIn: boolean) =>
  useSurveyStore.setState({ user: signedIn ? ({ id: 'u1' } as never) : null } as never);

// The User Account menu: it closes (and unmounts the button) when Friends opens
const AccountMenu = () => {
  const [open, setOpen] = useState(true);
  return open ? <FriendsButton onOpen={() => setOpen(false)} /> : null;
};

describe('Friends', () => {
  beforeEach(async () => {
    // History moves of the previous test's closed panel arrive asynchronously
    await new Promise((r) => setTimeout(r, 30));
    vi.clearAllMocks();
    useFriendsStore.getState().reset();
    vi.mocked(fetchChatUnread).mockResolvedValue({ messages: 2, requests: 1 });
    vi.mocked(fetchFriends).mockResolvedValue([]);
    vi.mocked(fetchFriendRequests).mockResolvedValue([]);
  });

  it('keeps the panel open after the User Account menu closes', async () => {
    signIn(true);
    render(
      <>
        <AccountMenu />
        <FriendsHost />
      </>,
    );
    expect(await screen.findByText('2 new messages · 1 friend request')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Friends/ }));
    // The button is gone with the menu, the panel stays
    expect(screen.queryByText('2 new messages · 1 friend request')).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Friends' })).toBeTruthy();
    expect(await screen.findByText('No chats yet')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog', { name: 'Friends' })).toBeNull();
    expect(useFriendsStore.getState().isOpen).toBe(false);
  });

  it('shows nothing and clears the badge when signed out', async () => {
    signIn(true);
    const { container } = render(<FriendsHost />);
    await act(async () => undefined);
    expect(useFriendsStore.getState().unread).toEqual({ messages: 2, requests: 1 });
    useFriendsStore.getState().open();
    act(() => signIn(false));
    expect(container.innerHTML).toBe('');
    expect(useFriendsStore.getState()).toMatchObject({ isOpen: false, unread: { messages: 0, requests: 0 } });
  });

  it('opens a chat in a browser whose scrollIntoView returns a promise', async () => {
    signIn(true);
    const sari: Friend = {
      userId: 'f1', name: 'Sari W.', organization: null, since: 0, lastAt: 1000, lastKind: 'text', lastBody: 'Halo',
      lastFromMe: false, lastDeleted: false, unread: 1,
    };
    vi.mocked(fetchFriends).mockResolvedValue([sari]);
    vi.mocked(fetchChatMessages).mockResolvedValue([
      { id: 'm1', fromMe: false, kind: 'text', body: 'Besok jadi ke Gede?', data: null, createdAt: 1000, readAt: null, deleted: false, updatedAt: 1000 },
    ]);
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = (() => Promise.resolve()) as never;
    try {
      useFriendsStore.getState().open();
      const { unmount } = render(<FriendsHost />);
      fireEvent.click(await screen.findByText('Sari W.'));
      expect(await screen.findByText('Besok jadi ke Gede?')).toBeTruthy();
      // Leaving the chat runs the effects' cleanups (a promise there used to throw)
      unmount();
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });

  it('closes the chat, then Friends, with the Back button', async () => {
    signIn(true);
    const sari: Friend = {
      userId: 'f1', name: 'Sari W.', organization: null, since: 0, lastAt: 1000, lastKind: 'text', lastBody: 'Halo',
      lastFromMe: false, lastDeleted: false, unread: 0,
    };
    vi.mocked(fetchFriends).mockResolvedValue([sari]);
    vi.mocked(fetchChatMessages).mockResolvedValue([
      { id: 'm1', fromMe: false, kind: 'location', body: null, data: { lat: -6.74, lng: 106.98 }, createdAt: 1000, readAt: 1, deleted: false, updatedAt: 1000 },
    ]);
    const back = () =>
      act(async () => {
        const popped = new Promise((r) => window.addEventListener('popstate', r, { once: true }));
        window.history.back();
        await popped;
      });
    useFriendsStore.getState().open();
    render(<FriendsHost />);
    fireEvent.click(await screen.findByText('Sari W.'));
    expect(await screen.findByRole('button', { name: 'Back' })).toBeTruthy();

    await back();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Friends' })).toBeTruthy();

    await back();
    expect(screen.queryByRole('dialog', { name: 'Friends' })).toBeNull();
    expect(useFriendsStore.getState().isOpen).toBe(false);
  });

  it('goes back to the map for "Show on map"', async () => {
    signIn(true);
    vi.mocked(fetchFriends).mockResolvedValue([
      { userId: 'f1', name: 'Sari W.', organization: null, since: 0, lastAt: 1000, lastKind: 'location', lastBody: null, lastFromMe: false, lastDeleted: false, unread: 0 },
    ]);
    vi.mocked(fetchChatMessages).mockResolvedValue([
      { id: 'm1', fromMe: false, kind: 'location', body: null, data: { lat: -6.74, lng: 106.98 }, createdAt: 1000, readAt: 1, deleted: false, updatedAt: 1000 },
    ]);
    useFriendsStore.getState().open();
    render(<FriendsHost />);
    fireEvent.click(await screen.findByText('Sari W.'));
    fireEvent.click(await screen.findByText('Show on map'));
    expect(screen.queryByRole('dialog', { name: 'Friends' })).toBeNull();
  });
});
