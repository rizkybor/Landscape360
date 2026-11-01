import { supabase } from './supabaseClient';
import type { LngLat, MarkedArea } from '../types/markedArea';
import type { MarkedLocation } from '../types/markedLocation';
import type { TrackPoint } from '../types/trackRecorder';

// Community (COMMUNITY_PRD.md): trail reports and trip stories pinned to the map. Everything goes
// through the RPCs in 20261102000024_community.sql; the app (Landscape360M) uses the same
// catalogues, limits and attachment format.

export type PostKind = 'report' | 'story';

export const CONDITIONS = [
  { id: 'safe', label: 'Trail OK', color: '#365b25' },
  { id: 'muddy', label: 'Slippery / muddy', color: '#8a5a2b' },
  { id: 'landslide', label: 'Landslide', color: '#b4302a' },
  { id: 'fallen_tree', label: 'Fallen tree', color: '#7a4e0e' },
  { id: 'water_ok', label: 'Water available', color: '#2563eb' },
  { id: 'water_dry', label: 'Water source dry', color: '#e46c24' },
  { id: 'closed', label: 'Trail closed', color: '#7a201c' },
  { id: 'bad_weather', label: 'Bad weather', color: '#4b5563' },
  { id: 'wildlife', label: 'Wildlife', color: '#7c3aed' },
  { id: 'other', label: 'Other', color: '#7a7561' },
] as const;
export type ConditionId = (typeof CONDITIONS)[number]['id'];
export const conditionOf = (id: string) => CONDITIONS.find((c) => c.id === id) ?? CONDITIONS[CONDITIONS.length - 1];
export const MAX_CONDITIONS = 4;

export const REPORT_REASONS = [
  { id: 'misleading', label: 'Misleading or dangerous' },
  { id: 'spam', label: 'Spam' },
  { id: 'inappropriate', label: 'Inappropriate' },
  { id: 'privacy', label: 'Privacy' },
  { id: 'other', label: 'Other' },
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number]['id'];

export const BODY_LIMIT: Record<PostKind, number> = { report: 500, story: 5000 };
export const TITLE_LIMIT = 80;
/** Trail reports older than this are "old" and left off the map by default */
export const REPORT_FRESH_DAYS = 30;
export const MAX_TRACK_POINTS = 1500;
/** A post placed this close to where you are now shares your position: warn first */
export const NEAR_ME_METERS = 300;

export interface CommunityPhoto {
  path: string;
  width: number;
  height: number;
}

export type Attachment =
  | { kind: 'place'; name: string; category: string; geometry: { type: 'Point'; coordinates: LngLat } }
  | { kind: 'area'; name: string; color: string; geometry: { type: 'Polygon'; coordinates: LngLat[][] } }
  | { kind: 'track'; name: string; distance_m: number; geometry: { type: 'LineString'; coordinates: LngLat[] } }
  | { kind: 'classic'; name: string; token: string };

export interface FeedPost {
  id: string;
  kind: PostKind;
  title: string | null;
  body: string;
  truncated: boolean;
  conditions: ConditionId[];
  happenedOn: string; // yyyy-mm-dd
  lat: number;
  lng: number;
  placeName: string | null;
  attachmentKind: Attachment['kind'] | null;
  photos: CommunityPhoto[];
  helpfulCount: number;
  commentCount: number;
  createdAt: number;
  editedAt: number | null;
  authorName: string;
  authorOrganization: string | null;
  isMine: boolean;
  iFoundHelpful: boolean;
  /** A club post (seen only by its members), or null for everyone */
  clubId: string | null;
  clubName: string | null;
  /** Pinned on top of its club's feed (only reported in a club's feed) */
  pinned: boolean;
}

export interface CommunityPost extends Omit<FeedPost, 'truncated' | 'attachmentKind'> {
  attachment: Attachment | null;
  status: 'visible' | 'hidden' | 'removed';
  /** Your role in the post's club (null: not a club post, or not a member) */
  myClubRole: ClubRole | null;
}

export interface CommunityComment {
  id: string;
  body: string;
  createdAt: number;
  authorName: string;
  authorOrganization: string | null;
  isMine: boolean;
}

export interface CommunityLimits {
  reportsLeft: number | null; // null: no limit (admin)
  storiesLeft: number | null;
  photos: number;
  attachments: boolean;
  banned: boolean;
  clubsLeft: number | null; // null: no limit (admin)
  canCreateClubs: boolean;
}

/** Clubs: Enterprise accounts (and the admin) create them; any signed-in account can be a member */
export const CLUB_LIMITS = { Enterprise: 5, members: 200, pins: 3, items: 500, folders: 50, inviteDays: 7 } as const;

/** owner: the club leader (who created it); admin: a "pengurus" the leader names */
export type ClubRole = 'owner' | 'admin' | 'member';
export const ROLE_LABEL: Record<ClubRole, string> = { owner: 'Leader', admin: 'Admin', member: 'Member' };

export interface Club {
  id: string;
  name: string;
  description: string | null;
  role: ClubRole;
  memberCount: number;
  ownerName: string;
  createdAt: number;
  /** Home base, e.g. "Jakarta Selatan" */
  region: string | null;
  /** Instagram, website or WhatsApp, as typed by the leader */
  contact: string | null;
  photoPath: string | null;
  updatedAt: number | null;
  /** Posts by others since you last opened the club's feed */
  newPosts: number;
  /** You may manage it (leader or admin, while the leader is Enterprise) */
  canManage: boolean;
}

export interface ClubMember {
  userId: string;
  name: string;
  organization: string | null;
  /** Only filled in for the leader and admins */
  email: string | null;
  role: ClubRole;
  addedAt: number;
  isMe: boolean;
}

export interface ReportQueueItem {
  targetKind: 'post' | 'comment';
  targetId: string;
  postId: string;
  status: string;
  excerpt: string;
  authorId: string;
  authorName: string;
  reports: number;
  reasons: string[];
  notes: string[];
  lastReportedAt: number;
  authorBanned: boolean;
}

// --- Rules -------------------------------------------------------------------------------------

/** A trail report older than 30 days (by when it happened) */
export const isOldReport = (post: Pick<FeedPost, 'kind' | 'happenedOn'>, now = Date.now()) =>
  post.kind === 'report' && now - Date.parse(`${post.happenedOn}T00:00:00`) > REPORT_FRESH_DAYS * 86400000;

/** The author may edit for 24 hours */
export const canEdit = (post: Pick<CommunityPost, 'isMine' | 'createdAt'>, now = Date.now()) =>
  post.isMine && now - post.createdAt < 86400000;

/** Problems with a post before it is sent (the server checks again) */
export const postInputError = (input: { kind: PostKind; body: string; title: string; conditions: string[]; happenedOn: string; lat: number | null }) => {
  const body = input.body.trim();
  if (!body) return 'Write something first.';
  if (body.length > BODY_LIMIT[input.kind]) return `A ${input.kind === 'report' ? 'trail report' : 'story'} is at most ${BODY_LIMIT[input.kind]} characters.`;
  if (input.title.trim().length > TITLE_LIMIT) return `The title is at most ${TITLE_LIMIT} characters.`;
  if (input.kind === 'report' && input.conditions.length === 0) return 'Choose at least one trail condition.';
  if (input.conditions.length > MAX_CONDITIONS) return `Choose at most ${MAX_CONDITIONS} conditions.`;
  if (input.lat === null) return 'Set where it is on the map.';
  const day = Date.parse(`${input.happenedOn}T00:00:00`);
  if (!Number.isFinite(day)) return 'Choose the date.';
  if (day > Date.now() + 86400000) return 'The date cannot be in the future.';
  if (day < Date.now() - 366 * 86400000) return 'The date must be within the last year.';
  return null;
};

// --- Attachments (snapshots of your own map data) ----------------------------------------------

/** Evenly thins a line to at most `max` points, keeping the first and last */
export const thinLine = (coords: LngLat[], max = MAX_TRACK_POINTS): LngLat[] => {
  if (coords.length <= max) return coords;
  const step = (coords.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => coords[Math.round(i * step)]);
};

const r6 = (v: number) => Math.round(v * 1e6) / 1e6;

export const placeAttachment = (l: MarkedLocation): Attachment => ({
  kind: 'place',
  name: l.name,
  category: l.category,
  geometry: { type: 'Point', coordinates: [r6(l.lng), r6(l.lat)] },
});

export const areaAttachment = (a: MarkedArea): Attachment => ({
  kind: 'area',
  name: a.name,
  color: a.color,
  geometry: { type: 'Polygon', coordinates: [[...a.ring, a.ring[0]].map(([x, y]) => [r6(x), r6(y)] as LngLat)] },
});

/** A track snapshot: at most 1500 points on a post, more (WORKSPACE_TRACK_POINTS) in a club workspace */
export const trackAttachment = (name: string, distanceM: number, points: Pick<TrackPoint, 'lat' | 'lng'>[], maxPoints = MAX_TRACK_POINTS): Attachment => ({
  kind: 'track',
  name,
  distance_m: Math.round(distanceM),
  geometry: { type: 'LineString', coordinates: thinLine(points.map((p) => [r6(p.lng), r6(p.lat)] as LngLat), maxPoints) },
});
export const WORKSPACE_TRACK_POINTS = 5000;

export const classicAttachment = (name: string, token: string): Attachment => ({ kind: 'classic', name, token });

/** Where the attachment is, to draw it and to fit the map */
export const attachmentCoords = (a: Attachment | null): LngLat[] => {
  if (!a || a.kind === 'classic') return [];
  if (a.kind === 'place') return [a.geometry.coordinates];
  if (a.kind === 'area') return a.geometry.coordinates[0];
  return a.geometry.coordinates;
};

// --- Photos ------------------------------------------------------------------------------------

export const PHOTO_BUCKET = 'community-photos';
const MAX_SIDE = 1600;
const MAX_BYTES = 700 * 1024;

export const photoUrl = (path: string) => supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;

export interface CompressedPhoto {
  blob: Blob;
  width: number;
  height: number;
}

/**
 * Resizes to at most 1600 px and re-encodes as JPEG. Drawing to a canvas drops every bit of
 * metadata, including the camera's GPS position (EXIF). Lowers the quality until it fits.
 */
export const compressPhoto = async (file: Blob, maxSide = MAX_SIDE): Promise<CompressedPhoto> => {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  for (const quality of [0.8, 0.7, 0.6, 0.5]) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (blob && blob.size <= MAX_BYTES) return { blob, width, height };
  }
  throw new Error('This photo is too large even after compressing it.');
};

// --- Server ------------------------------------------------------------------------------------

const MISSING = /PGRST202|PGRST205|42P01|could not find the (function|table)|relation .* does not exist/i;
const fail = (error: { message: string; code?: string }) =>
  new Error(
    MISSING.test(`${error.code ?? ''} ${error.message}`) ? 'Community is not set up yet (run the 20261102000024 to 0028 migrations)' : error.message,
  );

type Row = Record<string, unknown>;
const toPost = (r: Row): FeedPost => ({
  id: r.id as string,
  kind: r.kind as PostKind,
  title: (r.title as string | null) ?? null,
  body: r.body as string,
  truncated: r.truncated === true,
  conditions: (r.conditions as ConditionId[] | null) ?? [],
  happenedOn: r.happened_on as string,
  lat: Number(r.lat),
  lng: Number(r.lng),
  placeName: (r.place_name as string | null) ?? null,
  attachmentKind: (r.attachment_kind as Attachment['kind'] | null) ?? null,
  photos: (r.photos as CommunityPhoto[] | null) ?? [],
  helpfulCount: Number(r.helpful_count ?? 0),
  commentCount: Number(r.comment_count ?? 0),
  createdAt: Date.parse(r.created_at as string),
  editedAt: r.edited_at ? Date.parse(r.edited_at as string) : null,
  authorName: (r.author_name as string) ?? 'Landscape 360 user',
  authorOrganization: (r.author_organization as string | null) ?? null,
  isMine: r.is_mine === true,
  iFoundHelpful: r.i_found_helpful === true,
  clubId: (r.club_id as string | null) ?? null,
  clubName: (r.club_name as string | null) ?? null,
  pinned: r.pinned === true,
});

export interface FeedQuery {
  bounds?: [number, number, number, number] | null; // west, south, east, north
  kinds?: PostKind[] | null;
  conditions?: ConditionId[] | null;
  since?: number | null;
  before?: number | null;
  limit?: number;
  /** Only this club's posts (null: everyone's posts and your clubs') */
  club?: string | null;
}

export const fetchFeed = async (q: FeedQuery = {}): Promise<FeedPost[]> => {
  const [w, s, e, n] = q.bounds ?? [null, null, null, null];
  const { data, error } = await supabase.rpc('community_feed', {
    p_west: w,
    p_south: s,
    p_east: e,
    p_north: n,
    p_kinds: q.kinds?.length ? q.kinds : null,
    p_conditions: q.conditions?.length ? q.conditions : null,
    p_since: q.since ? new Date(q.since).toISOString() : null,
    p_before: q.before ? new Date(q.before).toISOString() : null,
    p_limit: q.limit ?? 20,
    p_club: q.club ?? null,
  });
  if (error) throw fail(error);
  return ((data ?? []) as Row[]).map(toPost);
};

export type MyPost = FeedPost & { status: CommunityPost['status'] };

/** Your own posts, newest first, also hidden or removed ones (with their status) */
export const fetchMyPosts = async (before: number | null = null, limit = 20): Promise<MyPost[]> => {
  const { data, error } = await supabase.rpc('my_community_posts', {
    p_before: before ? new Date(before).toISOString() : null,
    p_limit: limit,
  });
  if (error) throw fail(error);
  return ((data ?? []) as Row[]).map((r) => ({ ...toPost(r), status: r.status as CommunityPost['status'] }));
};

export const fetchPost = async (id: string): Promise<CommunityPost | null> => {
  const { data, error } = await supabase.rpc('community_post', { p_id: id });
  if (error) throw fail(error);
  const r = ((data ?? []) as Row[])[0];
  if (!r) return null;
  const { truncated, attachmentKind, ...post } = toPost(r);
  void truncated;
  void attachmentKind;
  return {
    ...post,
    attachment: (r.attachment as Attachment | null) ?? null,
    status: r.status as CommunityPost['status'],
    myClubRole: (r.my_club_role as ClubRole | null) ?? null,
  };
};

export const fetchComments = async (postId: string): Promise<CommunityComment[]> => {
  const { data, error } = await supabase.rpc('community_comments', { p_post_id: postId });
  if (error) throw fail(error);
  return ((data ?? []) as Row[]).map((r) => ({
    id: r.id as string,
    body: r.body as string,
    createdAt: Date.parse(r.created_at as string),
    authorName: (r.author_name as string) ?? 'Landscape 360 user',
    authorOrganization: (r.author_organization as string | null) ?? null,
    isMine: r.is_mine === true,
  }));
};

export const fetchMyLimits = async (): Promise<CommunityLimits | null> => {
  const { data, error } = await supabase.rpc('my_community_limits');
  if (error) throw fail(error);
  const r = ((data ?? []) as Row[])[0];
  if (!r) return null;
  return {
    reportsLeft: r.reports_left === null ? null : Number(r.reports_left),
    storiesLeft: r.stories_left === null ? null : Number(r.stories_left),
    photos: Number(r.photos),
    attachments: r.attachments === true,
    banned: r.banned === true,
    clubsLeft: r.clubs_left === null || r.clubs_left === undefined ? null : Number(r.clubs_left),
    canCreateClubs: r.can_create_clubs === true,
  };
};

export interface NewPost {
  kind: PostKind;
  title: string;
  body: string;
  conditions: ConditionId[];
  happenedOn: string;
  lat: number;
  lng: number;
  placeName: string;
  attachment: Attachment | null;
  /** Post to this club only (null: everyone) */
  clubId: string | null;
}

/** Creates the post, then uploads its photos (to <user id>/<post id>-<n>.jpg) */
export const createPost = async (userId: string, post: NewPost, photos: CompressedPhoto[]): Promise<string> => {
  const { data, error } = await supabase.rpc('create_community_post', {
    p_kind: post.kind,
    p_title: post.title.trim() || null,
    p_body: post.body,
    p_conditions: post.conditions,
    p_happened_on: post.happenedOn,
    p_lat: post.lat,
    p_lng: post.lng,
    p_place_name: post.placeName.trim() || null,
    p_attachment: post.attachment,
    p_club_id: post.clubId,
  });
  if (error) throw fail(error);
  const id = data as string;
  for (const [n, photo] of photos.entries()) {
    const path = `${userId}/${id}-${n}.jpg`;
    const { error: upError } = await supabase.storage.from(PHOTO_BUCKET).upload(path, photo.blob, { contentType: 'image/jpeg', upsert: false });
    if (upError) throw new Error(`The post was saved, but a photo could not be uploaded: ${upError.message}`);
    const { error: rowError } = await supabase.rpc('add_community_photo', {
      p_post_id: id,
      p_path: path,
      p_width: photo.width,
      p_height: photo.height,
      p_size: photo.blob.size,
    });
    if (rowError) throw fail(rowError);
  }
  return id;
};

export const updatePost = async (id: string, edit: { title: string; body: string; conditions: ConditionId[]; placeName: string }) => {
  const { error } = await supabase.rpc('update_community_post', {
    p_id: id,
    p_title: edit.title.trim() || null,
    p_body: edit.body,
    p_conditions: edit.conditions,
    p_place_name: edit.placeName.trim() || null,
  });
  if (error) throw fail(error);
};

/** Deletes your post and its photo files */
export const deletePost = async (id: string) => {
  const { data, error } = await supabase.rpc('delete_community_post', { p_id: id });
  if (error) throw fail(error);
  const paths = (data as string[] | null) ?? [];
  if (paths.length) await supabase.storage.from(PHOTO_BUCKET).remove(paths);
};

export const toggleHelpful = async (postId: string): Promise<{ helpful: boolean; count: number }> => {
  const { data, error } = await supabase.rpc('toggle_community_helpful', { p_post_id: postId });
  if (error) throw fail(error);
  const r = ((data ?? []) as Row[])[0] ?? {};
  return { helpful: r.helpful === true, count: Number(r.helpful_count ?? 0) };
};

export const addComment = async (postId: string, body: string) => {
  const { error } = await supabase.rpc('add_community_comment', { p_post_id: postId, p_body: body });
  if (error) throw fail(error);
};

export const deleteComment = async (id: string) => {
  const { error } = await supabase.rpc('delete_community_comment', { p_id: id });
  if (error) throw fail(error);
};

export const reportItem = async (kind: 'post' | 'comment', id: string, reason: ReportReason, note: string) => {
  const { error } = await supabase.rpc('report_community', { p_kind: kind, p_id: id, p_reason: reason, p_note: note.trim() || null });
  if (error) throw fail(error);
};

// --- Clubs -------------------------------------------------------------------------------------

export const fetchMyClubs = async (): Promise<Club[]> => {
  const { data, error } = await supabase.rpc('my_community_clubs');
  if (error) throw fail(error);
  return ((data ?? []) as Row[]).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    description: (r.description as string | null) ?? null,
    role: r.role as Club['role'],
    memberCount: Number(r.member_count ?? 0),
    ownerName: (r.owner_name as string) ?? '',
    createdAt: Date.parse(r.created_at as string),
    region: (r.region as string | null) ?? null,
    contact: (r.contact as string | null) ?? null,
    photoPath: (r.photo_path as string | null) ?? null,
    updatedAt: r.updated_at ? Date.parse(r.updated_at as string) : null,
    newPosts: Number(r.new_posts ?? 0),
    canManage: r.can_manage === true,
  }));
};

export const fetchClubMembers = async (clubId: string): Promise<ClubMember[]> => {
  const { data, error } = await supabase.rpc('community_club_members', { p_club_id: clubId });
  if (error) throw fail(error);
  return ((data ?? []) as Row[]).map((r) => ({
    userId: r.user_id as string,
    name: (r.name as string) ?? 'Landscape 360 user',
    organization: (r.organization as string | null) ?? null,
    email: (r.email as string | null) ?? null,
    role: r.role as ClubMember['role'],
    addedAt: Date.parse(r.added_at as string),
    isMe: r.is_me === true,
  }));
};

export const createClub = async (name: string, description: string): Promise<string> => {
  const { data, error } = await supabase.rpc('create_community_club', { p_name: name, p_description: description.trim() || null });
  if (error) throw fail(error);
  return data as string;
};

export interface ClubProfile {
  name: string;
  description: string;
  region: string;
  contact: string;
}

/** The leader edits the club's name, description, home base and contact */
export const updateClub = async (id: string, profile: ClubProfile) => {
  const { error } = await supabase.rpc('update_community_club', {
    p_id: id,
    p_name: profile.name,
    p_description: profile.description.trim() || null,
    p_region: profile.region.trim() || null,
    p_contact: profile.contact.trim() || null,
  });
  if (error) throw fail(error);
};

export const CLUB_PHOTO_SIDE = 640;

/** Uploads a new club photo (or with null removes it) and removes the previous file */
export const setClubPhoto = async (userId: string, clubId: string, photo: CompressedPhoto | null) => {
  let path: string | null = null;
  if (photo) {
    path = `${userId}/club-${clubId}-${Date.now()}.jpg`;
    const { error: upError } = await supabase.storage.from(PHOTO_BUCKET).upload(path, photo.blob, { contentType: 'image/jpeg', upsert: false });
    if (upError) throw new Error(`The photo could not be uploaded: ${upError.message}`);
  }
  const { data, error } = await supabase.rpc('set_community_club_photo', { p_id: clubId, p_path: path });
  if (error) {
    if (path) await supabase.storage.from(PHOTO_BUCKET).remove([path]);
    throw fail(error);
  }
  const old = data as string | null;
  if (old) await supabase.storage.from(PHOTO_BUCKET).remove([old]);
};

/** A contact the leader typed, as a link when it looks like one (Instagram handle, site, phone) */
export const contactHref = (contact: string): string | null => {
  const c = contact.trim();
  if (/^https?:\/\//i.test(c)) return c;
  if (/^@[\w.]{1,30}$/.test(c)) return `https://instagram.com/${c.slice(1)}`;
  if (/^(\+?62|0)[\s-]?8[\d\s-]{7,14}$/.test(c)) return `https://wa.me/${c.replace(/[\s-]/g, '').replace(/^0/, '62').replace(/^\+/, '')}`;
  if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(c)) return `https://${c}`;
  return null;
};

/** Deletes the club, its posts and their photo files */
export const deleteClub = async (id: string) => {
  const { data, error } = await supabase.rpc('delete_community_club', { p_id: id });
  if (error) throw fail(error);
  const paths = (data as string[] | null) ?? [];
  if (paths.length) await supabase.storage.from(PHOTO_BUCKET).remove(paths);
};

/** Adds the account that uses this email; returns its display name */
export const addClubMember = async (clubId: string, email: string): Promise<string> => {
  const { data, error } = await supabase.rpc('add_community_club_member', { p_club_id: clubId, p_email: email.trim() });
  if (error) throw fail(error);
  return data as string;
};

/** The owner removes a member, or a member passes their own id to leave */
export const removeClubMember = async (clubId: string, userId: string) => {
  const { error } = await supabase.rpc('remove_community_club_member', { p_club_id: clubId, p_user_id: userId });
  if (error) throw fail(error);
};

/** The leader makes a member an admin, or an admin a member again */
export const setClubRole = async (clubId: string, userId: string, role: 'admin' | 'member') => {
  const { error } = await supabase.rpc('set_community_club_role', { p_club_id: clubId, p_user_id: userId, p_role: role });
  if (error) throw fail(error);
};

// Invite links: /?join=<token>, 7 days, a signed-in account that opens one joins

export interface ClubInvite {
  token: string;
  expiresAt: number;
  uses: number;
  createdByName: string;
}

export interface ClubInviteInfo {
  clubId: string;
  name: string;
  description: string | null;
  region: string | null;
  photoPath: string | null;
  memberCount: number;
  leaderName: string;
  valid: boolean;
  isMember: boolean;
}

export const joinUrl = (token: string, base = SITE) => `${base}/?join=${token}`;

/** The invite token in "?join=", or null */
export const parseJoinParam = (search: string): string | null => {
  const t = new URLSearchParams(search).get('join');
  return t && /^[0-9a-f]{32}$/.test(t) ? t : null;
};

export const createClubInvite = async (clubId: string): Promise<string> => {
  const { data, error } = await supabase.rpc('create_community_club_invite', { p_club_id: clubId });
  if (error) throw fail(error);
  return data as string;
};

export const fetchClubInvites = async (clubId: string): Promise<ClubInvite[]> => {
  const { data, error } = await supabase.rpc('community_club_invites', { p_club_id: clubId });
  if (error) throw fail(error);
  return ((data ?? []) as Row[]).map((r) => ({
    token: r.token as string,
    expiresAt: Date.parse(r.expires_at as string),
    uses: Number(r.uses ?? 0),
    createdByName: (r.created_by_name as string) ?? '',
  }));
};

export const revokeClubInvite = async (token: string) => {
  const { error } = await supabase.rpc('revoke_community_club_invite', { p_token: token });
  if (error) throw fail(error);
};

export const fetchInviteInfo = async (token: string): Promise<ClubInviteInfo | null> => {
  const { data, error } = await supabase.rpc('community_club_invite_info', { p_token: token });
  if (error) throw fail(error);
  const r = ((data ?? []) as Row[])[0];
  if (!r) return null;
  return {
    clubId: r.club_id as string,
    name: r.name as string,
    description: (r.description as string | null) ?? null,
    region: (r.region as string | null) ?? null,
    photoPath: (r.photo_path as string | null) ?? null,
    memberCount: Number(r.member_count ?? 0),
    leaderName: (r.leader_name as string) ?? '',
    valid: r.valid === true,
    isMember: r.is_member === true,
  };
};

/** Joins with an invite link; returns the club id */
export const joinClub = async (token: string): Promise<string> => {
  const { data, error } = await supabase.rpc('join_community_club', { p_token: token });
  if (error) throw fail(error);
  return data as string;
};

// Workspace: copies of members' map data, in folders, for the whole club

export interface ClubFolder {
  id: string;
  name: string;
  itemCount: number;
}

export interface ClubItem {
  id: string;
  folderId: string | null;
  kind: Attachment['kind'];
  name: string;
  note: string | null;
  distanceM: number | null;
  category: string | null;
  color: string | null;
  token: string | null;
  addedByName: string;
  isMine: boolean;
  createdAt: number;
}

export const fetchClubFolders = async (clubId: string): Promise<ClubFolder[]> => {
  const { data, error } = await supabase.rpc('community_club_folders', { p_club_id: clubId });
  if (error) throw fail(error);
  return ((data ?? []) as Row[]).map((r) => ({ id: r.id as string, name: r.name as string, itemCount: Number(r.item_count ?? 0) }));
};

export const fetchClubItems = async (clubId: string): Promise<ClubItem[]> => {
  const { data, error } = await supabase.rpc('community_club_items', { p_club_id: clubId });
  if (error) throw fail(error);
  return ((data ?? []) as Row[]).map((r) => {
    const sum = (r.summary as Record<string, unknown> | null) ?? {};
    return {
      id: r.id as string,
      folderId: (r.folder_id as string | null) ?? null,
      kind: r.kind as Attachment['kind'],
      name: r.name as string,
      note: (r.note as string | null) ?? null,
      distanceM: typeof sum.distance_m === 'number' ? sum.distance_m : null,
      category: typeof sum.category === 'string' ? sum.category : null,
      color: typeof sum.color === 'string' ? sum.color : null,
      token: typeof sum.token === 'string' ? sum.token : null,
      addedByName: (r.added_by_name as string) ?? '',
      isMine: r.is_mine === true,
      createdAt: Date.parse(r.created_at as string),
    };
  });
};

/** One item in full (its geometry), to show on the map or export */
export const fetchClubItemData = async (id: string): Promise<Attachment | null> => {
  const { data, error } = await supabase.rpc('community_club_item', { p_id: id });
  if (error) throw fail(error);
  return (data as Attachment | null) ?? null;
};

export const addClubItem = async (clubId: string, folderId: string | null, item: Attachment, note = ''): Promise<string> => {
  const { data, error } = await supabase.rpc('add_community_club_item', {
    p_club_id: clubId,
    p_folder_id: folderId,
    p_data: item,
    p_note: note.trim() || null,
  });
  if (error) throw fail(error);
  return data as string;
};

export const updateClubItem = async (id: string, edit: { name: string; note: string; folderId: string | null }) => {
  const { error } = await supabase.rpc('update_community_club_item', {
    p_id: id,
    p_name: edit.name,
    p_note: edit.note.trim() || null,
    p_folder_id: edit.folderId,
  });
  if (error) throw fail(error);
};

export const deleteClubItem = async (id: string) => {
  const { error } = await supabase.rpc('delete_community_club_item', { p_id: id });
  if (error) throw fail(error);
};

/** Creates a folder (id null) or renames one; returns its id */
export const saveClubFolder = async (clubId: string, id: string | null, name: string): Promise<string> => {
  const { data, error } = await supabase.rpc('save_community_club_folder', { p_club_id: clubId, p_id: id, p_name: name });
  if (error) throw fail(error);
  return data as string;
};

/** Deletes a folder; its items stay in the workspace */
export const deleteClubFolder = async (id: string) => {
  const { error } = await supabase.rpc('delete_community_club_folder', { p_id: id });
  if (error) throw fail(error);
};

// Pins and new posts

export const pinPost = async (postId: string, pinned: boolean) => {
  const { error } = await supabase.rpc('pin_community_post', { p_post_id: postId, p_pinned: pinned });
  if (error) throw fail(error);
};

/** You have seen the club's feed: its "new posts" count starts again */
export const markClubRead = async (clubId: string) => {
  const { error } = await supabase.rpc('mark_community_club_read', { p_club_id: clubId });
  if (error) throw fail(error);
};

// Export of workspace items

export type ItemFormat = 'geojson' | 'gpx' | 'kml';

const xml = (s: string) => s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]!);

export const itemFileName = (name: string, format: ItemFormat) =>
  `${name.trim().replace(/[^\w\- ]+/g, '').replace(/\s+/g, '_').slice(0, 60) || 'item'}.${format}`;

/** The item as a GeoJSON, GPX or KML file (Classic Field Works have no geometry: null) */
export const exportItem = (a: Attachment, format: ItemFormat): string | null => {
  if (a.kind === 'classic') return null;
  const coords = attachmentCoords(a);
  if (format === 'geojson') {
    const { geometry, ...props } = a;
    return JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: props, geometry }] }, null, 2);
  }
  const name = xml(a.name);
  if (format === 'gpx') {
    const pts = (tag: string) => coords.map(([lng, lat]) => `<${tag} lat="${lat}" lon="${lng}"/>`).join('');
    const body =
      a.kind === 'place'
        ? `<wpt lat="${coords[0][1]}" lon="${coords[0][0]}"><name>${name}</name></wpt>`
        : a.kind === 'area'
          ? `<rte><name>${name}</name>${pts('rtept')}</rte>`
          : `<trk><name>${name}</name><trkseg>${pts('trkpt')}</trkseg></trk>`;
    return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Landscape 360" xmlns="http://www.topografix.com/GPX/1/1">${body}</gpx>\n`;
  }
  const list = coords.map(([lng, lat]) => `${lng},${lat},0`).join(' ');
  const geom =
    a.kind === 'place'
      ? `<Point><coordinates>${list}</coordinates></Point>`
      : a.kind === 'area'
        ? `<Polygon><outerBoundaryIs><LinearRing><coordinates>${list}</coordinates></LinearRing></outerBoundaryIs></Polygon>`
        : `<LineString><tessellate>1</tessellate><coordinates>${list}</coordinates></LineString>`;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${name}</name><Placemark><name>${name}</name>${geom}</Placemark></Document></kml>\n`;
};

export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

// --- Admin -------------------------------------------------------------------------------------

export const fetchReportQueue = async (): Promise<ReportQueueItem[]> => {
  const { data, error } = await supabase.rpc('community_report_queue');
  if (error) throw fail(error);
  return ((data ?? []) as Row[]).map((r) => ({
    targetKind: r.target_kind as 'post' | 'comment',
    targetId: r.target_id as string,
    postId: r.post_id as string,
    status: r.status as string,
    excerpt: (r.excerpt as string) ?? '',
    authorId: r.author_id as string,
    authorName: (r.author_name as string) ?? '',
    reports: Number(r.reports),
    reasons: (r.reasons as string[]) ?? [],
    notes: (r.notes as string[]) ?? [],
    lastReportedAt: Date.parse(r.last_reported_at as string),
    authorBanned: r.author_banned === true,
  }));
};

export const moderate = async (kind: 'post' | 'comment', id: string, action: 'restore' | 'hide' | 'remove') => {
  const { error } = await supabase.rpc('moderate_community', { p_kind: kind, p_id: id, p_action: action });
  if (error) throw fail(error);
};

/** days: 7 etc.; null blocks until lifted; 0 lifts the block */
export const setBan = async (userId: string, days: number | null, reason = '') => {
  const { error } = await supabase.rpc('set_community_ban', { p_user_id: userId, p_reason: reason || null, p_days: days });
  if (error) throw fail(error);
};

// --- Links -------------------------------------------------------------------------------------

export const SITE = 'https://landscape360.jcdigital.co.id';
export const postUrl = (id: string, base = SITE) => `${base}/community/${id}`;

/** The post id in "?post=" (open on the map), or null */
export const parsePostParam = (search: string): string | null => {
  const id = new URLSearchParams(search).get('post');
  return id && /^[0-9a-f-]{36}$/.test(id) ? id : null;
};
