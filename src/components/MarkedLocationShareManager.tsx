import { useCallback, useEffect, useState } from "react";
import { Check, Clock, Loader2, Share2, UserMinus, UserPlus, X } from "lucide-react";
import { useMarkedLocationStore } from "../store/useMarkedLocationStore";
import type { MarkedLocationShare, ShareSuggestion } from "../types/markedLocation";

interface Props {
  locationIds: string[];
  onClose: () => void;
  onShared?: () => void;
}

const recipientLabel = (r: { name: string | null; emailMasked: string | null }) =>
  [r.name, r.emailMasked && `(${r.emailMasked})`].filter(Boolean).join(" ") || "Unknown account";

// Share one or more of my locations with another account: pick a recent recipient, or type
// part of a name or email and pick the person. Typing the exact email and pressing Share
// still works. With a single location it also lists who has access and lets the owner
// revoke it.
export const MarkedLocationShareManager = ({ locationIds, onClose, onShared }: Props) => {
  const { shareLocations, listShares, revokeShare, shareSuggestions } = useMarkedLocationStore();
  const singleId = locationIds.length === 1 ? locationIds[0] : null;

  const [shares, setShares] = useState<MarkedLocationShare[]>([]);
  const [isLoading, setIsLoading] = useState(!!singleId);
  const [recipient, setRecipient] = useState("");
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<ShareSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [suggestionsFor, setSuggestionsFor] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!singleId) return;
    setIsLoading(true);
    try {
      setShares(await listShares(singleId));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [listShares, singleId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Recent recipients while the box is empty, matching accounts as you type (debounced)
  useEffect(() => {
    const query = recipient.trim();
    if (query.length === 1) return;
    let cancelled = false;
    const timer = window.setTimeout(
      async () => {
        setIsSearching(true);
        try {
          const list = await shareSuggestions(query);
          if (!cancelled) {
            setSuggestions(list);
            setSuggestionsFor(query);
          }
        } catch {
          if (!cancelled) setSuggestions([]);
        } finally {
          if (!cancelled) setIsSearching(false);
        }
      },
      query ? 300 : 0,
    );
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [recipient, shareSuggestions]);

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    await shareWith(recipient.trim());
  };

  const shareWith = async (value: string) => {
    if (!value) return;
    setIsSharing(true);
    setError(null);
    setNotice(null);
    try {
      const result = await shareLocations(locationIds, value);
      const count = locationIds.length;
      setNotice(
        result.sharedCount === 0
          ? `${recipientLabel(result)} already has access`
          : `Shared ${count === 1 ? "location" : `${result.sharedCount} locations`} with ${recipientLabel(result)}`,
      );
      setRecipient("");
      await refresh();
      onShared?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSharing(false);
    }
  };

  const handleRevoke = async (share: MarkedLocationShare) => {
    if (!singleId) return;
    setRevokingId(share.userId);
    setError(null);
    setNotice(null);
    try {
      await revokeShare(singleId, share.userId);
      setShares((prev) => prev.filter((s) => s.userId !== share.userId));
      setNotice(`Access removed for ${recipientLabel(share)}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRevokingId(null);
      setConfirmRevokeId(null);
    }
  };

  return (
    <div className="mt-2 p-2.5 rounded-lg bg-white/90 border border-sand-200 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-sand-600">
          {singleId ? "Share location" : `Share ${locationIds.length} locations`}
        </span>
        <button
          onClick={onClose}
          className="cursor-pointer p-1 rounded hover:bg-sand-100 text-sand-600 hover:text-ink transition-colors"
          title="Close"
        >
          <X size={12} />
        </button>
      </div>

      <form onSubmit={handleShare} className="flex gap-1.5">
        <input
          type="text"
          required
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="Name or email"
          aria-label="Recipient name or email"
          autoComplete="off"
          maxLength={254}
          className="flex-1 min-w-0 bg-sand-50 border border-sand-200 rounded-lg px-2.5 py-1.5 text-xs text-ink placeholder:text-sand-500 outline-none focus:border-gold-300"
        />
        <button
          type="submit"
          disabled={isSharing}
          className="cursor-pointer shrink-0 flex items-center gap-1 px-2.5 rounded-lg bg-gold-500 hover:bg-gold-400 text-white text-xs font-bold transition-colors disabled:opacity-50"
        >
          {isSharing ? <Loader2 size={12} className="animate-spin" /> : <Share2 size={12} />}
          Share
        </button>
      </form>
      {(() => {
        const query = recipient.trim();
        const hasAccess = new Set(shares.map((s) => s.userId));
        const list = suggestions.filter((s) => !hasAccess.has(s.userId));
        const fresh = suggestionsFor === query;
        if (query.length === 1) return <p className="text-[9px] text-sand-500">Keep typing a name or email…</p>;
        if (!query && list.length === 0) {
          return <p className="text-[9px] text-sand-500">Type part of their name or email, then tap the person.</p>;
        }
        if (query && fresh && !isSearching && list.length === 0) {
          return <p className="text-[9px] text-sand-500">No account matches. Check the spelling or type their full email.</p>;
        }
        return (
          <div className="space-y-1" aria-label="People to share with">
            <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-sand-500">
              {query ? "Tap a person to share" : (
                <>
                  <Clock size={10} /> Recent
                </>
              )}
              {isSearching && <Loader2 size={10} className="animate-spin" />}
            </div>
            {list.map((s) => (
              <button
                key={s.userId}
                type="button"
                onClick={() => shareWith(s.userId)}
                disabled={isSharing}
                className="cursor-pointer w-full flex items-center gap-2 px-2 py-1.5 rounded-lg bg-sand-50 hover:bg-gold-50 border border-sand-100 hover:border-gold-200 text-left transition-colors disabled:opacity-50"
              >
                <UserPlus size={13} className="shrink-0 text-gold-600" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-bold text-ink truncate">{s.name || s.emailMasked || "Account"}</span>
                  {s.name && s.emailMasked && <span className="block text-[9px] text-sand-500 truncate">{s.emailMasked}</span>}
                </span>
                <span className="shrink-0 text-[10px] font-bold text-gold-700">Share</span>
              </button>
            ))}
          </div>
        );
      })()}

      {(error || notice) && (
        <div className={`text-[10px] ${error ? "text-brick-600" : "text-forest-700"}`}>{error || notice}</div>
      )}

      {singleId && (
        <div className="space-y-1">
          <div className="text-[10px] text-sand-500">
            {isLoading
              ? "Loading..."
              : shares.length === 0
                ? "Not shared with anyone yet"
                : `Shared with ${shares.length} account(s)`}
          </div>
          {shares.map((share) => (
            <div key={share.userId} className="flex items-center justify-between gap-2 py-1 px-2 rounded bg-sand-50">
              <div className="min-w-0">
                <div className="text-[11px] text-ink truncate">{recipientLabel(share)}</div>
                <div className="text-[9px] text-sand-500">since {new Date(share.sharedAt).toLocaleDateString()}</div>
              </div>
              {confirmRevokeId === share.userId ? (
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[10px] text-brick-600">Remove access?</span>
                  <button
                    onClick={() => handleRevoke(share)}
                    disabled={revokingId === share.userId}
                    className="cursor-pointer p-1 rounded bg-brick-50 hover:bg-brick-100 text-brick-600 transition-colors disabled:opacity-50"
                    title="Confirm"
                  >
                    {revokingId === share.userId ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  </button>
                  <button
                    onClick={() => setConfirmRevokeId(null)}
                    className="cursor-pointer p-1 rounded hover:bg-sand-100 text-sand-600 transition-colors"
                    title="Cancel"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmRevokeId(share.userId)}
                  className="cursor-pointer shrink-0 p-1 rounded hover:bg-brick-50 text-brick-600 transition-colors"
                  title="Remove access"
                >
                  <UserMinus size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
