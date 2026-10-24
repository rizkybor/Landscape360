import { useEffect, useRef, useState } from "react";
import { useSurveyStore } from "../store/useSurveyStore";
import { accountDisplayName } from "../lib/profileContact";
import { SosScreen } from "./SosScreen";
import { flushSosOutbox, pendingSosReports } from "../lib/sosAlerts";

const HOLD_MS = 3000;
const RING = 2 * Math.PI * 22;

// Red S.O.S button on the map, for accounts the admin allowed (and the admin). Hold it for
// 3 s to open the S.O.S screen, so a tap in a pocket does nothing.
export const SosButton = () => {
  const user = useSurveyStore((s) => s.user);
  const canUseSos = useSurveyStore((s) => s.canUseSos || s.isAdmin);
  const [progress, setProgress] = useState(0);
  const [open, setOpen] = useState(false);
  const startRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);

  const stopHold = () => {
    startRef.current = null;
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    setProgress(0);
  };

  const startHold = () => {
    startRef.current = performance.now();
    navigator.vibrate?.(30);
    const step = (now: number) => {
      if (startRef.current === null) return;
      const p = Math.min(1, (now - startRef.current) / HOLD_MS);
      setProgress(p);
      if (p >= 1) {
        stopHold();
        navigator.vibrate?.([80, 60, 80]);
        setOpen(true);
        return;
      }
      frameRef.current = requestAnimationFrame(step);
    };
    frameRef.current = requestAnimationFrame(step);
  };

  useEffect(() => () => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
  }, []);

  // Reports that could not be sent yet (e.g. "I'm safe" pressed without signal) go out when
  // the app opens or the connection comes back, even after the S.O.S screen was closed
  useEffect(() => {
    if (!user || !canUseSos) return;
    const flush = () => {
      if (pendingSosReports().length) flushSosOutbox().catch(() => undefined);
    };
    flush();
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, [user, canUseSos]);

  if (!user || !canUseSos) return null;

  return (
    <>
      <button
        onPointerDown={(e) => {
          e.preventDefault();
          startHold();
        }}
        onPointerUp={stopHold}
        onPointerLeave={stopHold}
        onPointerCancel={stopHold}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          // Keyboard: Enter / Space opens it directly (no accidental key press in a pocket)
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className="relative self-center cursor-pointer w-12 h-12 rounded-full bg-brick-600 hover:bg-brick-700 text-white font-black text-xs tracking-wider shadow-lg shadow-brick-900/30 flex items-center justify-center select-none touch-none"
        style={{ WebkitTouchCallout: "none" }}
        title="Hold for 3 seconds to open S.O.S"
        aria-label="S.O.S: hold for 3 seconds"
      >
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 48 48" aria-hidden>
          <circle cx="24" cy="24" r="22" fill="none" stroke="white" strokeOpacity="0.25" strokeWidth="3" />
          <circle
            cx="24"
            cy="24"
            r="22"
            fill="none"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={RING}
            strokeDashoffset={RING * (1 - progress)}
          />
        </svg>
        <span className="relative">SOS</span>
      </button>
      {progress > 0 && (
        <div className="fixed right-20 top-1/2 -translate-y-1/2 z-50 px-3 py-1.5 rounded-lg bg-ink/80 text-white text-xs font-bold pointer-events-none">
          Keep holding… {Math.ceil((1 - progress) * (HOLD_MS / 1000))}
        </div>
      )}
      {open && <SosScreen userId={user.id} userName={accountDisplayName(user) || user.email || ""} onClose={() => setOpen(false)} />}
    </>
  );
};
