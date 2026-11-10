import { create } from 'zustand';
import { fetchChatUnread } from '../lib/friends';

// Friends & Chat: whether the panel is open (it outlives the User Account menu that opens it)
// and the badge, unread messages and friend requests to me
interface FriendsStore {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  /** Bumped by "Show on map" in a chat: the phone lowers its Tools sheet to show the map */
  shownOnMap: number;
  showOnMap: () => void;
  unread: { messages: number; requests: number };
  refreshUnread: () => Promise<void>;
  reset: () => void;
}

const NONE = { messages: 0, requests: 0 };

export const useFriendsStore = create<FriendsStore>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  shownOnMap: 0,
  showOnMap: () => set((s) => ({ isOpen: false, shownOnMap: s.shownOnMap + 1 })),
  unread: NONE,
  refreshUnread: async () => {
    try {
      set({ unread: await fetchChatUnread() });
    } catch {
      // Not set up yet or offline: no badge
    }
  },
  reset: () => set({ isOpen: false, unread: NONE }),
}));
