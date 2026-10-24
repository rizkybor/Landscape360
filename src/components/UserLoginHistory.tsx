import { useEffect, useState } from "react";
import { History, Loader2, X } from "lucide-react";
import { fetchLoginHistory, type LoginEvent } from "../lib/adminUsers";
import { describeUserAgent } from "../lib/loginHistory";

interface Props {
  userId: string;
  lastSignInAt: string | null;
  onClose: () => void;
}

const timeAgo = (iso: string) => {
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days < 30 ? `${days} d ago` : `${Math.round(days / 30)} mo ago`;
};

// Latest sign-ins of one account (admin only)
export const UserLoginHistory = ({ userId, lastSignInAt, onClose }: Props) => {
  const [logins, setLogins] = useState<LoginEvent[] | null>(null);
  const [available, setAvailable] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchLoginHistory(userId)
      .then((result) => {
        if (!active) return;
        setLogins(result.logins);
        setAvailable(result.available);
      })
      .catch((err) => active && setError((err as Error).message));
    return () => {
      active = false;
    };
  }, [userId]);

  return (
    <div className="mt-2 p-3 rounded-xl bg-white border border-sand-200 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-sand-600 flex items-center gap-1.5">
          <History size={12} /> Login history
        </span>
        <button
          onClick={onClose}
          className="cursor-pointer p-1 rounded hover:bg-sand-100 text-sand-600 hover:text-ink transition-colors"
          title="Close"
        >
          <X size={12} />
        </button>
      </div>

      <div className="text-[11px] text-sand-700">
        Last sign-in:{" "}
        <strong>{lastSignInAt ? `${new Date(lastSignInAt).toLocaleString()} (${timeAgo(lastSignInAt)})` : "never"}</strong>
      </div>

      {error ? (
        <div className="text-[11px] text-brick-600">{error}</div>
      ) : logins === null ? (
        <div className="flex items-center gap-2 text-[11px] text-sand-500">
          <Loader2 size={12} className="animate-spin" /> Loading...
        </div>
      ) : !available ? (
        <div className="text-[10px] text-sand-500">
          Login history is not enabled yet (run the 20261024000005 migration).
        </div>
      ) : logins.length === 0 ? (
        <div className="text-[10px] text-sand-500">No sign-ins recorded since login history was enabled.</div>
      ) : (
        <div className="max-h-40 overflow-y-auto custom-scrollbar divide-y divide-sand-100">
          {logins.map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-2 py-1 text-[10px]">
              <span className="text-ink font-mono">{new Date(l.signedInAt).toLocaleString()}</span>
              <span className="text-sand-600 truncate" title={l.userAgent ?? undefined}>
                {describeUserAgent(l.userAgent)} · {timeAgo(l.signedInAt)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
