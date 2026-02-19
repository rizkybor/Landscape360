import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import { useSurveyStore } from "../store/useSurveyStore";
import {
  X,
  History,
  RefreshCw,
  Trash2,
  FileDown,
} from "lucide-react";
// Removed static imports to optimize bundle size
// import jsPDF from "jspdf";
// import "jspdf-autotable";

interface TrackerLog {
  id: string;
  user_id: string;
  lat: number;
  lng: number;
  elevation: number;
  speed: number;
  timestamp: string;
  profiles?: { email: string } | null; // Added manual profile mapping
}

const toDMS = (deg: number, isLat: boolean): string => {
  const absolute = Math.abs(deg);
  const degrees = Math.floor(absolute);
  const minutesNotTruncated = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesNotTruncated);
  const seconds = ((minutesNotTruncated - minutes) * 60).toFixed(1);

  const dir = isLat ? (deg >= 0 ? "N" : "S") : deg >= 0 ? "E" : "W";

  return `${degrees}° ${minutes}' ${seconds}" ${dir}`;
};

export const TrackerHistoryViewer = () => {
  const { user, userRole } = useSurveyStore();
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<TrackerLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>("all");
  const [availableUsers, setAvailableUsers] = useState<
    { id: string; name: string }[]
  >([]);
  const [hasMore, setHasMore] = useState(true);
  const LIMIT = 20;

  // Export PDF Function (Optimized)
  const exportPDF = () => {
    if (logs.length === 0) {
      alert("No logs to export.");
      return;
    }

    // Optimization: Dynamic import to reduce initial bundle size
    import('jspdf').then(({ default: jsPDF }) => {
        import('jspdf-autotable').then(() => {
            const doc = new jsPDF();
            const title = userRole === "monitor360" && selectedUserFilter !== "all" 
                ? `Tracking Log - User: ${selectedUserFilter}`
                : "Tracking Logs Report";
        
            doc.text(title, 14, 15);
            doc.setFontSize(10);
            doc.text(`Generated: ${new Date().toLocaleString("id-ID")}`, 14, 22);
        
            const tableColumn = ["Time", "Date", "User", "Latitude", "Longitude", "Elev (m)", "Speed (km/h)"];
            const tableRows: any[] = [];
        
            logs.forEach((log) => {
              const email = log.profiles?.email || log.user_id;
              const userName = email.includes("@") ? email.split("@")[0] : email.slice(0, 8);
              const dateObj = new Date(log.timestamp);
              
              const logData = [
                dateObj.toLocaleTimeString("id-ID"),
                dateObj.toLocaleDateString("id-ID"),
                userName,
                log.lat.toFixed(6),
                log.lng.toFixed(6),
                log.elevation?.toFixed(0) || "0",
                log.speed?.toFixed(1) || "0"
              ];
              tableRows.push(logData);
            });
        
            (doc as any).autoTable({
              head: [tableColumn],
              body: tableRows,
              startY: 30,
              styles: { fontSize: 8 }, // Optimize font size for table
              headStyles: { fillColor: [41, 128, 185] } // Professional blue header
            });
        
            doc.save(`tracking_logs_${new Date().toISOString().slice(0, 10)}.pdf`);
        });
    });
  };

  // Delete Log Function (Monitor Only)
  const deleteLog = async (logId: string) => {
    if (userRole !== "monitor360") return;
    if (!confirm("Are you sure you want to delete this log entry?")) return;

    try {
      const { error } = await supabase
        .from("tracker_logs")
        .delete()
        .eq("id", logId);

      if (error) throw error;

      // Remove from local state immediately
      setLogs((prev) => prev.filter((l) => l.id !== logId));
    } catch (err) {
      console.error("Failed to delete log:", err);
      alert("Failed to delete log. Ensure you have permission.");
    }
  };

  // Fetch unique users for filter (Monitor only) - Decoupled Approach
  useEffect(() => {
    if (isOpen && userRole === "monitor360") {
      const fetchUsers = async () => {
        // 1. Get recent unique user_ids from logs
        const { data: logData } = await supabase
          .from("tracker_logs")
          .select("user_id")
          .order("timestamp", { ascending: false })
          .limit(100);

        if (logData) {
          const userIds = Array.from(new Set(logData.map((l) => l.user_id)));

          // 2. Get profiles for these IDs
          const { data: profileData } = await supabase
            .from("profiles")
            .select("id, email")
            .in("id", userIds);

          const profileMap = new Map();
          profileData?.forEach((p: any) => profileMap.set(p.id, p));

          // 3. Merge
          const uniqueUsersList = userIds.map((id) => {
            const profile = profileMap.get(id);
            return {
              id,
              name: profile?.email || `User ${id.slice(0, 8)}`,
            };
          });

          setAvailableUsers(uniqueUsersList);
        }
      };
      fetchUsers();
    }
  }, [isOpen, userRole]);

  // Fetch Logs - Decoupled Approach & Memoized
  const fetchLogs = useCallback(async (isLoadMore = false) => {
    if (!user) return;
    setIsLoading(true);

    try {
      // Step 1: Fetch logs ONLY (No join)
      // Optimize: Select only needed fields to reduce payload
      let query = supabase
        .from("tracker_logs")
        .select("id, user_id, lat, lng, elevation, speed, timestamp")
        .order("timestamp", { ascending: false })
        .range(page * LIMIT, (page + 1) * LIMIT - 1);

      if (userRole !== "monitor360") {
        query = query.eq("user_id", user.id);
      } else if (selectedUserFilter !== "all") {
        query = query.eq("user_id", selectedUserFilter);
      }

      const { data: logData, error: logError } = await query;

      if (logError) throw logError;

      if (!logData || logData.length === 0) {
        if (!isLoadMore) setLogs([]);
        setHasMore(false);
        return;
      }
      
      if (logData.length < LIMIT) {
          setHasMore(false);
      } else {
          setHasMore(true);
      }

      // Step 2: Fetch profiles manually for the fetched logs
      const userIds = Array.from(new Set(logData.map((l) => l.user_id)));
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, email")
        .in("id", userIds);

      const profileMap = new Map();
      profileData?.forEach((p: any) => profileMap.set(p.id, p));

      // Step 3: Merge data
      const logsWithProfiles = logData.map((log) => ({
        ...log,
        profiles: profileMap.get(log.user_id) || null,
      }));

      setLogs(prev => isLoadMore ? [...prev, ...logsWithProfiles] : logsWithProfiles);
    } catch (err) {
      console.error("Error fetching logs:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user, userRole, page, selectedUserFilter, LIMIT]);

  // Initial Load & Filter Change
  useEffect(() => {
    setPage(0);
    setHasMore(true);
    fetchLogs(false);
  }, [selectedUserFilter]);

  // Load More when page changes (scrolling)
  useEffect(() => {
      if (page > 0) {
          fetchLogs(true);
      }
  }, [page]);

  // Infinite Scroll Handler
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
      const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
      if (scrollHeight - scrollTop <= clientHeight + 50 && !isLoading && hasMore) {
          setPage(prev => prev + 1);
      }
  };

  if (!user) return null;

  return (
    <>
      {/* Toggle Button - Repositioned to group with Mapbox Controls (Top Right) */}
      <div className="absolute top-[270px] right-4.5 flex flex-col items-center gap-2 z-[20]">
        <button
          onClick={() => setIsOpen(true)}
          className="w-[40px] h-[40px] bg-white rounded-xl shadow-[0_0_0_2px_rgba(0,0,0,0.1)] flex items-center justify-center text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition-colors border border-slate-300/50"
          title="View Tracking History"
        >
          <History size={16} strokeWidth={2.5} />
        </button>
      </div>

      {/* Slide-Up Panel (Bottom Sheet) */}
      <div
        className={`fixed inset-x-0 bottom-0 z-[60] bg-white shadow-[0_-5px_20px_-5px_rgba(0,0,0,0.1)] rounded-t-2xl transition-transform duration-300 ease-out transform ${isOpen ? "translate-y-0" : "translate-y-full"}`}
        style={{ height: "auto", maxHeight: "60vh" }} // Auto height to fit content, max 60vh
      >
        {/* Drag Handle (Visual Only) */}
        <div
          className="flex justify-center pt-3 pb-1"
          onClick={() => setIsOpen(!isOpen)}
        >
          <div className="w-12 h-1.5 bg-slate-200 rounded-full cursor-pointer hover:bg-slate-300 transition-colors"></div>
        </div>

        {/* Header */}
        <div className="px-4 pb-3 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-50 p-2 rounded-full text-blue-600">
              <History size={18} />
            </div>
            <div>
              <h2 className="font-bold text-slate-800 text-sm md:text-base">
                Tracking History
              </h2>
              <p className="text-xs text-slate-500">
                {userRole === "monitor360"
                  ? "Monitoring All Units"
                  : "Your Movement Logs"}
              </p>
            </div>
          </div>

          {/* Controls Group: Refresh + Filter */}
          <div className="flex items-center gap-2">
            {/* Manual Refresh Button */}
            <button
              onClick={() => {
                  setPage(0);
                  setHasMore(true);
                  fetchLogs(false);
              }}
              className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-blue-600 transition-colors"
              title="Refresh Data"
            >
              <RefreshCw
                size={16}
                className={isLoading ? "animate-spin" : ""}
              />
            </button>
            
            {/* Export PDF (Monitor Only) */}
            {userRole === "monitor360" && (
                <button
                    onClick={exportPDF}
                    className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-red-600 transition-colors"
                    title="Export to PDF"
                >
                    <FileDown size={16} />
                </button>
            )}

            {/* Monitor Filter */}
            {userRole === "monitor360" && (
              <div className="flex items-center gap-2">
                <select
                  value={selectedUserFilter}
                  onChange={(e) => {
                    setSelectedUserFilter(e.target.value);
                    setPage(0);
                  }}
                  className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none bg-slate-50 text-slate-600 max-w-[120px]"
                >
                  <option value="all">All Users</option>
                  {availableUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name.includes("@")
                        ? u.name.split("@")[0]
                        : u.name.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content Area - Fixed Height for ~6 rows (~350px) + Scroll */}
        <div 
            className="overflow-y-auto bg-white scroll-smooth"
            style={{ height: '350px' }} // Approx height for 5-6 rows
            onScroll={handleScroll}
        >
          {isLoading && logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
              <RefreshCw size={24} className="animate-spin" />
              <span className="text-xs">Loading data...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2 p-8 text-center">
              <History size={32} className="opacity-20" />
              <span className="text-xs">No movement logs found.</span>
              <p className="text-[10px] max-w-[200px] text-slate-300">
                Activate "Broadcast My GPS" and move around to start generating
                history logs.
              </p>
              <button
                onClick={() => fetchLogs()}
                className="mt-2 text-xs text-blue-500 hover:underline flex items-center gap-1"
              >
                <RefreshCw size={10} /> Try Refreshing
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {logs.map((log, index) => (
                <div
                  key={log.id}
                  className="px-4 py-3 hover:bg-slate-50 transition-colors flex items-center justify-between group"
                >
                  {/* Left: User Info & Time */}
                  <div className="flex items-center gap-3 min-w-[120px] sm:min-w-[140px]">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-[10px] sm:text-xs shrink-0">
                      {index + 1}
                    </div>

                    <div className="flex flex-col overflow-hidden">
                      <span className="text-xs sm:text-sm font-bold text-slate-800 truncate max-w-[80px] sm:max-w-none">
                        {/* Show Name/Email if available (Monitor), else Time */}
                        {(() => {
                          const email = log.profiles?.email;
                          return email ? email.split("@")[0] : "Me";
                        })()}
                      </span>
                      <div className="flex flex-col">
                        <span className="text-[9px] sm:text-[10px] text-slate-400 font-mono leading-tight">
                            {new Date(log.timestamp).toLocaleTimeString("id-ID", {
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                            }).replace(/\./g, ":")}
                        </span>
                        <span className="text-[8px] sm:text-[9px] text-slate-300 font-medium leading-tight">
                            {new Date(log.timestamp).toLocaleDateString("id-ID", {
                                weekday: "short",
                                day: "numeric",
                                month: "short",
                            })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Middle: Coordinates (DMS) - Visible on Mobile now */}
                  <div className="flex-1 px-2 sm:px-4">
                    <div className="flex flex-col gap-0.5 sm:gap-1">
                      <div className="hidden sm:flex text-[10px] font-bold text-slate-400 uppercase tracking-wider items-center gap-1">
                        COORDINATES
                      </div>
                      <div className="text-[9px] sm:text-xs font-mono text-slate-600 bg-slate-50 px-1.5 py-1 sm:px-2 sm:py-1.5 rounded border border-slate-100 whitespace-nowrap overflow-x-auto no-scrollbar">
                        <div>{toDMS(log.lat, true)}</div>
                        <div>{toDMS(log.lng, false)}</div>
                      </div>
                    </div>
                  </div>

                  {/* Right: Stats & Actions */}
                  <div className="flex items-center gap-2 sm:gap-4 text-right">
                    <div className="flex flex-col items-end w-[40px] sm:w-[60px]">
                      <span className="text-xs sm:text-sm font-bold text-slate-700">
                        {log.elevation?.toFixed(0) || 0}
                      </span>
                      <span className="text-[8px] sm:text-[9px] text-slate-400 uppercase">
                        mdpl
                      </span>
                    </div>
                    <div className="flex flex-col items-end w-[35px] sm:w-[50px]">
                      <span className="text-xs sm:text-sm font-bold text-slate-700">
                        {log.speed?.toFixed(1) || 0}
                      </span>
                      <span className="text-[8px] sm:text-[9px] text-slate-400 uppercase">
                        km/h
                      </span>
                    </div>

                    {/* Delete Action (Monitor Only) */}
                    {userRole === "monitor360" && (
                      <button
                        onClick={() => deleteLog(log.id)}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors ml-1"
                        title="Delete Log"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              
              {/* Loading Indicator for Infinite Scroll */}
              {isLoading && logs.length > 0 && (
                  <div className="p-4 flex justify-center items-center text-slate-400 gap-2 text-xs">
                      <RefreshCw size={14} className="animate-spin" /> Loading more...
                  </div>
              )}
              
              {!hasMore && logs.length > 0 && (
                  <div className="p-4 text-center text-[10px] text-slate-300 uppercase tracking-widest font-medium">
                      No more logs
                  </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};
