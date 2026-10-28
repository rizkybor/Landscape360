import { useEffect, useState } from "react";
import { useSurveyStore } from "../store/useSurveyStore";
import { flushSosOutbox, pendingSosReports } from "../lib/sosAlerts";
import { SosAppDialog } from "./NativeAppNotice";

// Red S.O.S button on the map, for accounts the admin allowed (the admin has it in User
// Account). S.O.S runs in the mobile app; here it explains that and keeps 112 / Basarnas
// one tap away.
export const SosButton = () => {
  const user = useSurveyStore((s) => s.user);
  const isAdmin = useSurveyStore((s) => s.isAdmin);
  const canUseSos = useSurveyStore((s) => s.canUseSos || s.isAdmin);
  const [open, setOpen] = useState(false);

  // Reports queued by the earlier web S.O.S (e.g. "I'm safe" without signal) still go out
  useEffect(() => {
    if (!user || !canUseSos) return;
    const flush = () => {
      if (pendingSosReports().length) flushSosOutbox().catch(() => undefined);
    };
    flush();
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, [user, canUseSos]);

  if (!user || !canUseSos || isAdmin) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative self-center cursor-pointer w-12 h-12 rounded-full bg-brick-600 hover:bg-brick-700 text-white font-black text-xs tracking-wider shadow-lg shadow-brick-900/30 flex items-center justify-center select-none"
        title="S.O.S"
        aria-label="S.O.S"
      >
        SOS
      </button>
      {open && <SosAppDialog onClose={() => setOpen(false)} />}
    </>
  );
};
