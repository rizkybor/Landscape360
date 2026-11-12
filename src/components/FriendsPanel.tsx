import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Ban, Check, Loader2, LocateFixed, MessageCircle, MessagesSquare, QrCode, RefreshCw, Route, Share2, Smartphone, Trash2, UserPlus, Users, X } from "lucide-react";
import QRCode from "qrcode";
import {
  answerFriendRequest,
  fetchFriendLinkInfo,
  fetchFriendRequests,
  fetchFriends,
  fetchMyFriendLink,
  FRIENDS_REFRESH_MS,
  friendLinkUrl,
  parseFriendParam,
  removeFriend,
  renewMyFriendLink,
  requestFriendByEmail,
  requestFriendByLink,
  type Friend,
  type FriendRequest,
} from "../lib/friends";
import { useSurveyStore } from "../store/useSurveyStore";
import { useFriendsStore } from "../store/useFriendsStore";
import { useBackLayer } from "../hooks/useBackLayer";

// Friends on the web: the Friends button in User Account with the unread badge; the panel with a
// bottom bar (Chats, Friends with requests, My QR, Add friend); and the card a friend link
// (/?friend=<token>) opens. Chats are listed with their unread counts, but reading and writing
// messages (and groups, replies, locations, map data) is in the app only: opening a chat here
// says so.

const pill = "cursor-pointer px-3 py-1.5 rounded-lg text-xs font-bold";
// 16px text on phones: iOS zooms into smaller fields
const field = "w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-base sm:text-sm focus:outline-none focus:border-forest-500";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const sameDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString();
const clock = (t: number) => new Date(t).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

const chatTime = (t: number) => {
  const d = new Date(t);
  const now = new Date();
  if (sameDay(t, now.getTime())) return clock(t);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${d.getFullYear() === now.getFullYear() ? "" : ` ${d.getFullYear()}`}`;
};

// A friend's first letter on a soft colour picked from their name (the same colour as in the app)
const PALETTE: [string, string][] = [
  ["var(--color-forest-100)", "var(--color-forest-800)"],
  ["var(--color-gold-100)", "var(--color-gold-700)"],
  ["#fbe3d3", "var(--color-ember-600)"],
  ["#dde7f5", "#2a5c9a"],
  ["var(--color-sand-200)", "var(--color-sand-700)"],
];

const Avatar = ({ name, size = 36 }: { name: string; size?: number }) => {
  const n = name.trim();
  const [bg, fg] = PALETTE[[...n].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE.length];
  return (
    <span
      className="shrink-0 rounded-full font-bold flex items-center justify-center"
      style={{ width: size, height: size, fontSize: size * 0.4, background: bg, color: fg }}
    >
      {n.charAt(0).toUpperCase() || "?"}
    </span>
  );
};

// --- The button in User Account ------------------------------------------------------------------

export const FriendsButton = ({ onOpen }: { onOpen?: () => void }) => {
  const user = useSurveyStore((s) => s.user);
  const { messages, requests } = useFriendsStore((s) => s.unread);
  const unread = messages + requests;

  // Each time User Account opens: the latest count
  useEffect(() => {
    if (user) useFriendsStore.getState().refreshUnread();
  }, [user]);

  if (!user) return null;
  const detail = [
    messages > 0 && `${messages} new ${messages === 1 ? "message" : "messages"}`,
    requests > 0 && `${requests} friend ${requests === 1 ? "request" : "requests"}`,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <button
      onClick={() => {
        // The panel lives on the map page, so closing User Account does not close it
        useFriendsStore.getState().open();
        onOpen?.();
      }}
      className="cursor-pointer w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-sand-200 bg-white hover:bg-sand-50 text-left"
    >
      <Users size={16} className="shrink-0 text-forest-700" />
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-bold text-ink">Friends</span>
        <span className="block text-[11px] text-sand-600 truncate">{detail || "Friends and requests · chat in the app"}</span>
      </span>
      {unread > 0 && <span className="min-w-5 px-1.5 rounded-full bg-ember-500 text-white text-[11px] font-bold text-center">{unread > 99 ? "99+" : unread}</span>}
    </button>
  );
};

/** The Friends panel when open, and the badge kept current for the signed-in account */
export const FriendsHost = () => {
  const user = useSurveyStore((s) => s.user);
  const isOpen = useFriendsStore((s) => s.isOpen);

  useEffect(() => {
    const store = useFriendsStore.getState();
    if (!user) {
      store.reset();
      return;
    }
    store.refreshUnread();
    // Back to the tab: new messages and requests
    const refresh = () => useFriendsStore.getState().refreshUnread();
    window.addEventListener("focus", refresh);
    const timer = setInterval(refresh, FRIENDS_REFRESH_MS * 2);
    return () => {
      window.removeEventListener("focus", refresh);
      clearInterval(timer);
    };
  }, [user]);

  if (!user || !isOpen) return null;
  return (
    <FriendsPanel
      onClose={() => {
        useFriendsStore.getState().close();
        useFriendsStore.getState().refreshUnread();
      }}
    />
  );
};

// --- The panel ----------------------------------------------------------------------------------

type View = "chats" | "friends" | "qr" | "add";

/** The bottom bar: four equal items, icon over label; the open one sits on a soft green pill */
const NavItem = ({ active, label, dot, onClick, children }: { active: boolean; label: string; dot?: boolean; onClick: () => void; children: ReactNode }) => (
  <button onClick={onClick} aria-pressed={active} className="cursor-pointer flex-1 flex flex-col items-center justify-center gap-[3px] group">
    <span
      className={`relative w-[52px] h-[30px] rounded-full flex items-center justify-center transition-colors duration-200 ${
        active ? "bg-forest-100 text-forest-800" : "text-sand-500 group-hover:bg-sand-50"
      }`}
    >
      {children}
      {dot && <span className={`absolute top-0.5 right-3 w-[9px] h-[9px] rounded-full bg-ember-500 border-[1.5px] ${active ? "border-forest-100" : "border-white"}`} />}
    </span>
    <span className={`text-[11px] ${active ? "font-bold text-forest-800" : "font-medium text-sand-500"}`}>{label}</span>
  </button>
);

export const FriendsPanel = ({ onClose }: { onClose: () => void }) => {
  const [view, setView] = useState<View>("chats");
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [chat, setChat] = useState<Friend | null>(null);

  const load = useCallback(async () => {
    try {
      const [f, r] = await Promise.all([fetchFriends(), fetchFriendRequests()]);
      setFriends(f);
      setRequests(r);
      setLoaded(true);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, FRIENDS_REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const incoming = requests.filter((r) => r.direction === "in");
  const outgoing = requests.filter((r) => r.direction === "out");
  const chats = friends.filter((f) => f.lastAt);
  const unreadChats = chats.filter((f) => f.unread > 0).length;
  const title = { chats: "Chats", friends: "Friends", qr: "My QR code", add: "Add friend" }[view];
  const subtitle =
    view === "chats"
      ? unreadChats
        ? `${unreadChats} unread ${unreadChats === 1 ? "chat" : "chats"}`
        : "All caught up"
      : view === "friends"
        ? `${friends.length} ${friends.length === 1 ? "friend" : "friends"}${incoming.length ? ` · ${incoming.length} new ${incoming.length === 1 ? "request" : "requests"}` : ""}`
        : view === "qr"
          ? "Let a friend scan it to add you"
          : "Send a request by email";
  const section = "px-1 pt-3 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-sand-600";

  // Back (browser or phone) closes the chat, then Friends; Escape does the same on a computer
  const closeChat = () => {
    setChat(null);
    load();
  };
  useBackLayer(true, onClose);
  useBackLayer(!!chat, closeChat);
  const escape = useRef(() => undefined as void);
  useEffect(() => {
    escape.current = chat ? closeChat : onClose;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && escape.current();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    // Phones: a full-screen page pushed in from the right, as in the app; computers: a dialog
    <div className="fixed inset-0 z-[70] flex sm:items-center justify-center sm:bg-ink/40 sm:p-4" role="dialog" aria-modal aria-label="Friends">
      <div className="relative w-full h-dvh sm:w-[420px] sm:h-[640px] sm:max-h-full bg-white sm:rounded-2xl sm:shadow-2xl flex flex-col text-ink overflow-hidden max-sm:motion-safe:animate-page-in">
        {chat ? (
          // A key per friend: each chat slides in as its own page
          <div key={chat.userId} className="absolute inset-0 z-10 flex flex-col bg-white max-sm:motion-safe:animate-page-in">
            <AppOnlyChat friend={chat} onBack={closeChat} />
          </div>
        ) : null}
        {/* The list stays under an open chat, as in a stack of pages */}
          <>
            <div className="flex items-center gap-3 px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] sm:pt-3 pb-3 border-b border-sand-200">
              <button onClick={onClose} className="sm:hidden cursor-pointer -ml-1.5 p-1.5 rounded-lg hover:bg-sand-100" aria-label="Back to the map">
                <ArrowLeft size={20} />
              </button>
              <span className="p-1 rounded-xl bg-sand-50">
                <img src="/android-chrome-192x192.png" alt="" className="w-9 h-9 rounded-lg" />
              </span>
              <span className="flex-1 min-w-0">
                <h2 className="text-xl font-extrabold leading-tight">{title}</h2>
                <span className="block text-[11.5px] text-sand-600 truncate">{subtitle}</span>
              </span>
              <button onClick={onClose} className="hidden sm:block cursor-pointer p-1.5 rounded-lg hover:bg-sand-100 text-sand-500" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            {error && <p className="px-4 pt-2 text-xs text-brick-600">{error}</p>}
            <div className="flex-1 overflow-y-auto bg-sand-50">
              {view === "chats" && (
                <div className="px-4 pb-4">
                  {chats.length === 0 ? (
                    <div className="py-12 text-center space-y-2">
                      <MessagesSquare size={32} className="mx-auto text-sand-400" />
                      <p className="text-sm font-bold">{loaded ? "No chats yet" : "Loading…"}</p>
                      {loaded && (
                        <p className="text-xs text-sand-500">
                          {friends.length ? "Chats start in the Landscape 360 app." : "Add a friend by email or with your QR code, then chat in the Landscape 360 app."}
                        </p>
                      )}
                    </div>
                  ) : (
                    <>
                      <p className={section}>Recent</p>
                      {chats.map((f, i) => (
                        <button
                          key={f.userId}
                          onClick={() => setChat(f)}
                          className={`cursor-pointer w-full flex items-center gap-3 px-1 py-2.5 text-left hover:bg-sand-100/60 ${i ? "border-t border-sand-200" : ""}`}
                        >
                          <Avatar name={f.name} size={38} />
                          <span className="flex-1 min-w-0">
                            <span className="flex items-center gap-2">
                              <span className={`flex-1 truncate text-sm ${f.unread ? "font-extrabold" : "font-semibold"}`}>{f.name}</span>
                              <span className={`text-[11px] shrink-0 ${f.unread ? "font-bold text-ember-600" : "text-sand-500"}`}>{f.lastAt ? chatTime(f.lastAt) : ""}</span>
                            </span>
                            <span className="flex items-center gap-1 mt-0.5 text-[12.5px]">
                              {f.lastFromMe && !f.lastDeleted && <span className="text-sand-500">You:</span>}
                              {f.lastDeleted ? (
                                <Ban size={13} className="text-sand-500 shrink-0" />
                              ) : f.lastKind === "location" ? (
                                <LocateFixed size={13} className={`shrink-0 ${f.unread ? "text-forest-700" : "text-sand-500"}`} />
                              ) : f.lastKind === "attachment" ? (
                                <Route size={13} className={`shrink-0 ${f.unread ? "text-forest-700" : "text-sand-500"}`} />
                              ) : null}
                              <span className={`flex-1 truncate ${f.lastDeleted ? "italic" : ""} ${f.unread ? "font-semibold text-ink" : "text-sand-600"}`}>
                                {f.lastDeleted ? "Message deleted" : f.lastKind === "text" ? (f.lastBody ?? "").replace(/\n/g, " ") : f.lastKind === "location" ? "Location" : "Map data"}
                              </span>
                              {f.unread > 0 && (
                                <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-ember-500 text-white text-[10.5px] font-extrabold flex items-center justify-center">
                                  {f.unread > 99 ? "99+" : f.unread}
                                </span>
                              )}
                            </span>
                          </span>
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}
              {view === "friends" && (
                <div className="px-4 pb-4">
                  {incoming.length > 0 && <p className={section}>Requests</p>}
                  {incoming.map((r) => (
                    <div key={r.id} className="flex items-center gap-3 px-1 py-2">
                      <Avatar name={r.name} />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-bold truncate">{r.name}</span>
                        {r.organization && <span className="block text-xs text-sand-500 truncate">{r.organization}</span>}
                      </span>
                      <button disabled={busy} onClick={() => act(() => answerFriendRequest(r.id, false))} className="cursor-pointer p-1.5 rounded-lg hover:bg-sand-100 text-sand-500" aria-label="Decline">
                        <X size={15} />
                      </button>
                      <button disabled={busy} onClick={() => act(() => answerFriendRequest(r.id, true))} className="cursor-pointer p-1.5 rounded-lg bg-forest-800 text-white" aria-label="Accept">
                        <Check size={15} />
                      </button>
                    </div>
                  ))}
                  <p className={section}>Friends · {friends.length}</p>
                  {friends.length === 0 && loaded && <p className="px-1 py-2 text-xs text-sand-500">No friends yet. Use Add friend to send a request by email, or share your QR code.</p>}
                  {friends.map((f, i) => (
                    <div key={f.userId} className={`flex items-center gap-3 px-1 py-2 ${i ? "border-t border-sand-200" : ""}`}>
                      <button onClick={() => setChat(f)} className="cursor-pointer flex-1 min-w-0 flex items-center gap-3 text-left">
                        <Avatar name={f.name} />
                        <span className="min-w-0">
                          <span className="block text-sm font-bold truncate">{f.name}</span>
                          {f.organization && <span className="block text-xs text-sand-500 truncate">{f.organization}</span>}
                        </span>
                      </button>
                      <button onClick={() => setChat(f)} className="cursor-pointer p-1.5 rounded-lg hover:bg-sand-100 text-forest-700" aria-label={`Message ${f.name}`}>
                        <MessageCircle size={15} />
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => {
                          if (window.confirm(`Remove ${f.name}? You will no longer be able to message each other. Your chat stays readable.`)) act(() => removeFriend(f.userId));
                        }}
                        className="cursor-pointer p-1.5 rounded-lg hover:bg-brick-50 text-brick-600"
                        aria-label={`Remove ${f.name}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  {outgoing.length > 0 && <p className={section}>Waiting for an answer</p>}
                  {outgoing.map((r) => (
                    <div key={r.id} className="flex items-center gap-3 px-1 py-2 opacity-70">
                      <Avatar name={r.name} />
                      <span className="text-sm">{r.name}</span>
                    </div>
                  ))}
                </div>
              )}
              {view === "qr" && <MyCode />}
              {view === "add" && <AddFriend onSent={load} />}
            </div>
            <div className="bg-sand-50 px-4 pt-1.5 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
              <nav className="h-[66px] px-1.5 flex rounded-[22px] bg-white border border-sand-200 shadow-[0_4px_16px_rgba(30,60,19,.08)]" aria-label="Friends">
                <NavItem active={view === "chats"} label="Chats" dot={unreadChats > 0} onClick={() => setView("chats")}>
                  <MessageCircle size={21} />
                </NavItem>
                <NavItem active={view === "friends"} label="Friends" dot={incoming.length > 0} onClick={() => setView("friends")}>
                  <Users size={21} />
                </NavItem>
                <NavItem active={view === "qr"} label="My QR" onClick={() => setView("qr")}>
                  <QrCode size={21} />
                </NavItem>
                <NavItem active={view === "add"} label="Add friend" onClick={() => setView("add")}>
                  <UserPlus size={21} />
                </NavItem>
              </nav>
            </div>
          </>
      </div>
    </div>
  );
};

// --- Add friend (by email) and my code (QR / link) ----------------------------------------------------

const AddFriend = ({ onSent }: { onSent: () => void }) => {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    if (!email.includes("@")) return setError("Enter the email of their Landscape 360 account.");
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      await requestFriendByEmail(email);
      // The same answer whether or not the account exists (their email stays private)
      setNote(`Request sent if a Landscape 360 account uses ${email.trim()}.`);
      setEmail("");
      onSent();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
      className="p-4 space-y-2"
    >
      <p className="text-xs text-sand-600">Send a friend request to the email of their Landscape 360 account. Or show them your QR code in My QR.</p>
      <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Their email" aria-label="Their email" className={field} />
      <button type="submit" disabled={busy} className="cursor-pointer w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-forest-800 text-white text-sm font-bold disabled:opacity-60">
        {busy && <Loader2 size={14} className="animate-spin" />} Send request
      </button>
      {note && <p className="text-xs text-forest-700">{note}</p>}
      {error && <p className="text-xs text-brick-600">{error}</p>}
    </form>
  );
};

const MyCode = () => {
  const [token, setToken] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMyFriendLink().then(setToken, (e: Error) => setError(e.message));
  }, []);
  useEffect(() => {
    if (!token) return;
    QRCode.toDataURL(friendLinkUrl(token), { margin: 1, width: 220, color: { dark: "#1e3c13", light: "#ffffff" } }).then(setQr, () => setQr(null));
  }, [token]);

  const url = token ? friendLinkUrl(token) : null;
  return (
    <div className="p-4">
      <div className="rounded-xl border border-sand-200 bg-white p-4 text-center space-y-2">
        <p className="text-[11px] text-sand-500">Friends scan it with the Landscape 360 app or their camera, or open your link.</p>
        {qr ? <img src={qr} alt="My friend QR code" className="mx-auto w-[200px] h-[200px]" /> : <Loader2 size={20} className="mx-auto animate-spin text-sand-400" />}
        <div className="flex gap-1.5 justify-center">
          <button
            disabled={!url}
            onClick={() => url && (navigator.share ? navigator.share({ text: `Add me as a friend on Landscape 360: ${url}` }).catch(() => undefined) : navigator.clipboard.writeText(url))}
            className={`${pill} bg-forest-800 text-white flex items-center gap-1`}
          >
            <Share2 size={12} /> {"share" in navigator ? "Share link" : "Copy link"}
          </button>
          <button
            disabled={!url}
            onClick={() => {
              if (window.confirm("Make a new code? Your current QR code and link stop working.")) renewMyFriendLink().then(setToken, (e: Error) => setError(e.message));
            }}
            className={`${pill} bg-sand-100 text-sand-700 flex items-center gap-1`}
          >
            <RefreshCw size={12} /> New code
          </button>
        </div>
        {error && <p className="text-xs text-brick-600">{error}</p>}
      </div>
    </div>
  );
};

// --- One chat: in the app only ---------------------------------------------------------------------

/** Opening a chat on the web: who it is with and where the messages are (the app) */
const AppOnlyChat = ({ friend, onBack }: { friend: Friend; onBack: () => void }) => (
  <>
    <div className="flex items-center gap-2.5 px-3 pt-[calc(0.625rem+env(safe-area-inset-top))] sm:pt-2.5 pb-2.5 border-b border-sand-200">
      <button onClick={onBack} className="cursor-pointer p-1.5 rounded-lg hover:bg-sand-100" aria-label="Back">
        <ArrowLeft size={18} />
      </button>
      <Avatar name={friend.name} size={36} />
      <span className="flex-1 min-w-0">
        <span className="block text-[15px] font-bold truncate">{friend.name}</span>
        <span className="block text-xs text-sand-600 truncate">{friend.organization ?? "Landscape 360 friend"}</span>
      </span>
    </div>
    <div className="flex-1 overflow-y-auto bg-sand-50 px-5 py-8" role="status">
      <div className="mx-auto max-w-[330px] rounded-2xl border border-sand-200 bg-white p-5 text-center space-y-3 shadow-[0_4px_16px_rgba(30,60,19,.06)]">
        <span className="mx-auto w-12 h-12 rounded-full bg-forest-100 text-forest-800 flex items-center justify-center">
          <Smartphone size={22} />
        </span>
        <h3 className="text-base font-extrabold">Chat is in the Landscape 360 app</h3>
        <p className="text-xs text-sand-600 leading-relaxed">
          Messages, your location, map data, groups and replies are sent and read in the app, not here.
          {friend.unread > 0 && ` ${friend.unread} unread ${friend.unread === 1 ? "message" : "messages"} from ${friend.name} ${friend.unread === 1 ? "is" : "are"} waiting there.`}
        </p>
        <p className="text-[11px] text-sand-500 leading-relaxed">The app is in testing as an Android .apk; it is not in the App Store or Play Store yet.</p>
      </div>
    </div>
  </>
);

// --- A friend link (/?friend=<token>) --------------------------------------------------------------

const clearFriendParam = () => {
  const url = new URL(window.location.href);
  url.searchParams.delete("friend");
  window.history.replaceState(null, "", url.pathname + url.search + url.hash);
};

export const SharedFriendLink = () => {
  const [token] = useState(() => parseFriendParam(window.location.search));
  const user = useSurveyStore((s) => s.user);
  const [info, setInfo] = useState<{ name: string; organization: string | null; isMe: boolean } | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "gone" | "closed">("loading");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetchFriendLinkInfo(token).then(
      (i) => {
        if (cancelled) return;
        setInfo(i);
        setStatus(i ? "ready" : "gone");
      },
      () => !cancelled && setStatus("gone"),
    );
    return () => {
      cancelled = true;
    };
    // Again after signing in: "your own code" depends on who you are
  }, [token, user]);

  if (!token || status === "loading" || status === "closed") return null;
  const close = () => {
    clearFriendParam();
    setStatus("closed");
  };
  const add = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await requestFriendByLink(token);
      setResult(r === "friends" ? "You are now friends." : "Request sent. They will see it in Friends.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed z-[70] top-3 left-1/2 -translate-x-1/2 w-[min(340px,calc(100vw-1.5rem))]" role="dialog" aria-label="Friend">
      <div className="rounded-2xl border border-sand-200 bg-white shadow-2xl p-4 space-y-3 text-ink">
        <div className="flex items-center gap-3">
          <Avatar name={info?.name ?? "?"} size={44} />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gold-700">Friend request</p>
            <h2 className="text-base font-bold truncate">{info?.name ?? "Landscape 360"}</h2>
            {info?.organization && <p className="text-[11px] text-sand-600 truncate">{info.organization}</p>}
          </div>
          <button onClick={close} className="cursor-pointer p-1 rounded-lg hover:bg-sand-100 text-sand-500" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        {status === "gone" ? (
          <p className="text-xs text-brick-600">This friend link is no longer valid.</p>
        ) : result ? (
          <div className="space-y-2">
            <p className="text-xs font-bold text-forest-700">{result}</p>
            <button
              onClick={() => {
                close();
                useFriendsStore.getState().open();
              }}
              className="cursor-pointer w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-sand-200 bg-white hover:bg-sand-50 text-sm font-bold"
            >
              <Users size={14} /> Open Friends
            </button>
          </div>
        ) : info?.isMe ? (
          <p className="text-xs text-sand-600">This is your own code.</p>
        ) : user ? (
          <button onClick={add} disabled={busy} className="cursor-pointer w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-forest-800 text-white text-sm font-bold disabled:opacity-60">
            {busy && <Loader2 size={14} className="animate-spin" />} Add friend
          </button>
        ) : (
          <p className="text-xs text-sand-700 rounded-lg bg-sand-50 border border-sand-200 p-2.5">
            Sign in first: open <strong>Sign In / Register</strong> in the Tools panel. This card stays open.
          </p>
        )}
        {error && <p className="text-xs text-brick-600">{error}</p>}
      </div>
    </div>
  );
};
