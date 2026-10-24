import { useEffect } from "react";
import { Marker } from "react-map-gl/mapbox";
import { Siren } from "lucide-react";
import { useSurveyStore } from "../store/useSurveyStore";
import { useSosAlertsStore } from "../store/useSosAlertsStore";
import { SosAlertsPanel } from "./SosAlertsPanel";

const POLL_MS = 30_000;

// Admin only: checks for active S.O.S alerts every 30 s while the app is open, shows a red
// banner and a pulsing marker at each person's last position
export const SosAdminLayer = () => {
  const isAdmin = useSurveyStore((s) => s.isAdmin);
  const { active, loadActive, panelOpen, openPanel, closePanel } = useSosAlertsStore();

  useEffect(() => {
    if (!isAdmin) return;
    loadActive();
    const timer = window.setInterval(loadActive, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && loadActive();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [isAdmin, loadActive]);

  if (!isAdmin) return null;

  return (
    <>
      {active.length > 0 && (
        <button
          onClick={openPanel}
          className="cursor-pointer fixed z-[60] top-20 md:top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2.5 rounded-full bg-brick-600 hover:bg-brick-700 text-white text-sm font-bold shadow-xl shadow-brick-900/30 animate-pulse"
          aria-live="assertive"
        >
          <Siren size={16} /> {active.length} active S.O.S · View
        </button>
      )}

      {active
        .filter((a) => a.lat !== null && a.lng !== null)
        .map((a) => (
          <Marker key={a.id} longitude={a.lng!} latitude={a.lat!} anchor="center" style={{ zIndex: 200 }}>
            <button
              onClick={openPanel}
              className="cursor-pointer relative flex flex-col items-center"
              title={`S.O.S: ${a.name || a.email}`}
            >
              <span className="absolute w-10 h-10 rounded-full bg-brick-500/40 animate-ping" />
              <span className="relative w-5 h-5 rounded-full bg-brick-600 border-2 border-white shadow-lg" />
              <span className="relative mt-1 px-1.5 py-0.5 rounded bg-brick-600 text-white text-[10px] font-bold whitespace-nowrap shadow">
                SOS · {a.name || a.email.split("@")[0]}
              </span>
            </button>
          </Marker>
        ))}

      {panelOpen && <SosAlertsPanel onClose={closePanel} />}
    </>
  );
};
