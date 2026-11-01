import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ExternalLink,
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Crosshair,
  Flag,
  Folder,
  FolderPlus,
  Hexagon,
  Link2,
  Pin,
  Route,
  Eye,
  CalendarDays,
  Radio,
  Phone,
  Smartphone,
  Loader2,
  LocateFixed,
  Lock,
  MapPin,
  MessageCircle,
  MessagesSquare,
  Paperclip,
  Pencil,
  Plus,
  ShieldAlert,
  ThumbsUp,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useSurveyStore } from "../store/useSurveyStore";
import { useCommunityStore } from "../store/useCommunityStore";
import { useMapStore } from "../store/useMapStore";
import { useMarkedLocationStore } from "../store/useMarkedLocationStore";
import { useMarkedAreaStore } from "../store/useMarkedAreaStore";
import { useTrackRecorderStore } from "../store/useTrackRecorderStore";
import { useClassicStore } from "../store/useClassicStore";
import {
  BODY_LIMIT,
  CLUB_LIMITS,
  CONDITIONS,
  MAX_CONDITIONS,
  NEAR_ME_METERS,
  REPORT_REASONS,
  TITLE_LIMIT,
  addClubMember,
  addComment,
  areaAttachment,
  canEdit,
  classicAttachment,
  compressPhoto,
  conditionOf,
  createClub,
  createPost,
  deleteClub,
  deleteComment,
  deletePost,
  fetchClubMembers,
  fetchComments,
  fetchFeed,
  fetchMyClubs,
  fetchMyPosts,
  fetchMyLimits,
  fetchPost,
  fetchReportQueue,
  isEmail,
  isOldReport,
  moderate,
  photoUrl,
  placeAttachment,
  postInputError,
  postUrl,
  removeClubMember,
  reportItem,
  setBan,
  toggleHelpful,
  trackAttachment,
  updateClub,
  setClubPhoto,
  contactHref,
  CLUB_PHOTO_SIDE,
  ROLE_LABEL,
  EVENT_STATE_LABEL,
  LIVE_MISSING_MIN,
  LIVE_STALE_MIN,
  addChecklistItem,
  cancelClubEvent,
  decideParticipant,
  deleteChecklistItem,
  deleteClubEvent,
  eventInputError,
  fetchChecklist,
  fetchClubEvent,
  fetchClubEvents,
  fetchLiveLatest,
  fetchLiveTrail,
  fetchParticipants,
  joinClubEvent,
  leaveClubEvent,
  minutesAgo,
  saveClubEvent,
  stopLiveSharing,
  toggleCheck,
  trailSummary,
  WORKSPACE_TRACK_POINTS,
  addClubItem,
  createClubInvite,
  deleteClubFolder,
  deleteClubItem,
  exportItem,
  fetchClubFolders,
  fetchClubInvites,
  fetchClubItemData,
  fetchClubItems,
  itemFileName,
  joinUrl,
  markClubRead,
  pinPost,
  revokeClubInvite,
  saveClubFolder,
  setClubRole,
  updateClubItem,
  updatePost,
  type Attachment,
  type Club,
  type ClubMember,
  type ClubProfile,
  type ClubFolder,
  type ClubEvent,
  type ClubEventSummary,
  type ChecklistItem,
  type EventInput,
  type EventParticipant,
  type EventState,
  type LivePosition,
  type ClubInvite,
  type ClubItem,
  type ItemFormat,
  type CommunityComment,
  type CommunityLimits,
  type CommunityPost,
  type CompressedPhoto,
  type ConditionId,
  type FeedPost,
  type MyPost,
  type PostKind,
  type ReportQueueItem,
  type ReportReason,
} from "../lib/community";
import { whatsappShareUrl } from "../lib/shareLocation";
import { fetchRemotePoints } from "../services/trackRecorderSync";
import { getPoints } from "../utils/trackRecorderDb";
import { distanceKm, loadVillageIndex } from "../utils/villages";
import { saveBlob } from "../utils/contourFormats";
import type { LngLat } from "../types/markedArea";

const field =
  "w-full bg-sand-50 border border-sand-200 rounded-lg px-2.5 py-1.5 text-base sm:text-xs text-ink placeholder:text-sand-500 outline-none focus:border-gold-300";
const chip = (on: boolean) =>
  `cursor-pointer px-2 py-1 rounded-full text-[10px] font-bold border ${on ? "bg-forest-800 text-white border-forest-800" : "bg-white text-sand-700 border-sand-200 hover:border-gold-300"}`;

const ago = (t: number) => {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d < 30 ? `${d} d ago` : new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};
const day = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const ErrorLine = ({ text }: { text: string | null }) =>
  text ? <p className="text-[11px] p-2 rounded-lg border bg-brick-50 border-brick-200 text-brick-600">{text}</p> : null;

const ConditionChips = ({ ids }: { ids: string[] }) => (
  <span className="flex flex-wrap gap-1">
    {ids.map((id) => {
      const c = conditionOf(id);
      return (
        <span key={id} className="px-1.5 py-0.5 rounded-full text-[9px] font-bold text-white" style={{ backgroundColor: c.color }}>
          {c.label}
        </span>
      );
    })}
  </span>
);

const Byline = ({ p }: { p: Pick<FeedPost, "authorName" | "authorOrganization" | "createdAt" | "editedAt"> }) => (
  <span className="text-[10px] text-sand-500">
    {p.authorName}
    {p.authorOrganization ? ` · ${p.authorOrganization}` : ""} · {ago(p.createdAt)}
    {p.editedAt ? " · edited" : ""}
  </span>
);

const ClubBadge = ({ name }: { name: string }) => (
  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-forest-50 border border-forest-200 text-[9px] font-bold text-forest-800">
    <Lock size={8} /> {name}
  </span>
);

const NO_CLUBS: Club[] = [];

/** The signed-in account's clubs (empty for guests), read again after a change */
const useMyClubs = (signedIn: boolean) => {
  const version = useCommunityStore((s) => s.version);
  const clubsVersion = useCommunityStore((s) => s.clubsVersion);
  const [clubs, setClubs] = useState<Club[]>([]);
  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    fetchMyClubs().then(
      (c) => !cancelled && setClubs(c),
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [signedIn, version, clubsVersion]);
  return signedIn ? clubs : NO_CLUBS;
};

// --- Feed --------------------------------------------------------------------------------------

const kindColor = (p: Pick<FeedPost, "kind" | "conditions">) => (p.kind === "story" ? "#d49b22" : conditionOf(p.conditions[0] ?? "other").color);

const Initial = ({ name }: { name: string }) => (
  <span className="w-5 h-5 rounded-full bg-sand-100 border border-sand-200 text-[9px] font-bold text-sand-700 flex items-center justify-center shrink-0">
    {name.trim().charAt(0).toUpperCase() || "?"}
  </span>
);

/** One post in a list: a colour stripe for its condition (stories in gold), text, photo and stats */
const PostCard = ({ p, onOpen, status }: { p: FeedPost; onOpen: () => void; status?: CommunityPost["status"] }) => {
  const photo = p.photos[0];
  return (
    <button
      onClick={onOpen}
      className="cursor-pointer group w-full text-left flex rounded-xl bg-white border border-sand-200 shadow-sm hover:shadow-md hover:border-gold-300 transition-all overflow-hidden"
    >
      <span className="w-1 shrink-0" style={{ backgroundColor: kindColor(p) }} aria-hidden />
      <span className="flex-1 min-w-0 p-3 space-y-1.5">
        <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider">
          <span style={{ color: kindColor(p) }}>{p.kind === "report" ? "Trail report" : "Story"}</span>
          {p.pinned && (
            <span className="inline-flex items-center gap-0.5 text-brick-600">
              <Pin size={9} /> Pinned
            </span>
          )}
          {isOldReport(p) && <span className="text-sand-500">· old</span>}
          {status && status !== "visible" && <span className="text-brick-600">· {status}</span>}
          <span className="ml-auto font-medium normal-case tracking-normal text-sand-500">{ago(p.createdAt)}</span>
        </span>
        <span className="flex gap-2.5">
          <span className="flex-1 min-w-0 space-y-1">
            {p.title && <span className="block text-[13px] font-bold text-ink leading-snug line-clamp-2">{p.title}</span>}
            {p.conditions.length > 0 && <ConditionChips ids={p.conditions} />}
            <span className="block text-[11px] text-sand-700 leading-relaxed line-clamp-2 whitespace-pre-wrap">
              {p.body}
              {p.truncated ? "…" : ""}
            </span>
          </span>
          {photo && <img src={photoUrl(photo.path)} alt="" loading="lazy" className="w-16 h-16 rounded-lg object-cover bg-sand-100 shrink-0" />}
        </span>
        <span className="flex items-center gap-1.5 pt-0.5 text-[10px] text-sand-600">
          <Initial name={p.authorName} />
          <span className="min-w-0 truncate">
            <strong className="font-semibold text-ink">{p.authorName}</strong>
            {p.placeName ? ` · ${p.placeName}` : ""}
          </span>
          {p.clubName && <ClubBadge name={p.clubName} />}
          <span className="ml-auto flex items-center gap-2.5 shrink-0">
            <span className={`flex items-center gap-0.5 ${p.iFoundHelpful ? "text-forest-700 font-bold" : ""}`}>
              <ThumbsUp size={11} /> {p.helpfulCount}
            </span>
            <span className="flex items-center gap-0.5">
              <MessageCircle size={11} /> {p.commentCount}
            </span>
          </span>
        </span>
      </span>
    </button>
  );
};

const EmptyState = ({ icon: Icon, title, text, children }: { icon: typeof MapPin; title: string; text: string; children?: React.ReactNode }) => (
  <div className="py-8 px-4 flex flex-col items-center text-center gap-2">
    <span className="w-12 h-12 rounded-2xl bg-gold-50 border border-gold-200 flex items-center justify-center text-gold-700">
      <Icon size={22} />
    </span>
    <p className="text-sm font-bold text-ink">{title}</p>
    <p className="text-[11px] text-sand-600 max-w-[260px] leading-relaxed">{text}</p>
    {children && <div className="flex flex-wrap justify-center gap-2 pt-1">{children}</div>}
  </div>
);

const pill = (on: boolean) =>
  `cursor-pointer shrink-0 inline-flex items-center gap-1 h-7 px-3 rounded-full text-[11px] font-semibold border whitespace-nowrap transition-colors ${
    on ? "bg-forest-800 text-white border-forest-800" : "bg-white text-sand-700 border-sand-200 hover:border-gold-300"
  }`;

/** The floating "+" for a new post, kept at the bottom of the list while it scrolls */
const NewPostButton = ({ onClick }: { onClick: () => void }) => (
  <div className="sticky bottom-0 flex justify-end pointer-events-none -mb-1 pt-2">
    <button
      onClick={onClick}
      className="cursor-pointer pointer-events-auto flex items-center gap-1.5 h-11 pl-3.5 pr-4 rounded-full bg-forest-800 hover:bg-forest-700 text-white text-xs font-bold shadow-lg shadow-forest-900/25"
      aria-label="Write a post"
    >
      <Plus size={16} /> Post
    </button>
  </div>
);

const PAGE = 20;

const FeedView = ({ signedIn }: { signedIn: boolean }) => {
  const { openPost, openCompose, viewBounds, version, feedClub, setFeedClub, refreshClubs } = useCommunityStore();
  const clubs = useMyClubs(signedIn);
  const [scope, setScope] = useState<"near" | "all">("near");
  const [kind, setKind] = useState<PostKind | null>(null);
  const [condition, setCondition] = useState<ConditionId | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const query = useCallback(
    (before: number | null) =>
      fetchFeed({
        bounds: scope === "near" ? viewBounds : null,
        kinds: kind ? [kind] : null,
        conditions: condition ? [condition] : null,
        before,
        limit: PAGE,
        club: feedClub,
      }),
    [scope, viewBounds, kind, condition, feedClub],
  );

  useEffect(() => {
    let cancelled = false;
    query(null)
      .then((rows) => {
        if (cancelled) return;
        setPosts(rows);
        setMore(rows.length === PAGE);
        setError(null);
        // Seen: the club's "new posts" count starts again
        if (feedClub) markClubRead(feedClub).then(refreshClubs, () => undefined);
      })
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [query, version, feedClub, refreshClubs]);

  const loadMore = async () => {
    const last = posts[posts.length - 1];
    if (!last) return;
    setLoading(true);
    try {
      const rows = await query(last.createdAt);
      setPosts((p) => [...p, ...rows]);
      setMore(rows.length === PAGE);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  const filtered = kind !== null || condition !== null;
  const club = clubs.find((c) => c.id === feedClub);

  return (
    <div className="space-y-3">
      {!signedIn && (
        <div className="flex items-center gap-2.5 rounded-xl bg-gold-50 border border-gold-200 px-3 py-2.5">
          <MessagesSquare size={18} className="text-gold-700 shrink-0" />
          <p className="text-[11px] text-sand-800 leading-snug">
            <strong>Read freely.</strong> Sign in (Sign In / Register in the panel) to post trail reports, comment and join clubs.
          </p>
        </div>
      )}

      {/* Filters: one scrolling row of chips */}
      <div className="-mx-3 px-3 flex gap-1.5 overflow-x-auto no-scrollbar" role="group" aria-label="Filter">
        <button className={pill(scope === "near")} aria-pressed={scope === "near"} onClick={() => setScope("near")}>
          <MapPin size={11} /> Near the map
        </button>
        <button className={pill(scope === "all")} aria-pressed={scope === "all"} onClick={() => setScope("all")}>
          Everywhere
        </button>
        <span className="w-px shrink-0 bg-sand-200 my-1" />
        <button className={pill(kind === "report")} aria-pressed={kind === "report"} onClick={() => setKind(kind === "report" ? null : "report")}>
          Trail reports
        </button>
        <button className={pill(kind === "story")} aria-pressed={kind === "story"} onClick={() => setKind(kind === "story" ? null : "story")}>
          Stories
        </button>
        <span className="w-px shrink-0 bg-sand-200 my-1" />
        {CONDITIONS.map((c) => (
          <button
            key={c.id}
            className={pill(condition === c.id)}
            aria-pressed={condition === c.id}
            onClick={() => setCondition(condition === c.id ? null : c.id)}
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} /> {c.label}
          </button>
        ))}
      </div>
      {clubs.length > 0 && (
        <div className="-mx-3 px-3 flex gap-1.5 overflow-x-auto no-scrollbar" role="group" aria-label="Audience">
          <button className={pill(!feedClub)} aria-pressed={!feedClub} onClick={() => setFeedClub(null)}>
            Everyone
          </button>
          {clubs.map((c) => (
            <button key={c.id} className={pill(feedClub === c.id)} aria-pressed={feedClub === c.id} onClick={() => setFeedClub(c.id)}>
              <Lock size={10} /> {c.name}
              {c.newPosts > 0 && feedClub !== c.id && (
                <span className="min-w-4 h-4 px-1 rounded-full bg-brick-600 text-white text-[9px] font-bold flex items-center justify-center">{c.newPosts}</span>
              )}
            </button>
          ))}
        </div>
      )}

      <ErrorLine text={error} />
      {loading && posts.length === 0 ? (
        <div className="space-y-2" aria-label="Loading">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-sand-100 animate-pulse" />
          ))}
        </div>
      ) : posts.length === 0 && !error ? (
        <EmptyState
          icon={club ? Lock : MapPin}
          title={club ? `Nothing in ${club.name} yet` : filtered ? "No posts match" : scope === "near" ? "Quiet around here" : "No posts yet"}
          text={
            club
              ? "Posts for members only show up here. Share news, plans or trail conditions with your club."
              : filtered
                ? "Try another condition or type."
                : scope === "near"
                  ? "No one has posted in this part of the map in a while. Look everywhere, or be the first to report how the trail is."
                  : "Be the first to share how a trail is."
          }
        >
          {filtered && (
            <button
              onClick={() => {
                setKind(null);
                setCondition(null);
              }}
              className={pill(false)}
            >
              Clear filters
            </button>
          )}
          {!filtered && scope === "near" && !club && (
            <button onClick={() => setScope("all")} className={pill(false)}>
              Look everywhere
            </button>
          )}
          {signedIn && (
            <button onClick={() => openCompose()} className={pill(true)}>
              <Plus size={12} /> Write a post
            </button>
          )}
        </EmptyState>
      ) : (
        <ul className="space-y-2">
          {posts.map((p) => (
            <li key={p.id}>
              <PostCard p={p} onOpen={() => openPost(p.id)} />
            </li>
          ))}
        </ul>
      )}
      {loading && posts.length > 0 && (
        <div className="flex justify-center py-2">
          <Loader2 size={16} className="animate-spin text-sand-500" />
        </div>
      )}
      {more && !loading && (
        <button onClick={loadMore} className="cursor-pointer w-full h-9 rounded-xl border border-sand-200 bg-white text-xs font-bold text-sand-700 hover:bg-sand-50">
          Show more
        </button>
      )}
      <p className="text-[10px] text-sand-500 leading-snug text-center px-4">
        Posts come from other hikers. Always check with the park or trail managers before you go.
      </p>
      {signedIn && posts.length > 0 && <NewPostButton onClick={() => openCompose()} />}
    </div>
  );
};

const MineView = () => {
  const { openPost, openCompose, version } = useCommunityStore();
  const [posts, setPosts] = useState<MyPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchMyPosts(null, PAGE)
      .then((rows) => {
        if (cancelled) return;
        setPosts(rows);
        setMore(rows.length === PAGE);
      })
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [version]);

  const loadMore = async () => {
    const last = posts[posts.length - 1];
    if (!last) return;
    setLoading(true);
    try {
      const rows = await fetchMyPosts(last.createdAt, PAGE);
      setPosts((p) => [...p, ...rows]);
      setMore(rows.length === PAGE);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  const helpful = posts.reduce((n, p) => n + p.helpfulCount, 0);

  return (
    <div className="space-y-3">
      {posts.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-white border border-sand-200 px-3 py-2">
            <div className="text-lg font-bold text-ink leading-none">{posts.length}{more ? "+" : ""}</div>
            <div className="text-[10px] text-sand-500 mt-1">posts</div>
          </div>
          <div className="rounded-xl bg-white border border-sand-200 px-3 py-2">
            <div className="text-lg font-bold text-forest-700 leading-none">{helpful}</div>
            <div className="text-[10px] text-sand-500 mt-1">found helpful</div>
          </div>
        </div>
      )}
      <ErrorLine text={error} />
      {loading && posts.length === 0 ? (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-sand-100 animate-pulse" />
          ))}
        </div>
      ) : posts.length === 0 && !error ? (
        <EmptyState icon={Pencil} title="You have not posted yet" text="Tell other hikers how the trail is: muddy, a landslide, a dry water source. It helps them plan.">
          <button onClick={() => openCompose()} className={pill(true)}>
            <Plus size={12} /> Write your first post
          </button>
        </EmptyState>
      ) : (
        <ul className="space-y-2">
          {posts.map((p) => (
            <li key={p.id}>
              <PostCard p={p} status={p.status} onOpen={() => openPost(p.id)} />
            </li>
          ))}
        </ul>
      )}
      {more && !loading && (
        <button onClick={loadMore} className="cursor-pointer w-full h-9 rounded-xl border border-sand-200 bg-white text-xs font-bold text-sand-700 hover:bg-sand-50">
          Show more
        </button>
      )}
      {posts.length > 0 && <NewPostButton onClick={() => openCompose()} />}
    </div>
  );
};

// --- One post ----------------------------------------------------------------------------------

const ReportBox = ({ kind, id, onDone }: { kind: "post" | "comment"; id: string; onDone: () => void }) => {
  const [reason, setReason] = useState<ReportReason>("misleading");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      await reportItem(kind, id, reason, note);
      onDone();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };
  return (
    <div className="rounded-lg border border-brick-200 bg-brick-50/50 p-2 space-y-1.5">
      <select value={reason} onChange={(e) => setReason(e.target.value as ReportReason)} aria-label="Reason" className={field}>
        {REPORT_REASONS.map((r) => (
          <option key={r.id} value={r.id}>
            {r.label}
          </option>
        ))}
      </select>
      <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="What is wrong? (optional)" className={field} aria-label="Report note" />
      <ErrorLine text={error} />
      <button onClick={send} disabled={busy} className="cursor-pointer px-3 py-1 rounded-lg bg-brick-600 text-white text-[11px] font-bold disabled:opacity-50">
        Send report
      </button>
    </div>
  );
};

const PostView = ({ signedIn, isAdmin }: { signedIn: boolean; isAdmin: boolean }) => {
  const { postId, openFeed, openCompose, setFocused, refresh } = useCommunityStore();
  const [post, setPost] = useState<CommunityPost | null>(null);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [reporting, setReporting] = useState<string | null>(null); // "post" or a comment id
  const [reported, setReported] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!postId) return;
    setLoading(true);
    setError(null);
    try {
      const [p, c] = await Promise.all([fetchPost(postId), fetchComments(postId)]);
      setPost(p);
      setComments(c);
      setFocused(p);
      if (!p) setError("This post is no longer available.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [postId, setFocused]);
  useEffect(() => {
    load();
  }, [load]);

  if (loading && !post) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 size={18} className="animate-spin text-sand-500" />
      </div>
    );
  }
  if (!post) return <ErrorLine text={error ?? "This post is no longer available."} />;

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const helpful = () =>
    act(async () => {
      const r = await toggleHelpful(post.id);
      setPost({ ...post, iFoundHelpful: r.helpful, helpfulCount: r.count });
    });
  const sendComment = () =>
    act(async () => {
      await addComment(post.id, comment);
      setComment("");
      setComments(await fetchComments(post.id));
      setPost({ ...post, commentCount: post.commentCount + 1 });
    });
  const removeComment = (id: string) =>
    act(async () => {
      await deleteComment(id);
      setComments((c) => c.filter((x) => x.id !== id));
      setPost({ ...post, commentCount: Math.max(0, post.commentCount - 1) });
    });
  const removePost = () =>
    act(async () => {
      await deletePost(post.id);
      refresh();
      openFeed();
    });
  const togglePin = () =>
    act(async () => {
      await pinPost(post.id, !post.pinned);
      setPost({ ...post, pinned: !post.pinned });
      refresh();
    });
  const adminAction = (action: "restore" | "hide" | "remove") =>
    act(async () => {
      await moderate("post", post.id, action);
      refresh();
      await load();
    });
  const url = postUrl(post.id);
  const a = post.attachment;

  return (
    <article className="space-y-2.5">
      <div className="flex items-center gap-2">
        <span className="text-[9px] font-bold uppercase tracking-wider text-gold-700">{post.kind === "report" ? "Trail report" : "Story"}</span>
        {isOldReport(post) && <span className="text-[9px] font-bold uppercase text-sand-500">· old (over 30 days)</span>}
        {post.status !== "visible" && <span className="text-[9px] font-bold uppercase text-brick-600">· {post.status}</span>}
        {post.clubName && <ClubBadge name={`${post.clubName} · members only`} />}
        {post.pinned && (
          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase text-brick-600">
            <Pin size={9} /> Pinned
          </span>
        )}
      </div>
      {post.title && <h4 className="text-sm font-bold text-ink">{post.title}</h4>}
      {post.conditions.length > 0 && <ConditionChips ids={post.conditions} />}
      <div className="text-[10px] text-sand-600">
        <MapPin size={10} className="inline -mt-0.5" /> {post.placeName ?? `${post.lat.toFixed(5)}, ${post.lng.toFixed(5)}`} · on {day(post.happenedOn)}
      </div>
      <Byline p={post} />
      <p className="text-xs text-ink whitespace-pre-wrap break-words leading-relaxed">{post.body}</p>
      {post.photos.length > 0 && (
        <div className={`grid gap-1 ${post.photos.length > 1 ? "grid-cols-2" : ""}`}>
          {post.photos.map((ph) => (
            <a key={ph.path} href={photoUrl(ph.path)} target="_blank" rel="noopener noreferrer">
              <img src={photoUrl(ph.path)} alt="" loading="lazy" className="w-full h-32 object-cover rounded-md bg-sand-100" />
            </a>
          ))}
        </div>
      )}
      {a && (
        <div className="rounded-lg border border-gold-200 bg-gold-50/50 px-2.5 py-2 text-[11px] flex items-center gap-2">
          <Paperclip size={12} className="text-gold-700 shrink-0" />
          <span className="flex-1 min-w-0">
            <strong className="capitalize">{a.kind === "classic" ? "Classic Field Work" : a.kind}</strong>: {a.name}
            {a.kind === "track" ? ` · ${(a.distance_m / 1000).toFixed(1)} km` : ""}
          </span>
          {a.kind === "classic" ? (
            <a href={`/?classic=${a.token}`} className="font-bold text-gold-700 hover:underline shrink-0">
              Open
            </a>
          ) : (
            <span className="text-[10px] text-sand-500 shrink-0">on the map</span>
          )}
        </div>
      )}
      <ErrorLine text={error} />
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={helpful}
          disabled={!signedIn || busy}
          aria-pressed={post.iFoundHelpful}
          title={signedIn ? "Helpful" : "Sign in to react"}
          className={`cursor-pointer flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border disabled:opacity-60 ${
            post.iFoundHelpful ? "bg-forest-800 text-white border-forest-800" : "bg-white border-sand-200 text-ink"
          }`}
        >
          <ThumbsUp size={12} /> Helpful · {post.helpfulCount}
        </button>
        {!post.clubId && (
        <>
        <button
          onClick={async () => {
            await navigator.clipboard?.writeText(url).catch(() => undefined);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="cursor-pointer flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border bg-white border-sand-200"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? "Copied" : "Copy link"}
        </button>
        <a
          href={whatsappShareUrl(`${post.title ?? (post.kind === "report" ? "Trail report" : "Story")}${post.placeName ? ` · ${post.placeName}` : ""}\n${url}`)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#25D366] text-white"
        >
          <MessageCircle size={12} /> WhatsApp
        </a>
        </>
        )}
        {post.clubId && (post.myClubRole === "owner" || post.myClubRole === "admin") && post.status === "visible" && (
          <button
            onClick={togglePin}
            disabled={busy}
            aria-pressed={post.pinned}
            title="Pin on top of the club feed (up to 3)"
            className={`cursor-pointer flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
              post.pinned ? "bg-brick-50 border-brick-200 text-brick-600" : "bg-white border-sand-200"
            }`}
          >
            <Pin size={12} /> {post.pinned ? "Unpin" : "Pin"}
          </button>
        )}
        {post.isMine && canEdit(post) && (
          <button onClick={() => openCompose(post)} className="cursor-pointer flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border bg-white border-sand-200">
            <Pencil size={12} /> Edit
          </button>
        )}
        {post.isMine &&
          (confirmDelete ? (
            <span className="flex items-center gap-1 text-[11px] text-brick-600 font-bold">
              Delete?
              <button onClick={removePost} disabled={busy} className="cursor-pointer px-2 py-1 rounded-lg bg-brick-600 text-white">
                Yes
              </button>
              <button onClick={() => setConfirmDelete(false)} className="cursor-pointer px-2 py-1 rounded-lg bg-sand-100 text-sand-700">
                No
              </button>
            </span>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="cursor-pointer p-1.5 rounded-lg hover:bg-brick-50 text-brick-600" aria-label="Delete post">
              <Trash2 size={13} />
            </button>
          ))}
        {signedIn && !post.isMine && !reported && (
          <button
            onClick={() => setReporting(reporting === "post" ? null : "post")}
            className="cursor-pointer ml-auto flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-sand-600 hover:text-brick-600"
          >
            <Flag size={12} /> Report
          </button>
        )}
      </div>
      {reporting === "post" && (
        <ReportBox
          kind="post"
          id={post.id}
          onDone={() => {
            setReporting(null);
            setReported(true);
          }}
        />
      )}
      {reported && <p className="text-[10px] font-bold text-forest-700">Thank you. The admin will look at it.</p>}
      {isAdmin && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-brick-200 bg-brick-50/40 p-2 text-[10px]">
          <span className="font-bold text-brick-600">Admin:</span>
          <button onClick={() => adminAction("restore")} className="cursor-pointer px-2 py-0.5 rounded bg-white border border-sand-200 font-bold">Restore</button>
          <button onClick={() => adminAction("hide")} className="cursor-pointer px-2 py-0.5 rounded bg-white border border-sand-200 font-bold">Hide</button>
          <button onClick={() => adminAction("remove")} className="cursor-pointer px-2 py-0.5 rounded bg-brick-600 text-white font-bold">Remove</button>
        </div>
      )}

      <section aria-label="Comments" className="pt-2 border-t border-sand-200 space-y-2">
        <h5 className="text-[11px] font-bold">Comments · {comments.length}</h5>
        {comments.map((c) => (
          <div key={c.id} className="rounded-lg bg-sand-50 border border-sand-100 px-2.5 py-1.5">
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-bold text-ink">{c.authorName}</span>
              {c.authorOrganization && <span className="text-[10px] text-sand-500">· {c.authorOrganization}</span>}
              <span className="text-[10px] text-sand-500">· {ago(c.createdAt)}</span>
              <span className="ml-auto flex gap-1">
                {(c.isMine || isAdmin) && (
                  <button onClick={() => removeComment(c.id)} className="cursor-pointer text-brick-600" aria-label="Delete comment">
                    <Trash2 size={11} />
                  </button>
                )}
                {signedIn && !c.isMine && (
                  <button onClick={() => setReporting(reporting === c.id ? null : c.id)} className="cursor-pointer text-sand-500 hover:text-brick-600" aria-label="Report comment">
                    <Flag size={11} />
                  </button>
                )}
              </span>
            </div>
            <p className="text-[11px] text-sand-700 whitespace-pre-wrap break-words">{c.body}</p>
            {reporting === c.id && <ReportBox kind="comment" id={c.id} onDone={() => setReporting(null)} />}
          </div>
        ))}
        {signedIn ? (
          <div className="flex gap-1.5">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={1000}
              rows={2}
              placeholder="Ask or add something…"
              aria-label="Comment"
              className={`${field} resize-none`}
            />
            <button
              onClick={sendComment}
              disabled={busy || !comment.trim()}
              className="cursor-pointer self-end px-3 py-1.5 rounded-lg bg-forest-800 text-white text-[11px] font-bold disabled:opacity-40"
            >
              Send
            </button>
          </div>
        ) : (
          <p className="text-[10px] text-sand-500">Sign in to comment.</p>
        )}
      </section>
    </article>
  );
};

// --- Write / edit --------------------------------------------------------------------------------

const ComposeView = ({ userId }: { userId: string }) => {
  const { editing, openPost, openFeed, refresh, picked, picking, startPicking, stopPicking, setPicked } = useCommunityStore();
  const editMode = !!editing;
  const [kind, setKind] = useState<PostKind>(editing?.kind ?? "report");
  const [title, setTitle] = useState(editing?.title ?? "");
  const [body, setBody] = useState(editing?.body ?? "");
  const [conditions, setConditions] = useState<ConditionId[]>(editing?.conditions ?? []);
  const [happenedOn, setHappenedOn] = useState(editing?.happenedOn ?? today());
  const [placeName, setPlaceName] = useState(editing?.placeName ?? "");
  const [photos, setPhotos] = useState<(CompressedPhoto & { url: string })[]>([]);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [clubId, setClubId] = useState<string | null>(useCommunityStore.getState().feedClub);
  const clubs = useMyClubs(true);
  const [limits, setLimits] = useState<CommunityLimits | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gps, setGps] = useState<[number, number] | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const placeEdited = useRef(!!editing?.placeName);

  useEffect(() => {
    if (!editMode) fetchMyLimits().then(setLimits, (e: Error) => setError(e.message));
    // Where you are now (if allowed), to warn when the post would give it away
    navigator.geolocation?.getCurrentPosition(
      (p) => setGps([p.coords.longitude, p.coords.latitude]),
      () => undefined,
      { maximumAge: 5 * 60000, timeout: 8000 },
    );
  }, [editMode]);

  // Start at the centre of the map
  useEffect(() => {
    if (!editMode && !picked) setPicked(useMapStore.getState().center);
    // once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const editAt = useMemo(() => (editing ? ([editing.lng, editing.lat] as [number, number]) : null), [editing]);
  const at = editAt ?? picked;

  // The nearest village as the place name, until the author types one
  useEffect(() => {
    if (!at || editMode || placeEdited.current) return;
    let cancelled = false;
    loadVillageIndex()
      .then((index) => {
        const v = index.nearest(at[1], at[0], 1)[0];
        if (!cancelled && v && !placeEdited.current) setPlaceName(`${v.name}, ${v.kecamatan}`);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [at, editMode]);

  const nearMe = !editMode && at && gps && distanceKm(at[1], at[0], gps[1], gps[0]) * 1000 < NEAR_ME_METERS;
  const left = kind === "report" ? limits?.reportsLeft : limits?.storiesLeft;
  const outOfPosts = !editMode && left !== null && left !== undefined && left <= 0;

  const addPhotos = async (files: File[]) => {
    const room = (limits?.photos ?? 1) - photos.length;
    setError(null);
    try {
      const added: (CompressedPhoto & { url: string })[] = [];
      for (const f of files.slice(0, Math.max(0, room))) {
        const c = await compressPhoto(f);
        added.push({ ...c, url: URL.createObjectURL(c.blob) });
      }
      setPhotos((p) => [...p, ...added]);
      if (files.length > room) setError(`Your plan allows ${limits?.photos ?? 1} photo(s) per post.`);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const toggleCondition = (id: ConditionId) =>
    setConditions((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length >= MAX_CONDITIONS ? c : [...c, id]));

  const submit = async () => {
    const problem = postInputError({ kind, body, title, conditions, happenedOn, lat: at ? at[1] : null });
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    try {
      if (editMode) {
        await updatePost(editing.id, { title, body, conditions, placeName });
        refresh();
        openPost(editing.id);
      } else {
        const id = await createPost(
          userId,
          { kind, title, body, conditions, happenedOn, lat: at![1], lng: at![0], placeName, attachment, clubId },
          photos,
        );
        refresh();
        openPost(id);
      }
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  if (picking) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <Crosshair size={14} className="text-gold-700 animate-pulse" />
        <span className="flex-1 font-bold">Tap the map where it is</span>
        <button onClick={stopPicking} className="cursor-pointer px-2 py-1 rounded-lg bg-sand-100 font-bold">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {!editMode && (
        <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-sand-100" role="tablist" aria-label="Post type">
          {(["report", "story"] as const).map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={kind === k}
              onClick={() => setKind(k)}
              className={`cursor-pointer py-1.5 rounded-md text-xs font-bold ${kind === k ? "bg-white shadow text-ink" : "text-sand-600"}`}
            >
              {k === "report" ? "Trail report" : "Story"}
              <span className="block text-[10px] font-normal text-sand-500">{k === "report" ? "Conditions now, short" : "Your trip, with data"}</span>
            </button>
          ))}
        </div>
      )}
      {limits?.banned && <ErrorLine text="You cannot post in Community at the moment." />}
      {!editMode && clubs.length > 0 && (
        <label className="block space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-sand-600">Who can see it</span>
          <select value={clubId ?? ""} onChange={(e) => setClubId(e.target.value || null)} aria-label="Who can see it" className={field}>
            <option value="">Everyone (public)</option>
            {clubs.map((c) => (
              <option key={c.id} value={c.id}>
                Members only: {c.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {!editMode && left !== null && left !== undefined && (
        <p className={`text-[10px] ${outOfPosts ? "text-brick-600 font-bold" : "text-sand-500"}`}>
          {left} {kind === "report" ? "trail report" : "stor"}{kind === "report" ? (left === 1 ? "" : "s") : left === 1 ? "y" : "ies"} left today on your plan.
        </p>
      )}

      {kind === "story" && (
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={TITLE_LIMIT} placeholder="Title" aria-label="Title" className={field} />
      )}
      <div className="space-y-1">
        <div className="text-[10px] font-bold uppercase tracking-wider text-sand-600">
          Trail conditions {kind === "report" ? "*" : "(optional)"}
        </div>
        <div className="flex flex-wrap gap-1">
          {CONDITIONS.map((c) => (
            <button key={c.id} onClick={() => toggleCondition(c.id)} aria-pressed={conditions.includes(c.id)} className={chip(conditions.includes(c.id))}>
              {c.label}
            </button>
          ))}
        </div>
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={BODY_LIMIT[kind]}
        rows={kind === "report" ? 4 : 8}
        placeholder={kind === "report" ? "What is the trail like? e.g. The water source at Kandang Badak is dry." : "Tell the story of your trip…"}
        aria-label="Text"
        className={`${field} resize-y`}
      />
      <div className="text-right text-[10px] text-sand-500">
        {body.trim().length}/{BODY_LIMIT[kind]}
      </div>

      {!editMode && (
        <label className="flex items-center gap-2 text-[11px] text-sand-700">
          Date
          <input type="date" value={happenedOn} max={today()} onChange={(e) => setHappenedOn(e.target.value)} className={`${field} w-auto`} />
        </label>
      )}

      <div className="space-y-1">
        <div className="text-[10px] font-bold uppercase tracking-wider text-sand-600">Where *</div>
        {!editMode && (
          <div className="flex flex-wrap gap-1">
            <button onClick={startPicking} className="cursor-pointer flex items-center gap-1 px-2 py-1 rounded-lg bg-sand-100 hover:bg-sand-200 text-[10px] font-bold">
              <MapPin size={11} /> Pick on map
            </button>
            <button onClick={() => setPicked(useMapStore.getState().center)} className="cursor-pointer px-2 py-1 rounded-lg bg-sand-100 hover:bg-sand-200 text-[10px] font-bold">
              Map centre
            </button>
            {gps && (
              <button onClick={() => setPicked(gps)} className="cursor-pointer flex items-center gap-1 px-2 py-1 rounded-lg bg-sand-100 hover:bg-sand-200 text-[10px] font-bold">
                <LocateFixed size={11} /> My position
              </button>
            )}
          </div>
        )}
        {at && <p className="text-[10px] text-sand-500 tabular-nums">{at[1].toFixed(5)}, {at[0].toFixed(5)}</p>}
        {nearMe && <p className="text-[10px] font-bold text-gold-800">You are sharing where you are now.</p>}
        <input
          value={placeName}
          onChange={(e) => {
            placeEdited.current = true;
            setPlaceName(e.target.value);
          }}
          maxLength={120}
          placeholder="Place name"
          aria-label="Place name"
          className={field}
        />
      </div>

      {!editMode && (
        <div className="space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-sand-600">
            Photos ({photos.length}/{limits?.photos ?? 1})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {photos.map((p, i) => (
              <div key={p.url} className="relative">
                <img src={p.url} alt="" className="w-16 h-16 object-cover rounded-md" />
                <button
                  onClick={() => setPhotos((ps) => ps.filter((_, j) => j !== i))}
                  className="cursor-pointer absolute -top-1 -right-1 bg-white rounded-full p-0.5 shadow"
                  aria-label="Remove photo"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
            {photos.length < (limits?.photos ?? 1) && (
              <button
                onClick={() => fileInput.current?.click()}
                className="cursor-pointer w-16 h-16 rounded-md border border-dashed border-sand-300 flex items-center justify-center text-sand-500 hover:bg-sand-50"
                aria-label="Add photo"
              >
                <Camera size={16} />
              </button>
            )}
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              addPhotos(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
          <p className="text-[10px] text-sand-500">Photos are made smaller and their location data is removed before upload.</p>
        </div>
      )}

      {!editMode && (
        <AttachmentPicker allowed={!!limits?.attachments} value={attachment} onChange={setAttachment} onError={setError} />
      )}

      <ErrorLine text={error} />
      <div className="flex justify-end gap-2">
        <button
          onClick={() => (editMode ? openPost(editing.id) : openFeed())}
          className="cursor-pointer px-3 py-1.5 rounded-lg bg-sand-100 hover:bg-sand-200 text-sand-700 text-xs font-bold"
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={busy || limits?.banned || outOfPosts}
          className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-forest-800 hover:bg-forest-700 text-white text-xs font-bold disabled:opacity-50"
        >
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} {editMode ? "Save changes" : "Post"}
        </button>
      </div>
    </div>
  );
};

/** Your own map data to attach (Pro, Enterprise, admin): a snapshot goes with the post */
const AttachmentPicker = ({
  allowed,
  value,
  onChange,
  onError,
  label = "Attach map data (optional)",
  maxTrackPoints,
}: {
  allowed: boolean;
  value: Attachment | null;
  onChange: (a: Attachment | null) => void;
  onError: (e: string | null) => void;
  label?: string;
  maxTrackPoints?: number;
}) => {
  const places = useMarkedLocationStore((s) => s.locations);
  const areas = useMarkedAreaStore((s) => s.areas);
  const tracks = useTrackRecorderStore((s) => s.tracks);
  const fieldWorks = useClassicStore((s) => s.fieldWorks);
  const [loading, setLoading] = useState(false);
  const shared = useMemo(
    () => [...fieldWorks.resection, ...fieldWorks.intersection].filter((f) => f.shareToken),
    [fieldWorks],
  );
  // Marked Locations load their list when signed in; ask once here too
  useEffect(() => {
    const s = useMarkedLocationStore.getState() as unknown as { loadLocations?: () => Promise<void> };
    if (allowed && places.length === 0) s.loadLocations?.().catch?.(() => undefined);
    // once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed]);

  if (!allowed) {
    return <p className="text-[10px] text-sand-500">Attaching a track, area, place or Field Work is for Pro and Enterprise accounts.</p>;
  }

  const choose = async (key: string) => {
    onError(null);
    if (!key) return onChange(null);
    const [kind, id] = key.split(":");
    try {
      if (kind === "place") {
        const l = places.find((x) => x.id === id);
        if (l) onChange(placeAttachment(l));
      } else if (kind === "area") {
        const a = areas.find((x) => x.id === id);
        if (a) onChange(areaAttachment(a));
      } else if (kind === "track") {
        const t = tracks.find((x) => x.id === id);
        if (!t) return;
        setLoading(true);
        const local = await getPoints(t.id).catch(() => []);
        const points = local.length ? local : await fetchRemotePoints(t.id);
        if (points.length < 2) throw new Error("This track has no points to attach.");
        onChange(trackAttachment(t.name, t.distanceM, points, maxTrackPoints));
      } else if (kind === "classic") {
        const f = shared.find((x) => x.id === id);
        if (f?.shareToken) onChange(classicAttachment(f.name, f.shareToken));
      }
    } catch (e) {
      onError((e as Error).message);
      onChange(null);
    } finally {
      setLoading(false);
    }
  };
  const key = value ? `${value.kind}:` : "";

  return (
    <div className="space-y-1">
      <div className="text-[10px] font-bold uppercase tracking-wider text-sand-600 flex items-center gap-1">
        <Paperclip size={11} /> {label} {loading && <Loader2 size={10} className="animate-spin" />}
      </div>
      <select onChange={(e) => choose(e.target.value)} defaultValue="" aria-label="Attachment" className={field}>
        <option value="">{maxTrackPoints ? "Choose…" : "Nothing"}</option>
        {tracks.length > 0 && (
          <optgroup label="Tracks">
            {tracks.map((t) => (
              <option key={t.id} value={`track:${t.id}`}>
                {t.name} · {(t.distanceM / 1000).toFixed(1)} km
              </option>
            ))}
          </optgroup>
        )}
        {areas.length > 0 && (
          <optgroup label="Marked Areas">
            {areas.map((a) => (
              <option key={a.id} value={`area:${a.id}`}>
                {a.name}
              </option>
            ))}
          </optgroup>
        )}
        {places.length > 0 && (
          <optgroup label="Marked Locations">
            {places.map((l) => (
              <option key={l.id} value={`place:${l.id}`}>
                {l.name}
              </option>
            ))}
          </optgroup>
        )}
        {shared.length > 0 && (
          <optgroup label="Classic Field Works (shared)">
            {shared.map((f) => (
              <option key={f.id} value={`classic:${f.id}`}>
                {f.name}
              </option>
            ))}
          </optgroup>
        )}
      </select>
      {value && key && !maxTrackPoints && <p className="text-[10px] text-forest-700 font-bold">Attached: {value.name}</p>}
    </div>
  );
};

// --- Clubs -------------------------------------------------------------------------------------

const ClubAvatar = ({ club, size }: { club: Pick<Club, "name" | "photoPath">; size: "sm" | "lg" }) => {
  const box = size === "lg" ? "w-14 h-14 rounded-xl text-lg" : "w-10 h-10 rounded-xl text-sm";
  return club.photoPath ? (
    <img src={photoUrl(club.photoPath)} alt="" className={`${box} object-cover shrink-0 bg-sand-100`} />
  ) : (
    <span className={`${box} shrink-0 flex items-center justify-center bg-forest-50 border border-forest-200 font-bold text-forest-800`}>
      {club.name.trim().charAt(0).toUpperCase() || <Users size={14} />}
    </span>
  );
};

const ClubContact = ({ contact }: { contact: string }) => {
  const href = contactHref(contact);
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[10px] font-bold text-gold-700 hover:underline break-all">
      <ExternalLink size={10} className="shrink-0" /> {contact}
    </a>
  ) : (
    <p className="text-[10px] text-sand-600 break-words">{contact}</p>
  );
};

/** The leader edits the club's photo, name, description, home base and contact */
const ClubEditForm = ({ club, onDone }: { club: Club; onDone: () => void }) => {
  const user = useSurveyStore((s) => s.user);
  const [profile, setProfile] = useState<ClubProfile>({
    name: club.name,
    description: club.description ?? "",
    region: club.region ?? "",
    contact: club.contact ?? "",
  });
  // undefined: keep the photo; null: remove it; a file: replace it
  const [photo, setPhoto] = useState<(CompressedPhoto & { url: string }) | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const set = (k: keyof ClubProfile) => (e: { target: { value: string } }) => setProfile((p) => ({ ...p, [k]: e.target.value }));

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      const c = await compressPhoto(file, CLUB_PHOTO_SIDE);
      setPhoto({ ...c, url: URL.createObjectURL(c.blob) });
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const save = async () => {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      await updateClub(club.id, profile);
      if (photo !== undefined) await setClubPhoto(user.id, club.id, photo);
      onDone();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };
  const preview = photo === undefined ? club.photoPath && photoUrl(club.photoPath) : photo?.url;

  return (
    <div className="space-y-2 rounded-lg border border-gold-200 bg-gold-50/30 p-2.5">
      <div className="flex items-center gap-2.5">
        {preview ? (
          <img src={preview} alt="" className="w-16 h-16 rounded-xl object-cover bg-sand-100 shrink-0" />
        ) : (
          <span className="w-16 h-16 rounded-xl shrink-0 flex items-center justify-center bg-forest-50 border border-dashed border-forest-200 text-forest-700">
            <Camera size={18} />
          </span>
        )}
        <div className="flex flex-col items-start gap-1">
          <button onClick={() => fileInput.current?.click()} className="cursor-pointer flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-sand-200 text-[11px] font-bold">
            <Camera size={12} /> {preview ? "Change photo" : "Add photo"}
          </button>
          {preview && (
            <button onClick={() => setPhoto(null)} className="cursor-pointer text-[10px] font-bold text-brick-600 hover:underline">
              Remove photo
            </button>
          )}
          <span className="text-[10px] text-sand-500">Club logo or group photo, made smaller before upload.</span>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            pick(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
      <label className="block space-y-0.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-sand-600">Name *</span>
        <input value={profile.name} onChange={set("name")} maxLength={60} className={field} />
      </label>
      <label className="block space-y-0.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-sand-600">About the club</span>
        <textarea value={profile.description} onChange={set("description")} maxLength={500} rows={3} placeholder="Who you are, what you do" className={`${field} resize-none`} />
      </label>
      <label className="block space-y-0.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-sand-600">Home base</span>
        <input value={profile.region} onChange={set("region")} maxLength={80} placeholder="e.g. Jakarta Selatan" className={field} />
      </label>
      <label className="block space-y-0.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-sand-600">Contact</span>
        <input value={profile.contact} onChange={set("contact")} maxLength={200} placeholder="@instagram, website or WhatsApp number" className={field} />
      </label>
      <p className="text-[10px] text-sand-500">Members see the club profile. The contact is shown to them as a link.</p>
      <ErrorLine text={error} />
      <div className="flex justify-end gap-1.5">
        <button onClick={onDone} disabled={busy} className="cursor-pointer px-3 py-1 rounded-lg bg-sand-100 text-sand-700 text-[11px] font-bold">
          Cancel
        </button>
        <button
          onClick={save}
          disabled={busy || profile.name.trim().length < 2}
          className="cursor-pointer flex items-center gap-1 px-3 py-1 rounded-lg bg-forest-800 text-white text-[11px] font-bold disabled:opacity-50"
        >
          {busy ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Save
        </button>
      </div>
    </div>
  );
};

const ClubsView = () => {
  const { openClub, refresh } = useCommunityStore();
  const clubs = useMyClubs(true);
  const [limits, setLimits] = useState<CommunityLimits | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const version = useCommunityStore((s) => s.version);
  useEffect(() => {
    fetchMyLimits().then(setLimits, (e: Error) => setError(e.message));
  }, [version]);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const id = await createClub(name, description);
      refresh();
      openClub(id);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };
  const canCreate = !!limits?.canCreateClubs && limits.clubsLeft !== 0;

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-sand-600 leading-snug">
        A club shares posts with its members only. Enterprise accounts can start up to {CLUB_LIMITS.Enterprise} clubs and add any Landscape 360 account
        by email (up to {CLUB_LIMITS.members} members).
      </p>
      {limits?.canCreateClubs ? (
        creating ? (
          <div className="rounded-lg border border-gold-200 bg-gold-50/40 p-2.5 space-y-1.5">
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Club name" aria-label="Club name" className={field} />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="What is the club about? (optional)"
              aria-label="Club description"
              className={`${field} resize-none`}
            />
            <ErrorLine text={error} />
            <div className="flex justify-end gap-1.5">
              <button onClick={() => setCreating(false)} className="cursor-pointer px-3 py-1 rounded-lg bg-sand-100 text-sand-700 text-[11px] font-bold">
                Cancel
              </button>
              <button
                onClick={create}
                disabled={busy || name.trim().length < 2}
                className="cursor-pointer px-3 py-1 rounded-lg bg-forest-800 text-white text-[11px] font-bold disabled:opacity-50"
              >
                Create club
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setCreating(true)}
            disabled={!canCreate}
            className="cursor-pointer w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-forest-800 hover:bg-forest-700 text-white text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={14} /> {canCreate ? "New club" : `You have ${CLUB_LIMITS.Enterprise} clubs (the most)`}
          </button>
        )
      ) : (
        limits && <p className="text-[10px] text-sand-500">Starting a club is for Enterprise accounts. You can still be added to one.</p>
      )}
      {!creating && <ErrorLine text={error} />}
      {clubs.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No clubs yet"
          text={
            limits?.canCreateClubs
              ? "Start a club for your Mapala, team or trip group: members-only posts and a shared workspace."
              : "Ask a club leader to add you by email or send you an invite link."
          }
        />
      ) : (
        <ul className="space-y-1.5">
          {clubs.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => openClub(c.id)}
                className="cursor-pointer w-full text-left rounded-xl border border-sand-200 bg-white shadow-sm hover:shadow-md hover:border-gold-300 transition-all p-2.5 flex items-center gap-2.5"
              >
                <ClubAvatar club={c} size="sm" />
                <span className="flex-1 min-w-0">
                  <span className="block text-xs font-bold truncate">{c.name}</span>
                  <span className="block text-[10px] text-sand-500 truncate">
                    {c.role === "owner" ? "You lead it" : c.role === "admin" ? `Admin · Leader: ${c.ownerName}` : `Leader: ${c.ownerName}`} ·{" "}
                    {c.memberCount} member{c.memberCount === 1 ? "" : "s"}
                    {c.region ? ` · ${c.region}` : ""}
                  </span>
                </span>
                {c.newPosts > 0 && (
                  <span className="shrink-0 min-w-5 h-5 px-1.5 rounded-full bg-brick-600 text-white text-[10px] font-bold flex items-center justify-center" title="New posts">
                    {c.newPosts > 99 ? "99+" : c.newPosts}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const ClubView = () => {
  const { clubId, openClubs, openFeed, setFeedClub, refresh } = useCommunityStore();
  const clubs = useMyClubs(true);
  const club = clubs.find((c) => c.id === clubId) ?? null;
  const [tab, setTab] = useState<"members" | "workspace" | "events">("members");
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const user = useSurveyStore((s) => s.user);

  if (!clubId) return null;
  if (!club) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 size={18} className="animate-spin text-sand-500" />
      </div>
    );
  }
  const leader = club.role === "owner";

  const leaveOrDelete = async () => {
    setBusy(true);
    setError(null);
    try {
      if (leader) await deleteClub(club.id);
      else if (user) await removeClubMember(club.id, user.id);
      if (useCommunityStore.getState().feedClub === club.id) setFeedClub(null);
      refresh();
      openClubs();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2.5">
      {editing ? (
        <ClubEditForm
          club={club}
          onDone={() => {
            setEditing(false);
            refresh();
          }}
        />
      ) : (
        <div className="flex items-start gap-2.5">
          <ClubAvatar club={club} size="lg" />
          <div className="flex-1 min-w-0 space-y-0.5">
            <h4 className="text-sm font-bold text-ink break-words">{club.name}</h4>
            {club.region && (
              <p className="text-[10px] text-sand-600">
                <MapPin size={10} className="inline -mt-0.5" /> {club.region}
              </p>
            )}
            {club.contact && <ClubContact contact={club.contact} />}
            <p className="text-[10px] text-sand-500">
              {leader ? "You lead this club" : `Leader: ${club.ownerName}`}
              {club.role === "admin" ? " · you are an admin" : ""}
            </p>
          </div>
          {leader && club.canManage && (
            <button
              onClick={() => setEditing(true)}
              className="cursor-pointer shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg border border-sand-200 hover:bg-sand-50 text-[11px] font-bold text-sand-700"
              aria-label="Edit club"
            >
              <Pencil size={12} /> Edit
            </button>
          )}
        </div>
      )}
      {!editing && club.description && <p className="text-[11px] text-sand-700 whitespace-pre-wrap break-words">{club.description}</p>}
      {!club.canManage && club.role !== "member" && (
        <p className="text-[10px] p-2 rounded-lg border bg-gold-50 border-gold-200 text-gold-800">
          The leader&apos;s account is no longer Enterprise: the club keeps working, but members, links, folders and pins cannot be changed.
        </p>
      )}
      <button
        onClick={() => {
          setFeedClub(club.id);
          openFeed();
        }}
        className="cursor-pointer w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-forest-800 hover:bg-forest-700 text-white text-xs font-bold"
      >
        <MessagesSquare size={13} /> Club posts
        {club.newPosts > 0 && <span className="px-1.5 rounded-full bg-white text-forest-800 text-[10px]">{club.newPosts} new</span>}
      </button>

      <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-sand-100" role="tablist" aria-label="Club">
        {(["members", "events", "workspace"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`cursor-pointer flex items-center justify-center gap-1 py-1.5 rounded-md text-xs font-bold ${tab === t ? "bg-white shadow text-ink" : "text-sand-600"}`}
          >
            {t === "members" ? <Users size={12} /> : t === "events" ? <CalendarDays size={12} /> : <Folder size={12} />}{" "}
            {t === "members" ? `Members · ${club.memberCount}` : t === "events" ? "Events" : "Workspace"}
          </button>
        ))}
      </div>
      {tab === "members" ? <ClubMembersTab club={club} /> : tab === "events" ? <ClubEventsTab club={club} /> : <ClubWorkspaceTab club={club} />}

      <ErrorLine text={error} />
      {confirm ? (
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-brick-600">
          {leader ? "Delete the club, its posts and its workspace?" : "Leave this club?"}
          <button onClick={leaveOrDelete} disabled={busy} className="cursor-pointer px-2 py-1 rounded-lg bg-brick-600 text-white">
            Yes
          </button>
          <button onClick={() => setConfirm(false)} className="cursor-pointer px-2 py-1 rounded-lg bg-sand-100 text-sand-700">
            No
          </button>
        </div>
      ) : (
        <button onClick={() => setConfirm(true)} className="cursor-pointer text-[11px] font-bold text-brick-600 hover:underline">
          {leader ? "Delete club" : "Leave club"}
        </button>
      )}
    </div>
  );
};

const sectionTitle = "text-[10px] font-bold uppercase tracking-wider text-sand-600";

const ClubMembersTab = ({ club }: { club: Club }) => {
  const { refreshClubs } = useCommunityStore();
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [invites, setInvites] = useState<ClubInvite[]>([]);
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const leader = club.role === "owner" && club.canManage;

  const load = useCallback(() => {
    fetchClubMembers(club.id).then(setMembers, (e: Error) => setError(e.message));
    if (club.canManage) fetchClubInvites(club.id).then(setInvites, () => undefined);
  }, [club.id, club.canManage]);
  useEffect(load, [load]);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
      load();
      refreshClubs();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const add = () =>
    act(async () => {
      const who = await addClubMember(club.id, email);
      setEmail("");
      setNotice(`${who} is now a member.`);
    });
  const copy = async (token: string) => {
    await navigator.clipboard?.writeText(joinUrl(token)).catch(() => undefined);
    setCopied(token);
    setTimeout(() => setCopied(null), 1500);
  };
  const daysLeft = (t: number) => Math.max(1, Math.ceil((t - Date.now()) / 86400000));

  return (
    <div className="space-y-2.5">
      {club.canManage && (
        <div className="space-y-1">
          <div className={sectionTitle}>Add a member</div>
          <div className="flex gap-1.5">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && isEmail(email) && !busy && add()}
              placeholder="Their Landscape 360 email"
              aria-label="Member email"
              className={field}
            />
            <button
              onClick={add}
              disabled={busy || !isEmail(email)}
              className="cursor-pointer shrink-0 flex items-center gap-1 px-3 rounded-lg bg-forest-800 text-white text-[11px] font-bold disabled:opacity-40"
            >
              <UserPlus size={12} /> Add
            </button>
          </div>
        </div>
      )}
      {club.canManage && (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className={sectionTitle}>Invite links</span>
            <button
              onClick={() => act(() => createClubInvite(club.id))}
              disabled={busy}
              className="cursor-pointer ml-auto flex items-center gap-1 px-2 py-0.5 rounded-lg bg-sand-100 hover:bg-sand-200 text-[10px] font-bold disabled:opacity-50"
            >
              <Link2 size={11} /> New link
            </button>
          </div>
          {invites.length === 0 ? (
            <p className="text-[10px] text-sand-500">
              A link anyone signed in can open to join, for {CLUB_LIMITS.inviteDays} days. Share it in your group chat.
            </p>
          ) : (
            invites.map((i) => (
              <div key={i.token} className="flex flex-wrap items-center gap-1.5 rounded-lg border border-sand-200 bg-white px-2 py-1.5 text-[10px]">
                <span className="flex-1 min-w-0 truncate font-mono text-sand-600">…?join={i.token.slice(0, 8)}…</span>
                <span className="text-sand-500">
                  {daysLeft(i.expiresAt)} d left · {i.uses} joined
                </span>
                <button onClick={() => copy(i.token)} className="cursor-pointer flex items-center gap-0.5 font-bold text-ink">
                  {copied === i.token ? <Check size={11} /> : <Copy size={11} />} {copied === i.token ? "Copied" : "Copy"}
                </button>
                <a
                  href={whatsappShareUrl(`Join ${club.name} on Landscape 360:\n${joinUrl(i.token)}`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-[#128C7E]"
                >
                  WhatsApp
                </a>
                <button onClick={() => act(() => revokeClubInvite(i.token))} disabled={busy} className="cursor-pointer font-bold text-brick-600">
                  Stop
                </button>
              </div>
            ))
          )}
        </div>
      )}
      {notice && <p className="text-[11px] font-bold text-forest-700">{notice}</p>}
      <ErrorLine text={error} />

      <section aria-label="Members" className="space-y-1">
        <div className={sectionTitle}>
          Members · {members.length}/{CLUB_LIMITS.members}
        </div>
        <ul className="divide-y divide-sand-100 rounded-lg border border-sand-200 bg-white">
          {members.map((m) => {
            const canRemove = !m.isMe && m.role !== "owner" && (leader || (club.canManage && m.role === "member"));
            return (
              <li key={m.userId} className="flex items-center gap-2 px-2.5 py-1.5">
                <span className="flex-1 min-w-0">
                  <span className="block text-[11px] font-bold truncate">
                    {m.name}
                    {m.isMe ? " (you)" : ""}
                    {m.role !== "member" && (
                      <span className={`ml-1 text-[9px] font-bold uppercase ${m.role === "owner" ? "text-gold-700" : "text-forest-700"}`}>
                        {ROLE_LABEL[m.role]}
                      </span>
                    )}
                  </span>
                  {(m.email || m.organization) && (
                    <span className="block text-[10px] text-sand-500 truncate">{[m.organization, m.email].filter(Boolean).join(" · ")}</span>
                  )}
                </span>
                {leader && m.role !== "owner" && (
                  <button
                    onClick={() => act(() => setClubRole(club.id, m.userId, m.role === "admin" ? "member" : "admin"))}
                    disabled={busy}
                    className="cursor-pointer shrink-0 px-1.5 py-0.5 rounded border border-sand-200 text-[10px] font-bold text-sand-700 hover:bg-sand-50"
                    title={m.role === "admin" ? "Make a member again" : "Make an admin (pengurus)"}
                  >
                    {m.role === "admin" ? "Remove admin" : "Make admin"}
                  </button>
                )}
                {canRemove && (
                  <button
                    onClick={() => act(() => removeClubMember(club.id, m.userId))}
                    disabled={busy}
                    className="cursor-pointer p-1 text-brick-600 hover:bg-brick-50 rounded"
                    aria-label={`Remove ${m.name}`}
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        {club.role === "owner" && (
          <p className="text-[10px] text-sand-500">Admins can add and remove members, make invite links, manage the workspace folders and pin posts.</p>
        )}
      </section>
    </div>
  );
};

const ITEM_ICON = { track: Route, area: Hexagon, place: MapPin, classic: Eye } as const;

const ClubWorkspaceTab = ({ club }: { club: Club }) => {
  const { setShownItem, setLowered } = useCommunityStore();
  const [folders, setFolders] = useState<ClubFolder[]>([]);
  const [items, setItems] = useState<ClubItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [folder, setFolder] = useState<string>("all"); // all | none | a folder id
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState<Attachment | null>(null);
  const [note, setNote] = useState("");
  const [pickerKey, setPickerKey] = useState(0);
  const [folderName, setFolderName] = useState<string | null>(null); // naming a new / renamed folder
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([fetchClubFolders(club.id), fetchClubItems(club.id)])
      .then(([f, i]) => {
        setFolders(f);
        setItems(i);
        setError(null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [club.id]);
  useEffect(load, [load]);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const current = folders.find((f) => f.id === folder) ?? null;
  const shownItems = items.filter((i) => (folder === "all" ? true : folder === "none" ? !i.folderId : i.folderId === folder));
  const canEditItem = (i: ClubItem) => i.isMine || club.canManage;

  const show = (i: ClubItem) =>
    act(async () => {
      if (i.kind === "classic") {
        if (i.token) window.open(`/?classic=${i.token}`, "_blank", "noopener");
        return;
      }
      const data = await fetchClubItemData(i.id);
      if (!data) throw new Error("This item is no longer available.");
      setShownItem(data);
      if (window.matchMedia("(max-width: 767px)").matches) setLowered(true);
    });
  const download = (i: ClubItem, format: ItemFormat) =>
    act(async () => {
      const data = await fetchClubItemData(i.id);
      const text = data && exportItem(data, format);
      if (!text) throw new Error("This item cannot be exported.");
      const type = format === "geojson" ? "application/geo+json" : format === "gpx" ? "application/gpx+xml" : "application/vnd.google-earth.kml+xml";
      saveBlob(new Blob([text], { type }), itemFileName(i.name, format));
    });
  const add = () =>
    act(async () => {
      if (!pending) return;
      await addClubItem(club.id, current?.id ?? null, pending, note);
      setPending(null);
      setNote("");
      setPickerKey((k) => k + 1);
      setAdding(false);
    });
  const saveFolder = () =>
    act(async () => {
      if (folderName === null) return;
      const id = await saveClubFolder(club.id, null, folderName);
      setFolderName(null);
      setFolder(id);
    });

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-sand-500 leading-snug">
        Copies of members&apos; tracks, areas, places and Field Works for the whole club: show them on the map or download them.
      </p>
      <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Folders">
        <button className={chip(folder === "all")} aria-pressed={folder === "all"} onClick={() => setFolder("all")}>
          All · {items.length}
        </button>
        {folders.map((f) => (
          <button key={f.id} className={chip(folder === f.id)} aria-pressed={folder === f.id} onClick={() => setFolder(f.id)}>
            <Folder size={9} className="inline -mt-0.5" /> {f.name} · {f.itemCount}
          </button>
        ))}
        {folders.length > 0 && items.some((i) => !i.folderId) && (
          <button className={chip(folder === "none")} aria-pressed={folder === "none"} onClick={() => setFolder("none")}>
            Not in a folder
          </button>
        )}
        {club.canManage && folderName === null && (
          <button onClick={() => setFolderName("")} className="cursor-pointer flex items-center gap-0.5 px-2 py-1 rounded-full border border-dashed border-sand-300 text-[10px] font-bold text-sand-700">
            <FolderPlus size={10} /> Folder
          </button>
        )}
      </div>
      {folderName !== null && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveFolder();
          }}
          className="flex gap-1.5"
        >
          <input autoFocus value={folderName} onChange={(e) => setFolderName(e.target.value)} maxLength={60} placeholder="Folder name, e.g. Gede 2026" aria-label="Folder name" className={field} />
          <button type="submit" disabled={busy || !folderName.trim()} className="cursor-pointer shrink-0 px-2.5 rounded-lg bg-forest-800 text-white text-[11px] font-bold disabled:opacity-40">
            Create
          </button>
          <button type="button" onClick={() => setFolderName(null)} className="cursor-pointer shrink-0 px-2 rounded-lg bg-sand-100 text-[11px] font-bold">
            Cancel
          </button>
        </form>
      )}
      {current && club.canManage && (
        <div className="flex items-center gap-2 text-[10px]">
          {renaming?.id === current.id ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                act(async () => {
                  await saveClubFolder(club.id, current.id, renaming.name);
                  setRenaming(null);
                });
              }}
              className="flex flex-1 gap-1.5"
            >
              <input autoFocus value={renaming.name} onChange={(e) => setRenaming({ id: current.id, name: e.target.value })} maxLength={60} aria-label="Folder name" className={field} />
              <button type="submit" className="cursor-pointer shrink-0 px-2 rounded-lg bg-forest-800 text-white font-bold">
                Save
              </button>
            </form>
          ) : (
            <>
              <button onClick={() => setRenaming({ id: current.id, name: current.name })} className="cursor-pointer font-bold text-sand-700 hover:underline">
                Rename folder
              </button>
              <button
                onClick={() =>
                  act(async () => {
                    await deleteClubFolder(current.id);
                    setFolder("all");
                  })
                }
                className="cursor-pointer font-bold text-brick-600 hover:underline"
              >
                Delete folder (keeps its items)
              </button>
            </>
          )}
        </div>
      )}

      {adding ? (
        <div className="rounded-lg border border-gold-200 bg-gold-50/30 p-2 space-y-1.5">
          <AttachmentPicker
            key={pickerKey}
            allowed
            value={pending}
            onChange={setPending}
            onError={setError}
            label={`Add your own map data${current ? ` to ${current.name}` : ""}`}
            maxTrackPoints={WORKSPACE_TRACK_POINTS}
          />
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Note for the club (optional)" aria-label="Note" className={field} />
          <div className="flex justify-end gap-1.5">
            <button onClick={() => setAdding(false)} className="cursor-pointer px-3 py-1 rounded-lg bg-sand-100 text-sand-700 text-[11px] font-bold">
              Cancel
            </button>
            <button onClick={add} disabled={busy || !pending} className="cursor-pointer px-3 py-1 rounded-lg bg-forest-800 text-white text-[11px] font-bold disabled:opacity-40">
              Add to workspace
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="cursor-pointer w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-dashed border-sand-300 hover:bg-sand-50 text-xs font-bold text-sand-700"
        >
          <Plus size={13} /> Add to workspace
        </button>
      )}
      <ErrorLine text={error} />
      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 size={16} className="animate-spin text-sand-500" />
        </div>
      ) : shownItems.length === 0 ? (
        <p className="py-4 text-center text-xs text-sand-500">Nothing here yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {shownItems.map((i) => {
            const Icon = ITEM_ICON[i.kind];
            return (
              <li key={i.id} className="rounded-lg border border-sand-200 bg-white px-2.5 py-2 space-y-1">
                <div className="flex items-start gap-2">
                  <Icon size={13} className="mt-0.5 shrink-0" style={{ color: i.color ?? "#2f5d3a" }} />
                  <div className="flex-1 min-w-0">
                    {renaming?.id === i.id ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          act(async () => {
                            await updateClubItem(i.id, { name: renaming.name, note: i.note ?? "", folderId: i.folderId });
                            setRenaming(null);
                          });
                        }}
                        className="flex gap-1"
                      >
                        <input autoFocus value={renaming.name} onChange={(e) => setRenaming({ id: i.id, name: e.target.value })} maxLength={120} aria-label="Name" className={field} />
                        <button type="submit" className="cursor-pointer shrink-0 px-2 rounded-lg bg-forest-800 text-white text-[10px] font-bold">
                          Save
                        </button>
                      </form>
                    ) : (
                      <div className="text-[11px] font-bold break-words">{i.name}</div>
                    )}
                    <div className="text-[10px] text-sand-500">
                      {i.kind === "classic" ? "Classic Field Work" : i.kind === "place" ? "Place" : i.kind === "area" ? "Area" : "Track"}
                      {i.distanceM ? ` · ${(i.distanceM / 1000).toFixed(1)} km` : ""} · {i.addedByName}
                    </div>
                    {i.note && <p className="text-[10px] text-sand-700 whitespace-pre-wrap break-words">{i.note}</p>}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                  <button onClick={() => show(i)} disabled={busy} className="cursor-pointer flex items-center gap-0.5 px-2 py-0.5 rounded bg-forest-800 text-white font-bold">
                    <MapPin size={10} /> {i.kind === "classic" ? "Open" : "Show on map"}
                  </button>
                  {i.kind !== "classic" && (
                    <select
                      value=""
                      onChange={(e) => e.target.value && download(i, e.target.value as ItemFormat)}
                      aria-label={`Download ${i.name}`}
                      className="cursor-pointer rounded border border-sand-200 bg-white px-1 py-0.5 font-bold"
                    >
                      <option value="">Download…</option>
                      <option value="gpx">GPX</option>
                      <option value="kml">KML</option>
                      <option value="geojson">GeoJSON</option>
                    </select>
                  )}
                  {canEditItem(i) && folders.length > 0 && (
                    <select
                      value={i.folderId ?? ""}
                      onChange={(e) => act(() => updateClubItem(i.id, { name: i.name, note: i.note ?? "", folderId: e.target.value || null }))}
                      aria-label={`Folder of ${i.name}`}
                      className="cursor-pointer rounded border border-sand-200 bg-white px-1 py-0.5"
                    >
                      <option value="">No folder</option>
                      {folders.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  )}
                  {canEditItem(i) && (
                    <span className="ml-auto flex items-center gap-1">
                      <button onClick={() => setRenaming({ id: i.id, name: i.name })} className="cursor-pointer p-0.5 text-sand-600" aria-label={`Rename ${i.name}`}>
                        <Pencil size={11} />
                      </button>
                      {confirmDelete === i.id ? (
                        <>
                          <button onClick={() => act(() => deleteClubItem(i.id))} className="cursor-pointer px-1.5 rounded bg-brick-600 text-white font-bold">
                            Delete
                          </button>
                          <button onClick={() => setConfirmDelete(null)} className="cursor-pointer px-1.5 rounded bg-sand-100 font-bold">
                            No
                          </button>
                        </>
                      ) : (
                        <button onClick={() => setConfirmDelete(i.id)} className="cursor-pointer p-0.5 text-brick-600" aria-label={`Delete ${i.name}`}>
                          <Trash2 size={11} />
                        </button>
                      )}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-[10px] text-sand-500">
        Up to {CLUB_LIMITS.items} items. You can rename, move or delete what you added; the leader and admins manage everything.
      </p>
    </div>
  );
};

// --- Club events (expeditions) ---------------------------------------------------------------

const STATE_STYLE: Record<EventState, string> = {
  planned: "bg-sand-100 text-sand-700 border-sand-200",
  running: "bg-forest-50 text-forest-800 border-forest-200",
  ended: "bg-white text-sand-500 border-sand-200",
  cancelled: "bg-brick-50 text-brick-600 border-brick-200",
};

const StateBadge = ({ state }: { state: EventState }) => (
  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wide ${STATE_STYLE[state]}`}>
    {state === "running" && <span className="w-1.5 h-1.5 rounded-full bg-forest-600 animate-pulse" />}
    {EVENT_STATE_LABEL[state]}
  </span>
);

const when = (start: number, end: number) => {
  const d = (t: number) => new Date(t).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  const h = (t: number) => new Date(t).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const sameDay = new Date(start).toDateString() === new Date(end).toDateString();
  return sameDay ? `${d(start)}, ${h(start)}–${h(end)}` : `${d(start)} ${h(start)} – ${d(end)} ${h(end)}`;
};

// <input type="datetime-local"> works in local time without a zone
const toLocalInput = (t: number) => {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const fromLocalInput = (v: string) => (v ? new Date(v).getTime() : NaN);

const ClubEventsTab = ({ club }: { club: Club }) => {
  const { openEvent } = useCommunityStore();
  const version = useCommunityStore((s) => s.version);
  const [past, setPast] = useState(false);
  const [events, setEvents] = useState<ClubEventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchClubEvents(club.id, past)
      .then((e) => {
        if (cancelled) return;
        setEvents(e);
        setError(null);
      })
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [club.id, past, version]);

  if (creating) return <EventForm clubId={club.id} event={null} onDone={(id) => (id ? openEvent(id) : setCreating(false))} />;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <button className={pill(!past)} aria-pressed={!past} onClick={() => setPast(false)}>
          Upcoming
        </button>
        <button className={pill(past)} aria-pressed={past} onClick={() => setPast(true)}>
          Past
        </button>
        {club.canManage && (
          <button
            onClick={() => setCreating(true)}
            className="cursor-pointer ml-auto inline-flex items-center gap-1 h-7 px-3 rounded-full bg-forest-800 hover:bg-forest-700 text-white text-[11px] font-bold"
          >
            <Plus size={12} /> New event
          </button>
        )}
      </div>
      <ErrorLine text={error} />
      {loading ? (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-sand-100 animate-pulse" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={past ? "No past events" : "No events planned"}
          text={
            club.canManage
              ? "Plan a trip or field exercise: time, meeting point, route, who comes, and a gear checklist."
              : "When the leader or an admin plans a trip, it shows up here."
          }
        />
      ) : (
        <ul className="space-y-2">
          {events.map((e) => (
            <li key={e.id}>
              <button
                onClick={() => openEvent(e.id)}
                className="cursor-pointer w-full text-left rounded-xl border border-sand-200 bg-white shadow-sm hover:shadow-md hover:border-gold-300 transition-all p-3 space-y-1"
              >
                <span className="flex items-center gap-2">
                  <StateBadge state={e.state} />
                  {e.myStatus && (
                    <span className="text-[9px] font-bold uppercase text-forest-700">{e.myStatus === "going" ? "You're going" : e.myStatus === "pending" ? "Waiting for approval" : "Declined"}</span>
                  )}
                  {e.sharingCount > 0 && (
                    <span className="ml-auto inline-flex items-center gap-0.5 text-[10px] font-bold text-[#1f6feb]">
                      <Radio size={11} /> {e.sharingCount} live
                    </span>
                  )}
                </span>
                <span className="block text-[13px] font-bold text-ink">{e.title}</span>
                <span className="block text-[10px] text-sand-600">
                  {when(e.startsAt, e.endsAt)}
                  {e.meetingName ? ` · ${e.meetingName}` : ""}
                </span>
                <span className="block text-[10px] text-sand-500">
                  {e.goingCount}
                  {e.quota ? `/${e.quota}` : ""} going{e.pendingCount ? ` · ${e.pendingCount} waiting` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/** New event (event null) or editing one; onDone gets the id, or null when cancelled */
const EventForm = ({ clubId, event, onDone }: { clubId: string; event: ClubEvent | null; onDone: (id: string | null) => void }) => {
  const { picking, picked, startPicking, stopPicking } = useCommunityStore();
  const [input, setInput] = useState<EventInput>(() => {
    const start = event?.startsAt ?? Math.ceil((Date.now() + 86400000) / 3600000) * 3600000;
    return {
      title: event?.title ?? "",
      description: event?.description ?? "",
      startsAt: start,
      endsAt: event?.endsAt ?? start + 2 * 86400000,
      meetingName: event?.meetingName ?? "",
      meeting: event?.meetingLat !== null && event?.meetingLat !== undefined && event.meetingLng !== null ? [event.meetingLng, event.meetingLat] : null,
      routeItemId: event?.routeItemId ?? null,
      quota: event?.quota ?? null,
      needsApproval: event?.needsApproval ?? false,
    };
  });
  const [routes, setRoutes] = useState<ClubItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickingMeeting, setPickingMeeting] = useState(false);
  const set = <K extends keyof EventInput>(k: K, v: EventInput[K]) => setInput((i) => ({ ...i, [k]: v }));

  useEffect(() => {
    fetchClubItems(clubId).then((items) => setRoutes(items.filter((i) => i.kind === "track" || i.kind === "area")), () => undefined);
  }, [clubId]);
  // The point tapped on the map becomes the meeting point
  const [seenPick, setSeenPick] = useState(picked);
  if (picked !== seenPick) {
    setSeenPick(picked);
    if (pickingMeeting && picked) {
      setInput((i) => ({ ...i, meeting: picked }));
      setPickingMeeting(false);
    }
  }

  const save = async () => {
    const problem = eventInputError(input, !event);
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    try {
      onDone(await saveClubEvent(clubId, event?.id ?? null, input));
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  if (picking && pickingMeeting) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <Crosshair size={14} className="text-gold-700 animate-pulse" />
        <span className="flex-1 font-bold">Tap the meeting point on the map</span>
        <button
          onClick={() => {
            stopPicking();
            setPickingMeeting(false);
          }}
          className="cursor-pointer px-2 py-1 rounded-lg bg-sand-100 font-bold"
        >
          Cancel
        </button>
      </div>
    );
  }

  const label = "text-[10px] font-bold uppercase tracking-wider text-sand-600";
  return (
    <div className="space-y-2.5">
      <h4 className="text-sm font-bold">{event ? "Edit event" : "New event"}</h4>
      <label className="block space-y-0.5">
        <span className={label}>Title *</span>
        <input value={input.title} onChange={(e) => set("title", e.target.value)} maxLength={80} placeholder="e.g. Gede-Pangrango via Cibodas" className={field} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block space-y-0.5">
          <span className={label}>Starts *</span>
          <input type="datetime-local" value={toLocalInput(input.startsAt)} onChange={(e) => set("startsAt", fromLocalInput(e.target.value))} className={field} />
        </label>
        <label className="block space-y-0.5">
          <span className={label}>Ends *</span>
          <input type="datetime-local" value={toLocalInput(input.endsAt)} onChange={(e) => set("endsAt", fromLocalInput(e.target.value))} className={field} />
        </label>
      </div>
      <label className="block space-y-0.5">
        <span className={label}>Plan</span>
        <textarea
          value={input.description}
          onChange={(e) => set("description", e.target.value)}
          maxLength={2000}
          rows={4}
          placeholder="Itinerary, cost, what to bring, who to contact…"
          className={`${field} resize-y`}
        />
      </label>
      <div className="space-y-1">
        <span className={label}>Meeting point</span>
        <input value={input.meetingName} onChange={(e) => set("meetingName", e.target.value)} maxLength={120} placeholder="e.g. Basecamp Cibodas" className={field} />
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => {
              setPickingMeeting(true);
              startPicking();
            }}
            className="cursor-pointer flex items-center gap-1 px-2 py-1 rounded-lg bg-sand-100 hover:bg-sand-200 text-[10px] font-bold"
          >
            <MapPin size={11} /> {input.meeting ? "Move on map" : "Pick on map"}
          </button>
          {input.meeting && (
            <>
              <span className="text-[10px] text-sand-500 tabular-nums">
                {input.meeting[1].toFixed(5)}, {input.meeting[0].toFixed(5)}
              </span>
              <button onClick={() => set("meeting", null)} className="cursor-pointer text-[10px] font-bold text-brick-600">
                Remove
              </button>
            </>
          )}
        </div>
      </div>
      <label className="block space-y-0.5">
        <span className={label}>Planned route (from the workspace)</span>
        <select value={input.routeItemId ?? ""} onChange={(e) => set("routeItemId", e.target.value || null)} className={field}>
          <option value="">None</option>
          {routes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.kind === "track" ? "Track" : "Area"}: {r.name}
            </option>
          ))}
        </select>
        {routes.length === 0 && <span className="block text-[10px] text-sand-500">Add a track or area to the club workspace to use it as the route.</span>}
      </label>
      <div className="grid grid-cols-2 gap-2 items-end">
        <label className="block space-y-0.5">
          <span className={label}>Places</span>
          <input
            type="number"
            min={1}
            max={500}
            value={input.quota ?? ""}
            onChange={(e) => set("quota", e.target.value ? Number(e.target.value) : null)}
            placeholder="No limit"
            className={field}
          />
        </label>
        <label className="flex items-center gap-2 pb-1.5 text-[11px] text-sand-700 cursor-pointer">
          <input type="checkbox" checked={input.needsApproval} onChange={(e) => set("needsApproval", e.target.checked)} className="accent-forest-800" />
          Approve who comes
        </label>
      </div>
      <ErrorLine text={error} />
      <div className="flex justify-end gap-1.5">
        <button onClick={() => onDone(null)} disabled={busy} className="cursor-pointer px-3 py-1.5 rounded-lg bg-sand-100 text-sand-700 text-xs font-bold">
          Cancel
        </button>
        <button onClick={save} disabled={busy} className="cursor-pointer flex items-center gap-1 px-3 py-1.5 rounded-lg bg-forest-800 hover:bg-forest-700 text-white text-xs font-bold disabled:opacity-50">
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} {event ? "Save" : "Create event"}
        </button>
      </div>
    </div>
  );
};

const EventView = () => {
  const { eventId, openClub, setLive, setShownItem, setLowered, setFeedClub, openCompose, refresh } = useCommunityStore();
  const user = useSurveyStore((s) => s.user);
  const [event, setEvent] = useState<ClubEvent | null>(null);
  const [people, setPeople] = useState<EventParticipant[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [positions, setPositions] = useState<LivePosition[]>([]);
  const [trailOf, setTrailOf] = useState<string | null>(null);
  const [myTrail, setMyTrail] = useState<ReturnType<typeof trailSummary> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [joining, setJoining] = useState(false);
  const [contact, setContact] = useState({ name: "", phone: "" });
  const [newItem, setNewItem] = useState("");
  const [confirm, setConfirm] = useState<"cancel" | "delete" | "leave" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    if (!eventId) return;
    try {
      const [e, p, c] = await Promise.all([fetchClubEvent(eventId), fetchParticipants(eventId), fetchChecklist(eventId)]);
      setEvent(e);
      setPeople(p);
      setChecklist(c);
      setError(e ? null : "This event is no longer available.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [eventId]);
  useEffect(() => {
    load();
  }, [load]);

  // Live positions: every 30 s while the event page is open (running, or ended within 30 days)
  const showsLive = !!event && (event.state === "running" || event.state === "ended");
  useEffect(() => {
    if (!eventId || !showsLive) return;
    let cancelled = false;
    const tick = () =>
      fetchLiveLatest(eventId).then(
        (pos) => {
          if (cancelled) return;
          setPositions(pos);
          setNow(Date.now());
        },
        () => undefined,
      );
    tick();
    const timer = setInterval(tick, 30000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [eventId, showsLive]);

  // The positions (and the chosen trail) go to the map layer
  const [trail, setTrail] = useState<{ userId: string; coords: LngLat[] } | null>(null);
  const [fit, setFit] = useState(0);
  useEffect(() => {
    setLive(showsLive ? { positions, trail, fit } : null);
  }, [showsLive, positions, trail, fit, setLive]);
  useEffect(() => () => setLive(null), [setLive]);

  useEffect(() => {
    if (!eventId || !trailOf) return;
    let cancelled = false;
    fetchLiveTrail(eventId, trailOf).then(
      (pts) => !cancelled && setTrail({ userId: trailOf, coords: pts.map((p) => [p.lng, p.lat] as LngLat) }),
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [eventId, trailOf, positions]);

  // After the event: your own summary, if you shared
  const iShared = positions.some((p) => p.isMe);
  useEffect(() => {
    if (!eventId || event?.state !== "ended" || !iShared || !user) return;
    fetchLiveTrail(eventId, user.id).then((pts) => setMyTrail(trailSummary(pts)), () => undefined);
  }, [eventId, event?.state, iShared, user]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 size={18} className="animate-spin text-sand-500" />
      </div>
    );
  }
  if (!event) return <ErrorLine text={error ?? "This event is no longer available."} />;
  if (editing) {
    return (
      <EventForm
        clubId={event.clubId}
        event={event}
        onDone={(id) => {
          setEditing(false);
          if (id) {
            refresh();
            load();
          }
        }}
      />
    );
  }

  const act = async (fn: () => Promise<unknown>, after?: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
      if (after) setNotice(after);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const lowerOnPhone = () => window.matchMedia("(max-width: 767px)").matches && setLowered(true);
  const showMeeting = () => {
    if (event.meetingLat === null || event.meetingLng === null) return;
    setShownItem({ kind: "place", name: event.meetingName ?? "Meeting point", category: "meeting", geometry: { type: "Point", coordinates: [event.meetingLng, event.meetingLat] } });
    lowerOnPhone();
  };
  const showRoute = () =>
    act(async () => {
      if (!event.routeItemId) return;
      const data = await fetchClubItemData(event.routeItemId);
      if (data) {
        setShownItem(data);
        lowerOnPhone();
      }
    });
  const join = () =>
    act(async () => {
      const status = await joinClubEvent(event.id, contact.name, contact.phone);
      setJoining(false);
      refresh();
      setNotice(status === "pending" ? "Request sent. The organisers will approve it." : "You're going.");
    });
  const ended = event.state === "ended" || event.state === "cancelled";
  const going = people.filter((p) => p.status === "going");
  const pending = people.filter((p) => p.status === "pending");
  const sharingPeople = positions.length;
  const label = "text-[10px] font-bold uppercase tracking-wider text-sand-600";

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <StateBadge state={event.state} />
          <span className="text-[10px] text-sand-500 truncate">{event.clubName}</span>
        </div>
        <h4 className="text-base font-bold text-ink leading-snug">{event.title}</h4>
        <p className="text-[11px] text-sand-700">
          <CalendarDays size={11} className="inline -mt-0.5" /> {when(event.startsAt, event.endsAt)}
        </p>
        {event.meetingName && (
          <p className="text-[11px] text-sand-700">
            <MapPin size={11} className="inline -mt-0.5" /> {event.meetingName}
          </p>
        )}
        <p className="text-[10px] text-sand-500">Organised by {event.createdByName}</p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {event.meetingLat !== null && (
          <button onClick={showMeeting} className={pill(false)}>
            <MapPin size={11} /> Meeting point
          </button>
        )}
        {event.routeItemId && (
          <button onClick={showRoute} disabled={busy} className={pill(false)}>
            <Route size={11} /> Route{event.routeName ? `: ${event.routeName}` : ""}
          </button>
        )}
      </div>
      {event.description && <p className="text-xs text-ink whitespace-pre-wrap break-words leading-relaxed">{event.description}</p>}

      {/* Your place in it */}
      {!ended && (
        <div className="rounded-xl border border-sand-200 bg-white p-3 space-y-2">
          {event.myStatus === "going" || event.myStatus === "pending" ? (
            <>
              <p className="text-xs font-bold text-forest-800">
                {event.myStatus === "going" ? "You're going." : "Waiting for the organisers to approve you."}
              </p>
              {event.myEmergencyName || event.myEmergencyPhone ? (
                <p className="text-[10px] text-sand-600">
                  Emergency contact: {[event.myEmergencyName, event.myEmergencyPhone].filter(Boolean).join(" · ")}
                </p>
              ) : null}
            </>
          ) : event.myStatus === "declined" ? (
            <p className="text-xs text-brick-600">The organisers declined your request for this event.</p>
          ) : (
            <p className="text-xs text-sand-700">
              {going.length}
              {event.quota ? ` of ${event.quota}` : ""} going{event.needsApproval ? " · the organisers approve who comes" : ""}.
            </p>
          )}
          {joining ? (
            <div className="space-y-1.5">
              <p className="text-[10px] text-sand-600">Emergency contact (optional): only the organisers see it.</p>
              <div className="grid grid-cols-2 gap-1.5">
                <input value={contact.name} onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))} maxLength={80} placeholder="Name" aria-label="Emergency contact name" className={field} />
                <input value={contact.phone} onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))} maxLength={30} placeholder="Phone" inputMode="tel" aria-label="Emergency contact phone" className={field} />
              </div>
              <div className="flex justify-end gap-1.5">
                <button onClick={() => setJoining(false)} className="cursor-pointer px-3 py-1 rounded-lg bg-sand-100 text-[11px] font-bold">
                  Cancel
                </button>
                <button onClick={join} disabled={busy} className="cursor-pointer px-3 py-1 rounded-lg bg-forest-800 text-white text-[11px] font-bold disabled:opacity-50">
                  {event.myStatus ? "Save" : event.needsApproval ? "Ask to join" : "Join"}
                </button>
              </div>
            </div>
          ) : event.myStatus !== "declined" ? (
            <div className="flex flex-wrap gap-1.5">
              {!event.myStatus && (
                <button
                  onClick={() => setJoining(true)}
                  className="cursor-pointer inline-flex items-center gap-1 h-8 px-3.5 rounded-full bg-forest-800 hover:bg-forest-700 text-white text-xs font-bold"
                >
                  <Check size={13} /> {event.needsApproval ? "Ask to join" : "I'm going"}
                </button>
              )}
              {event.myStatus && (
                <>
                  <button
                    onClick={() => {
                      setContact({ name: event.myEmergencyName ?? "", phone: event.myEmergencyPhone ?? "" });
                      setJoining(true);
                    }}
                    className={pill(false)}
                  >
                    <Phone size={11} /> Emergency contact
                  </button>
                  {confirm === "leave" ? (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-brick-600">
                      Leave?
                      <button onClick={() => act(() => leaveClubEvent(event.id))} className="cursor-pointer px-2 py-0.5 rounded bg-brick-600 text-white">
                        Yes
                      </button>
                      <button onClick={() => setConfirm(null)} className="cursor-pointer px-2 py-0.5 rounded bg-sand-100 text-sand-700">
                        No
                      </button>
                    </span>
                  ) : (
                    <button onClick={() => setConfirm("leave")} className={pill(false)}>
                      Not going
                    </button>
                  )}
                </>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* Live tracking */}
      {(event.state === "running" || event.state === "planned" || sharingPeople > 0) && event.state !== "cancelled" && (
        <section className="rounded-xl border border-[#1f6feb]/25 bg-[#1f6feb]/5 p-3 space-y-2" aria-label="Live positions">
          <div className="flex items-center gap-2">
            <Radio size={14} className="text-[#1f6feb]" />
            <span className="text-xs font-bold text-ink">Live positions</span>
            {sharingPeople > 0 && (
              <button
                onClick={() => {
                  setFit((f) => f + 1);
                  lowerOnPhone();
                }}
                className="cursor-pointer ml-auto text-[10px] font-bold text-[#1f6feb] hover:underline"
              >
                Show on map
              </button>
            )}
          </div>
          {event.iAmSharing ? (
            <div className="flex items-center gap-2 text-[11px]">
              <span className="w-2 h-2 rounded-full bg-[#1f6feb] animate-pulse" />
              <span className="flex-1">You are sharing your position with {event.clubName} until the event ends.</span>
              <button onClick={() => act(() => stopLiveSharing(event.id), "You stopped sharing your position.")} disabled={busy} className="cursor-pointer px-2 py-0.5 rounded bg-white border border-sand-200 font-bold">
                Stop
              </button>
            </div>
          ) : event.myStatus === "going" ? (
            <p className="flex items-start gap-1.5 text-[11px] text-sand-700">
              <Smartphone size={13} className="shrink-0 mt-0.5" />
              <span>
                Share your position from the <strong>Landscape 360 Mobile App</strong> (open this event there and turn on Share my position). It
                works from 2 hours before the start and stops by itself when the event ends.
              </span>
            </p>
          ) : (
            <p className="text-[11px] text-sand-600">Participants who are going can share their position from the mobile app while the event runs.</p>
          )}
          {positions.length === 0 ? (
            showsLive && <p className="text-[10px] text-sand-500">No one has shared a position yet.</p>
          ) : (
            <ul className="divide-y divide-[#1f6feb]/10">
              {positions.map((p) => {
                const mins = minutesAgo(p.recordedAt, now);
                const missing = p.sharing && mins > LIVE_MISSING_MIN;
                return (
                  <li key={p.userId}>
                    <button
                      onClick={() => {
                        setTrailOf(trailOf === p.userId ? null : p.userId);
                        setTrail(null);
                      }}
                      aria-pressed={trailOf === p.userId}
                      className="cursor-pointer w-full flex items-center gap-2 py-1.5 text-left"
                    >
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${!p.sharing || mins > LIVE_STALE_MIN ? "bg-sand-400" : "bg-[#1f6feb]"}`} />
                      <span className="flex-1 min-w-0">
                        <span className="block text-[11px] font-bold truncate">
                          {p.name}
                          {p.isMe ? " (you)" : ""}
                        </span>
                        <span className={`block text-[10px] ${missing ? "text-brick-600 font-bold" : "text-sand-500"}`}>
                          {missing ? `Not seen for ${mins} min` : mins === 0 ? "Just now" : `${mins} min ago`}
                          {p.sharing ? "" : " · stopped"}
                          {p.altitudeM !== null ? ` · ${Math.round(p.altitudeM)} m` : ""}
                          {p.battery !== null ? ` · battery ${p.battery}%` : ""}
                        </span>
                      </span>
                      <span className="text-[10px] font-bold text-[#1f6feb] shrink-0">{trailOf === p.userId ? "Hide trail" : "Trail"}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {/* After the event */}
      {event.state === "ended" && (
        <section className="rounded-xl border border-gold-200 bg-gold-50/40 p-3 space-y-2">
          <div className="text-xs font-bold">After the trip</div>
          {myTrail && myTrail.points > 1 && (
            <div className="grid grid-cols-3 gap-1.5 text-center">
              <div className="rounded-lg bg-white border border-sand-200 py-1.5">
                <div className="text-sm font-bold">{(myTrail.distanceM / 1000).toFixed(1)} km</div>
                <div className="text-[9px] text-sand-500">distance</div>
              </div>
              <div className="rounded-lg bg-white border border-sand-200 py-1.5">
                <div className="text-sm font-bold">
                  {Math.floor(myTrail.movingMs / 3600000)}h {Math.round((myTrail.movingMs % 3600000) / 60000)}m
                </div>
                <div className="text-[9px] text-sand-500">moving</div>
              </div>
              <div className="rounded-lg bg-white border border-sand-200 py-1.5">
                <div className="text-sm font-bold">{Math.round(myTrail.gainM)} m</div>
                <div className="text-[9px] text-sand-500">climbed</div>
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            {myTrail && myTrail.points > 1 && user && (
              <button
                onClick={() =>
                  act(async () => {
                    const pts = await fetchLiveTrail(event.id, user.id);
                    await addClubItem(
                      event.clubId,
                      null,
                      trackAttachment(`${event.title} (live track)`, myTrail.distanceM, pts, WORKSPACE_TRACK_POINTS),
                      `Shared live during ${event.title}`,
                    );
                  }, "Your track is in the club workspace.")
                }
                disabled={busy}
                className={pill(false)}
              >
                <Folder size={11} /> Save my track to the workspace
              </button>
            )}
            <button
              onClick={() => {
                setFeedClub(event.clubId);
                openCompose();
              }}
              className={pill(true)}
            >
              <Pencil size={11} /> Write a story
            </button>
          </div>
        </section>
      )}

      {/* Checklist */}
      {(checklist.length > 0 || event.canManage) && (
        <section className="space-y-1.5" aria-label="Checklist">
          <div className={label}>Checklist</div>
          <ul className="rounded-xl border border-sand-200 bg-white divide-y divide-sand-100">
            {checklist.map((i) => (
              <li key={i.id} className="flex items-center gap-2 px-3 py-1.5">
                <label className="flex-1 flex items-center gap-2 text-[11px] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={i.checked}
                    disabled={busy || !(event.myStatus === "going" || event.myStatus === "pending")}
                    onChange={() =>
                      act(async () => {
                        const on = await toggleCheck(i.id);
                        setChecklist((c) => c.map((x) => (x.id === i.id ? { ...x, checked: on } : x)));
                      })
                    }
                    className="accent-forest-800"
                  />
                  <span className={i.checked ? "line-through text-sand-500" : ""}>{i.label}</span>
                </label>
                <span className="text-[9px] text-sand-500 tabular-nums">
                  {i.checkedCount}/{going.length + pending.length || 0}
                </span>
                {event.canManage && (
                  <button onClick={() => act(() => deleteChecklistItem(i.id))} className="cursor-pointer p-0.5 text-brick-600" aria-label={`Remove ${i.label}`}>
                    <X size={11} />
                  </button>
                )}
              </li>
            ))}
            {checklist.length === 0 && <li className="px-3 py-2 text-[10px] text-sand-500">No items yet.</li>}
          </ul>
          {event.canManage && !ended && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (newItem.trim())
                  act(async () => {
                    await addChecklistItem(event.id, newItem);
                    setNewItem("");
                  });
              }}
              className="flex gap-1.5"
            >
              <input value={newItem} onChange={(e) => setNewItem(e.target.value)} maxLength={80} placeholder="Add gear, e.g. Headlamp" aria-label="Checklist item" className={field} />
              <button type="submit" disabled={busy || !newItem.trim()} className="cursor-pointer shrink-0 px-3 rounded-lg bg-forest-800 text-white text-[11px] font-bold disabled:opacity-40">
                Add
              </button>
            </form>
          )}
        </section>
      )}

      {/* Participants */}
      <section className="space-y-1.5" aria-label="Participants">
        <div className={label}>
          Going · {going.length}
          {event.quota ? `/${event.quota}` : ""}
          {pending.length > 0 && event.canManage ? ` · ${pending.length} waiting` : ""}
        </div>
        <ul className="rounded-xl border border-sand-200 bg-white divide-y divide-sand-100">
          {people.map((p) => {
            const missing = p.sharing && p.lastSeenAt !== null && minutesAgo(p.lastSeenAt, now) > LIVE_MISSING_MIN;
            return (
              <li key={p.userId} className="flex items-center gap-2 px-3 py-1.5">
                <Initial name={p.name} />
                <span className="flex-1 min-w-0">
                  <span className="block text-[11px] font-bold truncate">
                    {p.name}
                    {p.isMe ? " (you)" : ""}
                    {p.status !== "going" && <span className="ml-1 text-[9px] uppercase text-gold-700">{p.status === "pending" ? "waiting" : "declined"}</span>}
                    {p.sharing && <Radio size={10} className="inline ml-1 text-[#1f6feb]" aria-label="sharing" />}
                  </span>
                  {(p.emergencyName || p.emergencyPhone) && (
                    <span className="block text-[10px] text-sand-600 truncate">
                      SOS: {p.emergencyName}
                      {p.emergencyPhone && (
                        <>
                          {" "}
                          <a href={`tel:${p.emergencyPhone.replace(/[^\d+]/g, "")}`} className="font-bold text-forest-700">
                            {p.emergencyPhone}
                          </a>
                        </>
                      )}
                    </span>
                  )}
                  {missing && <span className="block text-[10px] font-bold text-brick-600">Not seen for over {LIVE_MISSING_MIN} min</span>}
                </span>
                {checklist.length > 0 && <span className="text-[9px] text-sand-500 tabular-nums">{p.checkedCount}/{checklist.length}</span>}
                {event.canManage && p.status === "pending" && (
                  <span className="flex gap-1">
                    <button onClick={() => act(() => decideParticipant(event.id, p.userId, "going"))} disabled={busy} className="cursor-pointer px-2 py-0.5 rounded bg-forest-800 text-white text-[10px] font-bold">
                      Approve
                    </button>
                    <button onClick={() => act(() => decideParticipant(event.id, p.userId, "declined"))} disabled={busy} className="cursor-pointer px-2 py-0.5 rounded bg-sand-100 text-[10px] font-bold">
                      Decline
                    </button>
                  </span>
                )}
              </li>
            );
          })}
          {people.length === 0 && <li className="px-3 py-2 text-[10px] text-sand-500">No one yet.</li>}
        </ul>
      </section>

      {notice && <p className="text-[11px] font-bold text-forest-700">{notice}</p>}
      <ErrorLine text={error} />

      {event.canManage && (
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-sand-200 text-[11px]">
          {event.state !== "cancelled" && event.state !== "ended" && (
            <button onClick={() => setEditing(true)} className="cursor-pointer flex items-center gap-1 font-bold text-sand-700 hover:underline">
              <Pencil size={11} /> Edit
            </button>
          )}
          {confirm === "cancel" || confirm === "delete" ? (
            <span className="flex items-center gap-1 font-bold text-brick-600">
              {confirm === "cancel" ? "Cancel the event for everyone?" : "Delete the event and its positions?"}
              <button
                onClick={() =>
                  act(async () => {
                    if (confirm === "cancel") await cancelClubEvent(event.id);
                    else {
                      await deleteClubEvent(event.id);
                      refresh();
                      openClub(event.clubId);
                    }
                    setConfirm(null);
                  })
                }
                className="cursor-pointer px-2 py-0.5 rounded bg-brick-600 text-white"
              >
                Yes
              </button>
              <button onClick={() => setConfirm(null)} className="cursor-pointer px-2 py-0.5 rounded bg-sand-100 text-sand-700">
                No
              </button>
            </span>
          ) : (
            <>
              {event.state !== "cancelled" && event.state !== "ended" && (
                <button onClick={() => setConfirm("cancel")} className="cursor-pointer font-bold text-brick-600 hover:underline">
                  Cancel event
                </button>
              )}
              <button onClick={() => setConfirm("delete")} className="cursor-pointer font-bold text-brick-600 hover:underline">
                Delete
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// --- Admin: reports ------------------------------------------------------------------------------

const ReportsView = () => {
  const { openPost, refresh } = useCommunityStore();
  const [items, setItems] = useState<ReportQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    fetchReportQueue()
      .then((r) => {
        setItems(r);
        setError(null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const run = async (fn: () => Promise<void>) => {
    try {
      await fn();
      refresh();
      setLoading(true);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="space-y-2">
      <ErrorLine text={error} />
      {loading && <Loader2 size={16} className="animate-spin text-sand-500 mx-auto" />}
      {!loading && items.length === 0 && <p className="py-6 text-center text-xs text-sand-500">Nothing reported. All clear.</p>}
      {items.map((it) => (
        <div key={`${it.targetKind}:${it.targetId}`} className="rounded-lg border border-sand-200 bg-white p-2.5 space-y-1.5 text-[11px]">
          <div className="flex items-center gap-2">
            <span className="font-bold capitalize">{it.targetKind}</span>
            <span className="px-1.5 rounded-full bg-brick-50 text-brick-600 font-bold">{it.reports} report{it.reports === 1 ? "" : "s"}</span>
            <span className="text-sand-500">· {it.status}</span>
            <button onClick={() => openPost(it.postId)} className="cursor-pointer ml-auto font-bold text-gold-700 hover:underline">
              Open
            </button>
          </div>
          <p className="text-sand-700 line-clamp-3">{it.excerpt}</p>
          <p className="text-[10px] text-sand-500">
            By {it.authorName}
            {it.authorBanned ? " (blocked)" : ""} · {it.reasons.map((r) => REPORT_REASONS.find((x) => x.id === r)?.label ?? r).join(", ")}
          </p>
          {it.notes.length > 0 && <p className="text-[10px] text-sand-500 italic">“{it.notes.join("” · “")}”</p>}
          <div className="flex flex-wrap gap-1">
            <button onClick={() => run(() => moderate(it.targetKind, it.targetId, "restore"))} className="cursor-pointer px-2 py-0.5 rounded bg-sand-100 font-bold">
              Restore
            </button>
            <button onClick={() => run(() => moderate(it.targetKind, it.targetId, "hide"))} className="cursor-pointer px-2 py-0.5 rounded bg-sand-100 font-bold">
              Hide
            </button>
            <button onClick={() => run(() => moderate(it.targetKind, it.targetId, "remove"))} className="cursor-pointer px-2 py-0.5 rounded bg-brick-600 text-white font-bold">
              Remove
            </button>
            {it.authorBanned ? (
              <button onClick={() => run(() => setBan(it.authorId, 0))} className="cursor-pointer px-2 py-0.5 rounded bg-sand-100 font-bold">
                Unblock author
              </button>
            ) : (
              <>
                <button onClick={() => run(() => setBan(it.authorId, 7, it.reasons.join(", ")))} className="cursor-pointer px-2 py-0.5 rounded bg-sand-100 font-bold">
                  Block 7 days
                </button>
                <button onClick={() => run(() => setBan(it.authorId, null, it.reasons.join(", ")))} className="cursor-pointer px-2 py-0.5 rounded bg-sand-100 font-bold">
                  Block
                </button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

// --- Panel -------------------------------------------------------------------------------------

// Community: trail reports and trip stories on the map (COMMUNITY_PRD.md). Anyone can read;
// signed-in accounts post within their plan's daily limits; the admin moderates.
export const CommunityPanel = () => {
  const { isPanelOpen, setPanelOpen, view, listView, openFeed, openMine, openClubs, openClub, openReports, editing, postId, clubId } =
    useCommunityStore();
  const { user, isAdmin } = useSurveyStore();
  const clubs = useMyClubs(!!user);
  const isTrackRecorderOpen = useTrackRecorderStore((s) => s.isPanelOpen);
  const isMarkedLocationsOpen = useMarkedLocationStore((s) => s.isPanelOpen);
  const isMarkedAreasOpen = useMarkedAreaStore((s) => s.isPanelOpen);
  const isClassicOpen = useClassicStore((s) => s.isPanelOpen);

  // The other bottom panels use the same spot on screen
  useEffect(() => {
    if (isTrackRecorderOpen || isMarkedLocationsOpen || isMarkedAreasOpen || isClassicOpen) setPanelOpen(false);
  }, [isTrackRecorderOpen, isMarkedLocationsOpen, isMarkedAreasOpen, isClassicOpen, setPanelOpen]);

  // Phone: a bottom sheet like the app's. Dragging it down lowers it to its header so the map
  // can be seen; a tap or a drag up brings it back. Desktop: a floating panel (minimizable).
  const [isPhone, setIsPhone] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const onChange = () => setIsPhone(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  const lowered = useCommunityStore((s) => s.lowered);
  const setLoweredTo = useCommunityStore((s) => s.setLowered);
  const setLowered = (v: boolean | ((old: boolean) => boolean)) => setLoweredTo(typeof v === "function" ? v(lowered) : v);
  // Opening another view or post (e.g. a tap on a dot on the map) brings the sheet back up
  const [shown, setShown] = useState(`${view}:${postId}`);
  if (shown !== `${view}:${postId}`) {
    setShown(`${view}:${postId}`);
    setLowered(false);
  }
  const [drag, setDrag] = useState<number | null>(null);
  const dragStart = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    dragStart.current = e.touches[0].clientY;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (dragStart.current === null) return;
    const dy = e.touches[0].clientY - dragStart.current;
    // Down while open, up while lowered
    if ((!lowered && dy > 6) || (lowered && dy < -6)) setDrag(dy);
  };
  const onTouchEnd = () => {
    if (drag !== null) {
      if (!lowered && drag > 60) setLowered(true);
      else if (lowered && drag < -40) setLowered(false);
    }
    dragStart.current = null;
    setDrag(null);
  };

  if (!isPanelOpen) return null;
  const signedIn = !!user;
  const isSubView = !["feed", "clubs", "mine"].includes(view);
  const back =
    view === "event" && clubId
      ? () => openClub(clubId)
      : view === "club"
        ? openClubs
        : listView === "mine"
          ? openMine
          : listView === "clubs"
            ? openClubs
            : openFeed;
  const newClubPosts = clubs.reduce((n, c) => n + c.newPosts, 0);
  const title =
    view === "compose"
      ? editing
        ? "Edit post"
        : "New post"
      : view === "reports"
        ? "Reported posts"
        : view === "club"
          ? "Club"
          : view === "event"
            ? "Event"
            : view === "post"
            ? "Post"
            : "Community";

  return (
    <div
      data-community-panel
      style={isPhone && drag !== null ? { transform: `translateY(${lowered ? 0 : Math.max(0, drag)}px)`, transition: "none" } : undefined}
      className={`fixed z-[60] flex flex-col bg-white/95 backdrop-blur-md text-ink shadow-2xl overflow-hidden transition-transform duration-300 ${
        isPhone
          ? "inset-x-0 bottom-0 rounded-t-2xl border-t border-sand-300 max-h-[75dvh] pb-[env(safe-area-inset-bottom)]"
          : "left-1/2 -translate-x-1/2 bottom-6 w-[420px] max-h-[75vh] max-h-[75dvh] border border-gold-200 rounded-xl animate-in fade-in slide-in-from-bottom-4 duration-200"
      }`}
    >
      {/* Phone: handle, drag here (or on the header) to lower or raise the sheet */}
      {isPhone && (
        <button
          onClick={() => setLowered((v) => !v)}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          className="cursor-grab touch-none w-full flex justify-center pt-2.5 pb-1 shrink-0"
          aria-label={lowered ? "Raise the Community sheet" : "Lower the Community sheet"}
          aria-expanded={!lowered}
        >
          <span className="w-10 h-1.5 bg-sand-200 rounded-full" />
        </button>
      )}
      <div
        onTouchStart={isPhone ? onTouchStart : undefined}
        onTouchMove={isPhone ? onTouchMove : undefined}
        onTouchEnd={isPhone ? onTouchEnd : undefined}
        className={`px-3 shrink-0 ${isPhone ? "pb-2" : "pt-2.5 pb-2"} ${lowered ? "" : "border-b border-sand-200"}`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {isSubView && !lowered ? (
              <button onClick={back} className="cursor-pointer p-1 -ml-1 rounded-lg hover:bg-sand-100 text-sand-600" aria-label="Back">
                <ArrowLeft size={16} />
              </button>
            ) : (
              <span className="w-7 h-7 rounded-lg bg-gold-50 border border-gold-200 flex items-center justify-center shrink-0">
                <MessagesSquare size={15} className="text-gold-700" />
              </span>
            )}
            <div className="min-w-0">
              <h3 className="text-[15px] font-bold truncate leading-tight">{title}</h3>
              {lowered && <p className="text-[10px] text-sand-600 truncate">{isPhone ? "Swipe up to continue" : "Expand to continue"}</p>}
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            {isAdmin && !isSubView && !lowered && (
              <button
                onClick={openReports}
                className="cursor-pointer p-1.5 rounded-lg hover:bg-brick-50 text-brick-600"
                title="Reported posts (admin)"
                aria-label="Reported posts"
              >
                <ShieldAlert size={16} />
              </button>
            )}
            <button
              onClick={() => setLowered((v) => !v)}
              className="cursor-pointer p-1.5 rounded-lg hover:bg-sand-100 text-sand-600 hover:text-ink"
              title={lowered ? "Expand" : "Minimize"}
              aria-label={lowered ? "Expand Community" : "Minimize Community"}
              aria-expanded={!lowered}
            >
              {lowered ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            <button onClick={() => setPanelOpen(false)} className="cursor-pointer p-1.5 rounded-lg hover:bg-sand-100 text-sand-600 hover:text-ink" title="Close" aria-label="Close">
              <X size={16} />
            </button>
          </div>
        </div>
        {/* Tabs: the three lists */}
        {signedIn && !isSubView && !lowered && (
          <div className="mt-2.5 grid grid-cols-3 gap-1 p-1 rounded-xl bg-sand-100" role="tablist" aria-label="Community">
            {(
              [
                ["feed", "Feed", openFeed],
                ["clubs", "Clubs", openClubs],
                ["mine", "Mine", openMine],
              ] as const
            ).map(([id, label, open]) => (
              <button
                key={id}
                role="tab"
                aria-selected={view === id}
                onClick={open}
                className={`cursor-pointer relative h-8 rounded-lg text-xs font-bold transition-colors ${
                  view === id ? "bg-white shadow-sm text-ink" : "text-sand-600 hover:text-ink"
                }`}
              >
                {label}
                {id === "clubs" && newClubPosts > 0 && (
                  <span className="absolute top-1 right-2 min-w-4 h-4 px-1 rounded-full bg-brick-600 text-white text-[9px] font-bold flex items-center justify-center">
                    {newClubPosts > 99 ? "99+" : newClubPosts}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className={`flex-1 min-h-0 overflow-y-auto overscroll-contain custom-scrollbar p-3 ${lowered ? "hidden" : ""}`}>
        {view === "feed" && <FeedView signedIn={signedIn} />}
        {view === "mine" && user && <MineView />}
        {view === "post" && <PostView signedIn={signedIn} isAdmin={isAdmin} />}
        {view === "compose" && user && <ComposeView key={editing?.id ?? "new"} userId={user.id} />}
        {view === "compose" && !user && <p className="text-xs text-sand-600">Sign in to post in Community.</p>}
        {view === "reports" && isAdmin && <ReportsView />}
        {view === "clubs" && user && <ClubsView />}
        {view === "club" && user && <ClubView />}
        {view === "event" && user && <EventView />}
      </div>
    </div>
  );
};
