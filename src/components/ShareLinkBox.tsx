import { Link2, Smartphone } from "lucide-react";
import { MOBILE_APP } from "../config";

// "Share as a link" for marked locations and areas: links are made, sent and turned off in
// the mobile app. Links people receive still open on the web without signing in
// (SharedPlaceLayer, SharedAreaLayer).
export const ShareLinkBox = ({ what }: { what: string }) => {
  const released = MOBILE_APP.playStoreUrl || MOBILE_APP.appStoreUrl;
  return (
    <div className="space-y-1.5 pt-2 border-t border-sand-100">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-sand-600">
        <Link2 size={11} /> Share as a link
      </div>
      <div className="flex items-start gap-2 rounded-lg bg-forest-50 border border-forest-200 px-2.5 py-2">
        <Smartphone size={14} className="shrink-0 mt-0.5 text-forest-700" />
        <p className="text-[10px] text-forest-800 leading-relaxed">
          Create a WhatsApp link for {what} in the Landscape 360 Mobile App
          {released ? "." : " (coming soon on Google Play and the App Store)."} Links you receive open here, no
          sign-in needed.
        </p>
      </div>
    </div>
  );
};
