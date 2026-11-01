import { useEffect, useState } from "react";
import { Loader2, MapPin, Users, X } from "lucide-react";
import { fetchInviteInfo, joinClub, parseJoinParam, photoUrl, type ClubInviteInfo } from "../lib/community";
import { useCommunityStore } from "../store/useCommunityStore";
import { useSurveyStore } from "../store/useSurveyStore";

const clearJoinParam = () => {
  const url = new URL(window.location.href);
  url.searchParams.delete("join");
  window.history.replaceState(null, "", url.pathname + url.search + url.hash);
};

// A club invite link (/?join=<token>, made in the club's Members tab): shows the club and joins
// it. Guests see the club first and sign in from the panel; the card waits for them.
export const SharedJoinLink = () => {
  const [token] = useState(() => parseJoinParam(window.location.search));
  const user = useSurveyStore((s) => s.user);
  const [info, setInfo] = useState<ClubInviteInfo | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "gone" | "error" | "closed">("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetchInviteInfo(token)
      .then((i) => {
        if (cancelled) return;
        setInfo(i);
        setStatus(i ? "ready" : "gone");
      })
      .catch(() => !cancelled && setStatus("error"));
    return () => {
      cancelled = true;
    };
    // Again after signing in: "already a member" depends on who you are
  }, [token, user]);

  if (!token || status === "loading" || status === "closed") return null;

  const close = () => {
    clearJoinParam();
    setStatus("closed");
  };
  const openClub = (clubId: string) => {
    close();
    const store = useCommunityStore.getState();
    store.refresh();
    store.openClub(clubId);
    store.setPanelOpen(true);
  };
  const join = async () => {
    setBusy(true);
    setError(null);
    try {
      openClub(await joinClub(token));
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    // Guests need the panel's Sign In button, so the card does not cover the page for them
    <div
      className={
        user
          ? "fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-ink/40 p-0 sm:p-4"
          : "fixed z-[70] top-3 left-1/2 -translate-x-1/2 w-[min(360px,calc(100vw-1.5rem))]"
      }
      role="dialog"
      aria-modal={!!user}
      aria-label="Club invite"
    >
      <div
        className={`w-full bg-white shadow-2xl p-4 space-y-3 text-ink ${
          user ? "sm:w-[360px] rounded-t-2xl sm:rounded-2xl pb-[max(1rem,env(safe-area-inset-bottom))]" : "rounded-2xl border border-sand-200"
        }`}
      >
        <div className="flex items-start gap-3">
          {info?.photoPath ? (
            <img src={photoUrl(info.photoPath)} alt="" className="w-14 h-14 rounded-xl object-cover bg-sand-100 shrink-0" />
          ) : (
            <span className="w-14 h-14 rounded-xl shrink-0 flex items-center justify-center bg-forest-50 border border-forest-200 text-forest-800">
              <Users size={20} />
            </span>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gold-700">Club invite</p>
            <h2 className="text-base font-bold break-words">{info?.name ?? "Club"}</h2>
            {info && (
              <p className="text-[11px] text-sand-600">
                {info.memberCount} member{info.memberCount === 1 ? "" : "s"} · Leader: {info.leaderName}
                {info.region && (
                  <>
                    {" · "}
                    <MapPin size={10} className="inline -mt-0.5" /> {info.region}
                  </>
                )}
              </p>
            )}
          </div>
          <button onClick={close} className="cursor-pointer p-1 rounded-lg hover:bg-sand-100 text-sand-500" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        {info?.description && <p className="text-xs text-sand-700 whitespace-pre-wrap break-words line-clamp-4">{info.description}</p>}

        {status === "gone" || status === "error" ? (
          <p className="text-xs text-brick-600">
            {status === "gone" ? "This invite link does not exist." : "Could not open the invite. Check your connection and try again."}
          </p>
        ) : !info?.valid ? (
          <p className="text-xs text-brick-600">This invite link has expired or was stopped. Ask the club for a new one.</p>
        ) : info.isMember ? (
          <button onClick={() => openClub(info.clubId)} className="cursor-pointer w-full py-2 rounded-lg bg-forest-800 hover:bg-forest-700 text-white text-sm font-bold">
            You are a member · Open the club
          </button>
        ) : user ? (
          <button
            onClick={join}
            disabled={busy}
            className="cursor-pointer w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-forest-800 hover:bg-forest-700 text-white text-sm font-bold disabled:opacity-60"
          >
            {busy && <Loader2 size={14} className="animate-spin" />} Join the club
          </button>
        ) : (
          <p className="text-xs text-sand-700 rounded-lg bg-sand-50 border border-sand-200 p-2.5">
            Sign in first: open <strong>Sign In / Register</strong> in the Tools panel. This card stays open, and you can join right after.
          </p>
        )}
        {error && <p className="text-xs text-brick-600">{error}</p>}
        <p className="text-[10px] text-sand-500">Members see the club&apos;s posts and workspace. You can leave at any time.</p>
      </div>
    </div>
  );
};
