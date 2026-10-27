import { useEffect, useRef, useState } from "react";
import { Check, Copy, MessageCircle, Share2 } from "lucide-react";
import { SITE_URL, whatsappShareUrl } from "../lib/shareLocation";

export const APP_SHARE_TEXT =
  "Landscape 360 · Explore without Limits\n" +
  "Peta 3D & kontur, offline maps, GPS tracking dan S.O.S untuk penggiat alam terbuka.\n" +
  `${SITE_URL}/`;

// Small share icon for the app itself: copy the link, send it on WhatsApp, or (phones) the
// phone's own share sheet. `placement` says where the menu opens next to the button.
export const AppShareButton = ({
  placement = "below",
  className = "",
  iconSize = 18,
  label,
}: {
  placement?: "below" | "right";
  className?: string;
  iconSize?: number;
  /** Text under the icon (the desktop rail shows one) */
  label?: string;
}) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${SITE_URL}/`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (http or permissions)
    }
  };

  const shareOther = async () => {
    try {
      await navigator.share({ title: "Landscape 360", text: APP_SHARE_TEXT });
      setOpen(false);
    } catch {
      // Cancelled: keep the menu open
    }
  };

  const item =
    "cursor-pointer w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap";
  const position =
    placement === "right" ? "left-full top-0 ml-2" : "right-0 top-full mt-1.5";

  return (
    <div className="relative" ref={boxRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Share Landscape 360"
        title="Share Landscape 360"
        className={className}
      >
        <Share2 size={iconSize} />
        {label && <span className="text-[9px] font-semibold leading-none">{label}</span>}
      </button>
      {open && (
        <div className={`absolute z-[70] ${position} w-52 rounded-xl border border-sand-200 bg-white shadow-2xl p-1.5 text-ink`}>
          <div className="px-2 pt-1 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-sand-500">
            Share Landscape 360
          </div>
          <a
            href={whatsappShareUrl(APP_SHARE_TEXT)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className={`${item} bg-[#25D366] hover:bg-[#1ebe5a] text-white`}
          >
            <MessageCircle size={14} /> Send to WhatsApp
          </a>
          <button onClick={copy} className={`${item} mt-1 hover:bg-sand-100`}>
            {copied ? <Check size={14} className="text-forest-700" /> : <Copy size={14} />}
            {copied ? "Link copied" : "Copy link"}
          </button>
          {typeof navigator.share === "function" && (
            <button onClick={shareOther} className={`${item} hover:bg-sand-100`}>
              <Share2 size={14} /> Other apps
            </button>
          )}
        </div>
      )}
    </div>
  );
};
