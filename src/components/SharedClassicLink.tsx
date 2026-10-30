import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { openFieldWorkLink } from "../services/classicShareSync";
import { clearClassicLink, parseClassicToken } from "../lib/shareLocation";
import { useClassicStore } from "../store/useClassicStore";

// A Classic Field Work opened from its share link (/?classic=<token>), without signing in:
// loads it and opens the Classic panel read only (ClassicPanel / ClassicLayer show it)
export const SharedClassicLink = () => {
  const [token] = useState(() => parseClassicToken(window.location.search));
  const [status, setStatus] = useState<"loading" | "ok" | "gone" | "error" | "closed">("loading");

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    openFieldWorkLink(token)
      .then((shared) => {
        if (cancelled) return;
        if (!shared) return setStatus("gone");
        useClassicStore.getState().setViewing({
          token,
          mode: shared.mode,
          name: shared.name,
          ownerName: shared.ownerName,
          updatedAt: shared.updatedAt,
          sightings: shared.data.sightings ?? [],
          origin: shared.data.origin,
          lineLengths: shared.data.lineLengths ?? {},
          declination: shared.data.declination ?? "0",
        });
        setStatus("ok");
      })
      .catch(() => !cancelled && setStatus("error"));
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!token || (status !== "gone" && status !== "error")) return null;

  const close = () => {
    clearClassicLink();
    setStatus("closed");
  };
  return (
    <div className="fixed z-40 top-4 left-1/2 -translate-x-1/2 w-[min(320px,calc(100vw-2rem))] flex items-start gap-2 rounded-xl bg-white border border-sand-200 shadow-xl px-3 py-2.5 text-xs text-ink">
      <span className="flex-1">
        {status === "gone"
          ? "This shared Field Work is no longer available. The owner may have stopped sharing it."
          : "Could not open the shared Field Work. Check your connection and try again."}
      </span>
      <button onClick={close} className="cursor-pointer p-0.5 rounded hover:bg-sand-100 text-sand-500" aria-label="Close">
        <X size={14} />
      </button>
    </div>
  );
};
