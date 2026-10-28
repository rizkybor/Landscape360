import { useState } from "react";
import { Share2 } from "lucide-react";
import { NativeAppDialog, NATIVE_REASONS } from "./NativeAppNotice";

// Share Location (send where you are now): made in the mobile app. Locations other people
// share still open on the web (see SharedLocationMarker).
export const ShareLocationButton = () => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="bg-white/90 backdrop-blur-sm p-2.5 rounded-xl shadow-lg border border-white/20 hover:bg-white transition-all active:scale-95 group cursor-pointer"
        title="Share Location"
        aria-label="Share Location"
      >
        <Share2 size={20} className="text-sand-700 group-hover:text-forest-800 transition-colors" />
      </button>
      {open && (
        <NativeAppDialog feature="Share Location" reason={NATIVE_REASONS.shareLocation} onClose={() => setOpen(false)} />
      )}
    </>
  );
};
