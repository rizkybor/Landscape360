import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { fetchMyClubs, ROLE_LABEL, type Club } from "../lib/community";
import { useCommunityStore } from "../store/useCommunityStore";
import { useTrackRecorderStore } from "../store/useTrackRecorderStore";
import { useMarkedLocationStore } from "../store/useMarkedLocationStore";
import { useMarkedAreaStore } from "../store/useMarkedAreaStore";
import { useClassicStore } from "../store/useClassicStore";
import { ClubAvatar } from "./CommunityPanel";

/** Open the Community panel on a club; it shares its spot on screen with these panels */
const openClubPanel = (clubId: string) => {
  useTrackRecorderStore.getState().setPanelOpen(false);
  useMarkedLocationStore.getState().setPanelOpen(false);
  useMarkedAreaStore.getState().setPanelOpen(false);
  useClassicStore.getState().setPanelOpen(false);
  const community = useCommunityStore.getState();
  community.setPanelOpen(true);
  community.openClub(clubId);
};

/**
 * The Community clubs the account belongs to, with its role in each; click one to open it.
 * Nothing when it is in none (same as the Account page of the mobile app).
 */
export const AccountClubs = ({ onOpen }: { onOpen: () => void }) => {
  const clubsVersion = useCommunityStore((s) => s.clubsVersion);
  const [clubs, setClubs] = useState<Club[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchMyClubs().then(
      (c) => !cancelled && setClubs(c),
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [clubsVersion]);

  if (clubs.length === 0) return null;
  return (
    <div className="space-y-2" data-testid="account-clubs">
      <h4 className="text-[10px] font-bold text-sand-500 uppercase tracking-wider">
        {clubs.length === 1 ? "Club" : "Clubs"}
      </h4>
      <div className="bg-white border border-sand-200 rounded-xl divide-y divide-sand-100 overflow-hidden">
        {clubs.map((c) => (
          <button
            key={c.id}
            onClick={() => {
              onOpen();
              openClubPanel(c.id);
            }}
            className="cursor-pointer w-full flex items-center gap-3 p-2.5 text-left hover:bg-sand-50 transition-colors"
            title={`Open ${c.name} in Community`}
          >
            <ClubAvatar club={c} size="sm" />
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-bold text-ink truncate">{c.name}</span>
              <span className="block text-[11px] text-sand-600">
                {ROLE_LABEL[c.role]} · {c.memberCount} member{c.memberCount === 1 ? "" : "s"}
              </span>
            </span>
            <ChevronRight size={16} className="shrink-0 text-sand-400" />
          </button>
        ))}
      </div>
    </div>
  );
};
