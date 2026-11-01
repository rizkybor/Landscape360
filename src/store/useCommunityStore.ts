import { create } from 'zustand';
import type { LngLat } from '../types/markedArea';
import type { Attachment, CommunityPost, FeedPost } from '../lib/community';

// Community panel and map layer state (COMMUNITY_PRD.md). Posts are read from the server each
// time; nothing here is kept in the browser.

export type CommunityView = 'feed' | 'mine' | 'post' | 'compose' | 'reports' | 'clubs' | 'club';

interface CommunityStore {
  isPanelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  togglePanel: () => void;

  view: CommunityView;
  /** The list (tab) a post, the compose form or the reports came from, for the back button */
  listView: 'feed' | 'mine' | 'clubs';
  postId: string | null;
  /** A post being edited in the compose view (null: a new post) */
  editing: CommunityPost | null;
  openFeed: () => void;
  openPost: (id: string) => void;
  openCompose: (editing?: CommunityPost | null) => void;
  openReports: () => void;
  openMine: () => void;
  /** The club open in the club view */
  clubId: string | null;
  openClubs: () => void;
  openClub: (id: string) => void;
  /** The feed's audience: null for everyone's posts (and your clubs'), or one club */
  feedClub: string | null;
  setFeedClub: (id: string | null) => void;

  /** The map's visible box (west, south, east, north), for "Near the map" and the layer */
  viewBounds: [number, number, number, number] | null;
  setViewBounds: (b: [number, number, number, number]) => void;
  /** Posts drawn on the map */
  mapPosts: FeedPost[];
  setMapPosts: (posts: FeedPost[]) => void;
  /** The open post, drawn on the map with its attachment */
  focused: CommunityPost | null;
  setFocused: (post: CommunityPost | null) => void;

  /** Choosing where a new post is, by tapping the map */
  picking: boolean;
  picked: LngLat | null;
  startPicking: () => void;
  stopPicking: () => void;
  setPicked: (p: LngLat | null) => void;

  /** Phone: the sheet is lowered to its header so the map can be seen */
  lowered: boolean;
  setLowered: (lowered: boolean) => void;

  /** A club workspace item shown on the map (with the open post's attachment, if any) */
  shownItem: Attachment | null;
  setShownItem: (item: Attachment | null) => void;

  /** Bumped after a change, so the feed and the layer read the server again */
  version: number;
  refresh: () => void;
  /** Bumped when only the club list changed (e.g. its new-post counts), not the feed */
  clubsVersion: number;
  refreshClubs: () => void;
}

export const useCommunityStore = create<CommunityStore>((set) => ({
  isPanelOpen: false,
  setPanelOpen: (open) => set(open ? { isPanelOpen: true } : { isPanelOpen: false, picking: false, focused: null, shownItem: null }),
  togglePanel: () =>
    set((s) => (s.isPanelOpen ? { isPanelOpen: false, picking: false, focused: null, shownItem: null } : { isPanelOpen: true })),

  view: 'feed',
  listView: 'feed',
  postId: null,
  editing: null,
  openFeed: () => set({ view: 'feed', listView: 'feed', postId: null, editing: null, focused: null, shownItem: null }),
  openPost: (id) => set({ view: 'post', postId: id, editing: null, isPanelOpen: true, shownItem: null }),
  openCompose: (editing = null) => set({ view: 'compose', editing, picked: null, isPanelOpen: true }),
  openReports: () => set({ view: 'reports', postId: null, editing: null, focused: null }),
  openMine: () => set({ view: 'mine', listView: 'mine', postId: null, editing: null, focused: null, shownItem: null }),
  clubId: null,
  openClubs: () => set({ view: 'clubs', listView: 'clubs', clubId: null, postId: null, editing: null, focused: null }),
  openClub: (clubId) => set({ view: 'club', clubId, postId: null, editing: null, focused: null }),
  feedClub: null,
  setFeedClub: (feedClub) => set({ feedClub }),

  viewBounds: null,
  setViewBounds: (viewBounds) => set({ viewBounds }),
  mapPosts: [],
  setMapPosts: (mapPosts) => set({ mapPosts }),
  focused: null,
  setFocused: (focused) => set({ focused }),

  picking: false,
  picked: null,
  startPicking: () => set({ picking: true }),
  stopPicking: () => set({ picking: false }),
  setPicked: (picked) => set({ picked, picking: false }),

  lowered: false,
  setLowered: (lowered) => set({ lowered }),
  shownItem: null,
  setShownItem: (shownItem) => set({ shownItem }),

  version: 0,
  refresh: () => set((s) => ({ version: s.version + 1 })),
  clubsVersion: 0,
  refreshClubs: () => set((s) => ({ clubsVersion: s.clubsVersion + 1 })),
}));
