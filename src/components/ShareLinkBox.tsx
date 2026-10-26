import { useEffect, useState } from "react";
import { Check, Copy, Link2, Link2Off, Loader2, MessageCircle } from "lucide-react";
import { whatsappShareUrl } from "../lib/shareLocation";

interface Props {
  /** What the link opens, for the hint text ("this location", "this area") */
  what: string;
  getToken: () => Promise<string | null>;
  createToken: () => Promise<string>;
  revoke: () => Promise<void>;
  urlFor: (token: string) => string;
  /** WhatsApp message for the link */
  messageFor: (url: string) => string;
}

// "Share as a link": create a link anyone can open without signing in (sent on WhatsApp),
// copy it, or turn it off. Used by marked locations and marked areas.
export const ShareLinkBox = ({ what, getToken, createToken, revoke, urlFor, messageFor }: Props) => {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getToken()
      .then((t) => !cancelled && setToken(t))
      .catch((err) => !cancelled && setError((err as Error).message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // Load once for the item this box was opened for
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const url = token ? urlFor(token) : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked
    }
  };

  const btn =
    "cursor-pointer flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors disabled:opacity-50";

  return (
    <div className="space-y-1.5 pt-2 border-t border-sand-100">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-sand-600">
        <Link2 size={11} /> Share as a link
      </div>
      <p className="text-[9px] text-sand-500">
        Anyone who opens the link can see {what}, no sign-in needed. Send it on WhatsApp.
      </p>

      {loading ? (
        <div className="text-[10px] text-sand-500">Loading...</div>
      ) : !token ? (
        <button
          onClick={() => run(async () => setToken(await createToken()))}
          disabled={busy}
          className={`${btn} w-full bg-sand-50 hover:bg-sand-100 border border-sand-200 text-ink`}
        >
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Link2 size={12} />} Create link
        </button>
      ) : (
        <>
          <div className="flex items-center gap-1.5">
            <input
              readOnly
              value={url}
              onFocus={(e) => e.currentTarget.select()}
              aria-label="Share link"
              className="min-w-0 flex-1 bg-sand-50 border border-sand-200 rounded-lg px-2 py-1.5 text-[10px] font-mono text-sand-700 outline-none"
            />
            <button
              onClick={copy}
              className={`${btn} shrink-0 bg-sand-50 hover:bg-sand-100 border border-sand-200 text-ink`}
              title="Copy link"
              aria-label="Copy link"
            >
              {copied ? <Check size={12} className="text-forest-700" /> : <Copy size={12} />}
            </button>
          </div>
          <div className="flex gap-1.5">
            <a
              href={whatsappShareUrl(messageFor(url))}
              target="_blank"
              rel="noopener noreferrer"
              className={`${btn} flex-1 bg-[#25D366] hover:bg-[#1ebe5a] text-white`}
            >
              <MessageCircle size={12} /> Send to WhatsApp
            </a>
            {confirmOff ? (
              <button
                onClick={() =>
                  run(async () => {
                    await revoke();
                    setToken(null);
                    setConfirmOff(false);
                  })
                }
                disabled={busy}
                className={`${btn} bg-brick-600 hover:bg-brick-700 text-white`}
              >
                {busy ? <Loader2 size={12} className="animate-spin" /> : "Turn off?"}
              </button>
            ) : (
              <button
                onClick={() => setConfirmOff(true)}
                className={`${btn} bg-white border border-brick-200 hover:bg-brick-50 text-brick-600`}
                title="Turn the link off: it stops working for everyone who has it"
              >
                <Link2Off size={12} /> Turn off
              </button>
            )}
          </div>
        </>
      )}
      {error && <div className="text-[10px] text-brick-600">{error}</div>}
    </div>
  );
};
