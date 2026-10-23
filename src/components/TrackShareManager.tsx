import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Share2, UserMinus, X } from "lucide-react";
import { useTrackRecorderStore } from "../store/useTrackRecorderStore";
import type { TrackShare } from "../types/trackRecorder";

interface Props {
  trackId: string;
  onClose: () => void;
}

// Share one of my tracks with other accounts by email, and revoke access.
export const TrackShareManager = ({ trackId, onClose }: Props) => {
  const { shareTrack, listShares, revokeShare } = useTrackRecorderStore();

  const [shares, setShares] = useState<TrackShare[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      setShares(await listShares(trackId));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [listShares, trackId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim();
    if (!value) return;
    setIsSharing(true);
    setError(null);
    setNotice(null);
    try {
      const share = await shareTrack(trackId, value);
      setShares((prev) => [...prev.filter((s) => s.userId !== share.userId), share]);
      setNotice(`Shared with ${share.email}`);
      setEmail("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSharing(false);
    }
  };

  const handleRevoke = async (share: TrackShare) => {
    setRevokingId(share.userId);
    setError(null);
    setNotice(null);
    try {
      await revokeShare(trackId, share.userId);
      setShares((prev) => prev.filter((s) => s.userId !== share.userId));
      setNotice(`Access removed for ${share.email}`);
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
        <span className="text-[10px] font-bold uppercase tracking-wider text-sand-600">Share track</span>
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
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Recipient account email"
          className="flex-1 min-w-0 bg-sand-50 border border-sand-200 rounded-lg px-2.5 py-1.5 text-xs text-ink placeholder:text-sand-500 outline-none focus:border-ember-300"
        />
        <button
          type="submit"
          disabled={isSharing}
          className="cursor-pointer shrink-0 flex items-center gap-1 px-2.5 rounded-lg bg-ember-600 hover:bg-ember-500 text-white text-xs font-bold transition-colors disabled:opacity-50"
        >
          {isSharing ? <Loader2 size={12} className="animate-spin" /> : <Share2 size={12} />}
          Share
        </button>
      </form>

      {(error || notice) && (
        <div className={`text-[10px] ${error ? "text-brick-600" : "text-forest-700"}`}>{error || notice}</div>
      )}

      <div className="space-y-1">
        <div className="text-[10px] text-sand-500">
          {isLoading ? "Loading..." : shares.length === 0 ? "Not shared with anyone yet" : `Shared with ${shares.length} account(s)`}
        </div>
        {shares.map((share) => (
          <div key={share.userId} className="flex items-center justify-between gap-2 py-1 px-2 rounded bg-sand-50">
            <div className="min-w-0">
              <div className="text-[11px] text-ink truncate">{share.email}</div>
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
    </div>
  );
};
