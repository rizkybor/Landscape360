import { create } from 'zustand';
import type { LngLat } from '../types/markedArea';
import type { Annotation, AnnotationKind, Attachment, CommunityPost, FeedPost, LivePosition, SavedView } from '../lib/community';

// Community panel and map layer state (COMMUNITY_PRD.md). Posts are read from the server each
// time; nothing here is kept in the browser.

/** fit: bumped to fit the map to everyone's positions */
export interface LiveMap {
  positions: LivePosition[];
  trail: { userId: string; coords: LngLat[] } | null;
  fit: number;
}

export type CommunityView = 'feed' | 'mine' | 'post' | 'compose' | 'reports' | 'clubs' | 'club' | 'event';

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
  /** The event open in the event view (its club stays in clubId) */
  eventId: string | null;
  openEvent: (id: string) => void;
  /** Live positions of the open event's participants, and one participant's trail, for the map */
  live: LiveMap | null;
  setLive: (live: LiveMap | null) => void;

  /** The club map's drawings, shown while its tab is open (selected: highlighted, fitted) */
  clubMap: { annotations: Annotation[]; selectedId: string | null; fit: number } | null;
  setClubMap: (m: { annotations: Annotation[]; selectedId: string | null; fit: number } | null) => void;
  /** Drawing on the map: each tap adds a point (a pin or note keeps the last one) */
  draw: { kind: AnnotationKind; points: LngLat[]; color: string } | null;
  setDraw: (d: { kind: AnnotationKind; points: LngLat[]; color: string } | null) => void;
  /** Fly the map to a saved view (n bumps for the same view again) */
  cameraTo: { view: SavedView; n: number } | null;
  flyToView: (view: SavedView) => void;
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
  setPanelOpen: (open) => set(open ? { isPanelOpen: true } : { isPanelOpen: false, picking: false, focused: null, shownItem: null, live: null, clubMap: null, draw: null }),
  togglePanel: () =>
    set((s) => (s.isPanelOpen ? { isPanelOpen: false, picking: false, focused: null, shownItem: null, live: null, clubMap: null, draw: null } : { isPanelOpen: true })),

  view: 'feed',
  listView: 'feed',
  postId: null,
  editing: null,
  openFeed: () =>
    set({ view: 'feed', listView: 'feed', postId: null, editing: null, focused: null, shownItem: null, live: null, clubMap: null, draw: null }),
  openPost: (id) => set({ view: 'post', postId: id, editing: null, isPanelOpen: true, shownItem: null }),
  openCompose: (editing = null) => set({ view: 'compose', editing, picked: null, isPanelOpen: true }),
  openReports: () => set({ view: 'reports', postId: null, editing: null, focused: null }),
  openMine: () => set({ view: 'mine', listView: 'mine', postId: null, editing: null, focused: null, shownItem: null }),
  clubId: null,
  openClubs: () => set({ view: 'clubs', listView: 'clubs', clubId: null, postId: null, editing: null, focused: null }),
  openClub: (clubId) => set({ view: 'club', clubId, postId: null, editing: null, focused: null, live: null, shownItem: null, draw: null }),
  eventId: null,
  openEvent: (eventId) => set({ view: 'event', eventId, postId: null, editing: null, focused: null, shownItem: null }),
  live: null,
  setLive: (live) => set({ live }),
  clubMap: null,
  setClubMap: (clubMap) => set({ clubMap }),
  draw: null,
  setDraw: (draw) => set({ draw }),
  cameraTo: null,
  flyToView: (view) => set((s) => ({ cameraTo: { view, n: (s.cameraTo?.n ?? 0) + 1 } })),
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
