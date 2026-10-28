import { createPortal } from "react-dom";
import { Smartphone, X } from "lucide-react";
import type { ReactNode } from "react";
import { MOBILE_APP } from "../config";
import { EMERGENCY_NUMBERS } from "../lib/sos";
import { Phone } from "lucide-react";

const GooglePlayIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <path d="M3.6 1.8 13.4 12 3.6 22.2c-.4-.2-.6-.6-.6-1.1V2.9c0-.5.2-.9.6-1.1Z" fill="#00d7fe" />
    <path d="m16.7 8.7-3.3 3.3-9.8-10.2c.3-.2.8-.2 1.2 0l11.9 6.9Z" fill="#00f076" />
    <path d="m16.7 15.3-11.9 6.9c-.4.2-.9.2-1.2 0L13.4 12l3.3 3.3Z" fill="#ff3a44" />
    <path d="m20.4 13.1-3.7 2.2L13.4 12l3.3-3.3 3.7 2.2c.8.5.8 1.7 0 2.2Z" fill="#ffd500" />
  </svg>
);

const AppleIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M16.4 12.6c0-2.4 2-3.6 2.1-3.7-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.9-3.2-.8-1.6 0-3.1 1-4 2.4-1.7 3-.4 7.4 1.2 9.8.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.2-.8 1.5 0 1.9.8 3.2.8 1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8 0 0-2.6-1-2.6-3.9ZM14 5.4c.7-.8 1.1-1.9 1-3-1 0-2.1.6-2.8 1.4-.6.7-1.2 1.8-1 2.9 1 .1 2.1-.6 2.8-1.3Z" />
  </svg>
);

// Store badges in the style of the official ones: links once the app is released,
// "Coming soon" until then
export const StoreBadges = ({ className = "" }: { className?: string }) => (
  <div className={`flex flex-wrap justify-center gap-2 ${className}`}>
    {[
      { name: "Google Play", icon: <GooglePlayIcon />, url: MOBILE_APP.playStoreUrl },
      { name: "App Store", icon: <AppleIcon />, url: MOBILE_APP.appStoreUrl },
    ].map((store) => {
      const body = (
        <>
          {store.icon}
          <span className="flex flex-col items-start leading-none">
            <span className="text-[8px] uppercase tracking-wider opacity-80">{store.url ? "Get it on" : "Coming soon on"}</span>
            <span className="text-[13px] font-bold">{store.name}</span>
          </span>
        </>
      );
      const cls = "inline-flex items-center gap-2 pl-2.5 pr-3.5 py-1.5 rounded-lg bg-ink text-white border border-ink";
      return store.url ? (
        <a key={store.name} href={store.url} target="_blank" rel="noopener noreferrer" className={`${cls} hover:bg-forest-900`}>
          {body}
        </a>
      ) : (
        <span key={store.name} className={`${cls} opacity-90`} aria-label={`${store.name}: coming soon`}>
          {body}
        </span>
      );
    })}
  </div>
);

/**
 * Info for a feature that runs in the native mobile app (it needs the phone while the screen
 * is off, the GPS in the background, push, the flashlight, or share links made on the phone).
 */
export const NativeAppNotice = ({ feature, reason, children }: { feature: string; reason: string; children?: ReactNode }) => (
  <div className="py-4 px-2 text-center space-y-2.5">
    <div className="mx-auto w-11 h-11 rounded-2xl bg-forest-50 border border-forest-200 flex items-center justify-center text-forest-700">
      <Smartphone size={20} />
    </div>
    <p className="text-[10px] font-bold uppercase tracking-wider text-forest-700">{feature}</p>
    <p className="text-sm font-bold text-ink">Available in the Landscape 360 Mobile App</p>
    <p className="text-[11px] text-sand-600 leading-relaxed max-w-xs mx-auto">{reason}</p>
    {children}
    <StoreBadges />
    <p className="text-[10px] text-sand-500">Android and iPhone · release date to be announced</p>
  </div>
);

/** The same notice as a small dialog, for buttons that used to start the feature */
export const NativeAppDialog = ({
  feature,
  reason,
  onClose,
  children,
}: {
  feature: string;
  reason: string;
  onClose: () => void;
  children?: ReactNode;
}) =>
  createPortal(
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-3 bg-ink/40" onClick={onClose}>
      <div
        role="dialog"
        aria-label={`${feature}: Landscape 360 Mobile App`}
        className="relative w-full max-w-sm rounded-2xl bg-white border border-sand-200 shadow-2xl px-4 pt-3 pb-4 mb-[env(safe-area-inset-bottom)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="cursor-pointer absolute top-2.5 right-2.5 p-1.5 rounded-lg hover:bg-sand-100 text-sand-600"
          aria-label="Close"
        >
          <X size={16} />
        </button>
        <NativeAppNotice feature={feature} reason={reason}>
          {children}
        </NativeAppNotice>
      </div>
    </div>,
    document.body,
  );

// Why each feature lives in the app (the web cannot do it reliably)
export const NATIVE_REASONS = {
  track:
    "Recording needs the GPS to keep running with the screen off. In a browser it stops as soon as the screen locks, so tracks come out broken.",
  gps: "Broadcasting your position to your team needs the GPS to keep running in the background, which browsers do not allow.",
  sos: "In an emergency the S.O.S has to keep reporting with the screen off, reach the admin as a push notification, and use the flashlight. Only the app can do that.",
  offline:
    "The app stores offline map areas on the phone itself: much larger areas, with 3D terrain, and the phone never clears them to free space.",
  shareLocation:
    "Share your position from the app, where the GPS fix is faster and steadier. Locations shared with you still open here.",
  shareLink:
    "Create and turn off share links in the app. Links you receive still open here, no sign-in needed.",
} as const;

/**
 * S.O.S on the web: the app runs it (it keeps reporting with the screen off, pushes to the
 * admin, flashlight). The emergency numbers stay one tap away here, because in an emergency
 * nobody should have to install an app first.
 */
export const SosAppDialog = ({ onClose }: { onClose: () => void }) => (
  <NativeAppDialog feature="S.O.S" reason={NATIVE_REASONS.sos} onClose={onClose}>
    <div className="grid grid-cols-2 gap-2 py-1">
      {EMERGENCY_NUMBERS.map((n) => (
        <a
          key={n.number}
          href={`tel:${n.number}`}
          className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-brick-600 hover:bg-brick-700 text-white text-xs font-bold"
        >
          <Phone size={14} /> {n.label}
        </a>
      ))}
    </div>
  </NativeAppDialog>
);
