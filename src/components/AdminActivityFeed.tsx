import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, Loader2, LogIn, LogOut, RefreshCw, UserPlus, type LucideIcon } from "lucide-react";
import {
  ACTIVITY_PAGE_SIZE,
  fetchActivity,
  type ActivityAvailability,
  type ActivityEvent,
  type ActivityType,
} from "../lib/adminUsers";
import { describeUserAgent, timeAgo } from "../lib/loginHistory";
import { ScrollShadowArea } from "./ScrollShadowArea";

const REFRESH_MS = 60_000;

const TYPE_STYLES: Record<ActivityType, { label: string; icon: LucideIcon; className: string }> = {
  login: { label: "Login", icon: LogIn, className: "bg-forest-50 text-forest-700 border-forest-200" },
  logout: { label: "Logout", icon: LogOut, className: "bg-brick-50 text-brick-600 border-brick-200" },
  request: { label: "Request", icon: UserPlus, className: "bg-gold-50 text-gold-700 border-gold-200" },
};

const FILTERS: { value: ActivityType | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "login", label: "Login" },
  { value: "logout", label: "Logout" },
  { value: "request", label: "Request" },
];

const describe = (e: ActivityEvent) => {
  if (e.type === "request") return `${e.name ?? "Someone"} requested an account`;
  return e.type === "login" ? "Signed in" : "Signed out";
};

// Newest first, without duplicates (pages and refreshes can overlap)
const mergeActivity = (a: ActivityEvent[], b: ActivityEvent[]) => {
  const byId = new Map<string, ActivityEvent>();
  [...a, ...b].forEach((e) => byId.set(e.id, e));
  return [...byId.values()].sort((x, y) => Date.parse(y.at) - Date.parse(x.at));
};

// Sign-ins, sign-outs and account requests of all users (admin only). Shows the latest
// page; older pages load as the list is scrolled down.
export const AdminActivityFeed = () => {
  const [events, setEvents] = useState<ActivityEvent[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [available, setAvailable] = useState<ActivityAvailability | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [filter, setFilter] = useState<ActivityType | "all">("all");

  // The filter a response belongs to; answers for an older filter are dropped
  const filterRef = useRef(filter);
  const loadingMoreRef = useRef(false);
  const eventsRef = useRef<ActivityEvent[] | null>(null);
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  const type = filter === "all" ? undefined : filter;

  // Latest page: replaces the list on first load, otherwise adds new entries on top and
  // keeps the older pages already loaded
  const refresh = useCallback(async () => {
    const requested = filter;
    setIsLoading(true);
    try {
      const result = await fetchActivity({ type: requested === "all" ? undefined : requested });
      if (filterRef.current !== requested) return;
      const current = eventsRef.current;
      setEvents(current ? mergeActivity(result.activity, current) : result.activity);
      if (!current) setHasMore(result.hasMore);
      setAvailable(result.available);
      setError(null);
    } catch (err) {
      if (filterRef.current === requested) setError((err as Error).message);
    } finally {
      if (filterRef.current === requested) setIsLoading(false);
    }
  }, [filter]);

  // Reads the events from state, not the ref: the scroll area calls this from its own
  // effect, which runs before this component's effect updates the ref
  const loadMore = useCallback(async () => {
    const current = events;
    if (!current?.length || !hasMore || loadingMoreRef.current) return;
    const requested = filter;
    loadingMoreRef.current = true;
    setIsLoadingMore(true);
    try {
      const result = await fetchActivity({ before: current[current.length - 1].at, type });
      if (filterRef.current !== requested) return;
      setEvents((prev) => mergeActivity(prev ?? [], result.activity));
      setHasMore(result.hasMore);
    } catch (err) {
      if (filterRef.current === requested) setError((err as Error).message);
    } finally {
      loadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [events, filter, hasMore, type]);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  const changeFilter = (next: ActivityType | "all") => {
    if (next === filter) return;
    filterRef.current = next;
    eventsRef.current = null;
    setEvents(null);
    setHasMore(false);
    setFilter(next);
  };

  const visible = events ?? [];

  const missing = available
    ? [
        !available.logins && "login history (20261024000005)",
        available.logins && !available.logouts && "sign-outs (20261024000008)",
        !available.requests && "account requests (20261024000002)",
      ].filter(Boolean)
    : [];

  return (
    <aside className="p-5 md:p-6 bg-sand-50/60 border-t xl:border-t-0 xl:border-l border-sand-100 md:col-span-2 xl:col-span-1">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h4 className="text-[10px] font-bold text-sand-500 uppercase tracking-wider flex items-center gap-1.5">
          <Activity size={12} /> User Activity
        </h4>
        <button
          onClick={refresh}
          disabled={isLoading}
          className="cursor-pointer p-1.5 rounded-lg hover:bg-sand-100 text-sand-600 hover:text-ink transition-colors disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw size={12} className={isLoading ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="flex flex-wrap gap-1 mb-3" role="group" aria-label="Filter activity">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => changeFilter(f.value)}
            aria-pressed={filter === f.value}
            className={`cursor-pointer px-2 py-0.5 rounded-full border text-[10px] transition-colors ${
              filter === f.value
                ? "bg-forest-800 border-forest-800 text-white font-bold"
                : "bg-white border-sand-200 text-sand-600 hover:bg-sand-100"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {missing.length > 0 && (
        <p className="text-[10px] text-sand-500 mb-2">Not recorded yet: {missing.join(", ")} migration.</p>
      )}

      {error ? (
        <div className="text-[11px] text-brick-600">{error}</div>
      ) : events === null ? (
        <div className="flex items-center gap-2 text-[11px] text-sand-500">
          <Loader2 size={12} className="animate-spin" /> Loading...
        </div>
      ) : visible.length === 0 ? (
        <div className="py-6 text-center text-[11px] text-sand-500">No activity yet</div>
      ) : (
        // Fixed height (about five entries) so the column stays short; older entries
        // load as the list is scrolled down
        <ScrollShadowArea className="max-h-72 overflow-y-auto custom-scrollbar pr-1" onReachEnd={loadMore}>
        <ol className="space-y-2">
          {visible.map((e) => {
            const style = TYPE_STYLES[e.type];
            const Icon = style.icon;
            return (
              <li key={e.id} className="flex gap-2.5 p-2 rounded-lg bg-white border border-sand-100">
                <div className={`w-7 h-7 shrink-0 rounded-lg border flex items-center justify-center ${style.className}`}>
                  <Icon size={13} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-bold text-ink truncate" title={e.email ?? undefined}>
                    {e.email ?? "Deleted account"}
                  </div>
                  <div className="text-[10px] text-sand-600 truncate">{describe(e)}</div>
                  <div
                    className="text-[10px] text-sand-500 truncate"
                    title={`${new Date(e.at).toLocaleString()}${e.type !== "request" && e.detail ? `\n${e.detail}` : ""}`}
                  >
                    {timeAgo(e.at)} · {e.type === "request" ? e.detail : describeUserAgent(e.detail)}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
        <div className="py-2 text-center text-[10px] text-sand-500">
          {isLoadingMore ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 size={11} className="animate-spin" /> Loading older activity...
            </span>
          ) : hasMore ? (
            <button onClick={loadMore} className="cursor-pointer font-bold text-forest-700 hover:underline">
              Load more
            </button>
          ) : (
            visible.length > ACTIVITY_PAGE_SIZE && "No older activity"
          )}
        </div>
        </ScrollShadowArea>
      )}
    </aside>
  );
};
