import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "../lib/supabaseClient";
import { useSurveyStore } from "../store/useSurveyStore";
import { useTrackerStore } from "../store/useTrackerStore";
import {
  X,
  History,
  RefreshCw,
  Trash2,
  FileDown,
  Calendar,
  Map as MapIcon,
  List,
  Eye,
  EyeOff
} from "lucide-react";

interface TrackerLog {
  id: string;
  user_id: string;
  lat: number;
  lng: number;
  elevation: number;
  speed: number;
  timestamp: string;
  profiles?: { email: string } | null;
}

// Session Summary Type
interface SessionSummary {
    date: string;
    count: number;
    startTime: string;
    endTime: string;
    user_id: string;
    email?: string;
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
  const { user, userRole, subscriptionStatus } = useSurveyStore();
  const { setViewingSession, viewingSession, isSessionVisible, setSessionVisible } = useTrackerStore();
  
  const [isOpen, setIsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'sessions' | 'logs'>('sessions');
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  
  const [logs, setLogs] = useState<TrackerLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>("all");
  const [availableUsers, setAvailableUsers] = useState<
    { id: string; name: string }[]
  >([]);
  const [hasMore, setHasMore] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<string | null>(null);
  const LIMIT = 20;

  // Access Control Logic
  const canAccess = useMemo(() => {
      if (userRole === 'monitor360' && subscriptionStatus === 'Enterprise') return true;
      if (userRole === 'pengguna360' && subscriptionStatus === 'Pro') return true;
      return false;
  }, [userRole, subscriptionStatus]);

  if (!canAccess || !user) return null;

  // --- Session Logic ---
  
  const [sessionPage, setSessionPage] = useState(0);
  const [hasMoreSessions, setHasMoreSessions] = useState(true);
  const SESSION_LIMIT = 20;

  // Fetch Sessions (Grouped by Date using RPC)
  const fetchSessions = useCallback(async (isLoadMore = false) => {
      setIsLoading(true);
      try {
          // Use RPC function for server-side grouping and pagination
          const { data, error } = await supabase.rpc('get_tracker_sessions', {
             p_user_id: userRole === 'monitor360' && selectedUserFilter !== 'all' ? selectedUserFilter : null,
             p_limit: SESSION_LIMIT,
             p_offset: isLoadMore ? (sessionPage + 1) * SESSION_LIMIT : 0
          });

          if (error) throw error;

          if (!data || data.length === 0) {
              if (!isLoadMore) setSessions([]);
              setHasMoreSessions(false);
              return;
          }

          if (data.length < SESSION_LIMIT) {
              setHasMoreSessions(false);
          } else {
              setHasMoreSessions(true);
          }

          // Fetch profiles for users in sessions
          const uniqueUserIds = Array.from(new Set(data.map((s: any) => s.user_id)));
          const { data: profileData } = await supabase
            .from("profiles")
            .select("id, email")
            .in("id", uniqueUserIds);
            
          const profileMap = new Map();
          profileData?.forEach((p: any) => profileMap.set(p.id, p));

          const sessionList = data.map((s: any) => ({
              date: s.session_date,
              count: s.point_count,
              startTime: s.start_time,
              endTime: s.end_time,
              user_id: s.user_id,
              email: profileMap.get(s.user_id)?.email
          }));

          setSessions(prev => isLoadMore ? [...prev, ...sessionList] : sessionList);
          // if (isLoadMore) setSessionPage(prev => prev + 1); // Removed: handled by handleScroll -> useEffect

      } catch (err) {
          console.error("Error fetching sessions:", err);
      } finally {
          setIsLoading(false);
      }
  }, [user, userRole, selectedUserFilter, sessionPage]);

  // Load Session to Map
  const handleLoadSession = async (session: SessionSummary) => {
      setIsLoading(true);
      try {
          // Fetch full points for this session (Day)
          // We add a buffer to the day range to be safe
          const startOfDay = `${session.date}T00:00:00`;
          const endOfDay = `${session.date}T23:59:59`;

          const { data, error } = await supabase
            .from("tracker_logs")
            .select("*")
            .eq("user_id", session.user_id)
            .gte("timestamp", startOfDay)
            .lte("timestamp", endOfDay)
            .order("timestamp", { ascending: true });

          if (error) throw error;

          if (data && data.length > 0) {
              // @ts-ignore - Map supabase types to TrackerPacket
              setViewingSession(data);
              setIsOpen(false); // Close panel to view map
          } else {
              alert("No points found for this session.");
          }
      } catch (err) {
          console.error("Failed to load session:", err);
          alert("Failed to load session data.");
      } finally {
          setIsLoading(false);
      }
  };

  // --- Original Log Logic ---

  // Export PDF Function (Optimized - Fetches Full Data)
  const exportPDF = async () => {
    setIsExporting(true);
    try {
      // 1. Load Libraries Dynamically
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");

      // 2. Fetch ALL relevant data (up to 1000 records for PDF)
      let query = supabase
        .from("tracker_logs")
        .select("id, user_id, lat, lng, elevation, speed, timestamp")
        .order("timestamp", { ascending: false })
        .limit(1000); // Reasonable limit for export

      if (userRole !== "monitor360") {
        if (!user) return; // Guard clause
        query = query.eq("user_id", user.id);
      } else if (selectedUserFilter !== "all") {
        query = query.eq("user_id", selectedUserFilter);
      }

      const { data: logData, error } = await query;
      if (error) throw error;

      if (!logData || logData.length === 0) {
        alert("No logs to export.");
        return;
      }

      // 3. Fetch Profiles
      const userIds = Array.from(new Set(logData.map((l) => l.user_id)));
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, email")
        .in("id", userIds);

      const profileMap = new Map();
      profileData?.forEach((p: any) => profileMap.set(p.id, p));

      // 4. Generate PDF
      const doc = new jsPDF();
      const title =
        userRole === "monitor360" && selectedUserFilter !== "all"
          ? `Tracking Log - User: ${selectedUserFilter}`
          : "Tracking Logs Report";

      // --- Header & Layout ---
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text(title, 14, 20); // Main Title

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Generated: ${new Date().toLocaleString("id-ID")}`, 14, 28);
      doc.text(`Total Records: ${logData.length}`, 14, 33);

      // Add "Landscape 360" Watermark (Diagonal)
      // This needs to be added to every page, so we use the didDrawPage hook
      
      const tableColumn = [
        "Time",
        "Date",
        "User",
        "Latitude",
        "Longitude",
        "Elev (m)",
        "Speed",
      ];
      
      const tableRows = logData.map((log) => {
        const profile = profileMap.get(log.user_id);
        const email = profile?.email || log.user_id;
        const userName = email.includes("@")
          ? email.split("@")[0]
          : email.slice(0, 8);
        const dateObj = new Date(log.timestamp);

        return [
          dateObj.toLocaleTimeString("id-ID"),
          dateObj.toLocaleDateString("id-ID"),
          userName,
          toDMS(log.lat, true),  // Converted to DMS
          toDMS(log.lng, false), // Converted to DMS
          log.elevation?.toFixed(0) || "0",
          (log.speed?.toFixed(1) || "0") + " km/h",
        ];
      });

      // Explicitly register plugin if needed or call directly if it's a default export function
      // In newer jspdf-autotable versions with dynamic import, we might need to call it as a function
      const autoTableOptions = {
        head: [tableColumn],
        body: tableRows,
        startY: 40,
        styles: { 
            fontSize: 9, 
            font: "helvetica",
            cellPadding: 3,
            textColor: [50, 50, 50] 
        },
        headStyles: { 
            fillColor: [31, 111, 178], // #1F6FB2 (Requested Blue)
            textColor: [255, 255, 255],
            fontStyle: 'bold'
        },
        alternateRowStyles: {
            fillColor: [245, 245, 245] // Zebra striping
        },
        columnStyles: {
            0: { cellWidth: 20 }, // Time
            1: { cellWidth: 20 }, // Date
            2: { cellWidth: 25 }, // User
            // Lat/Lng need more space for DMS
            3: { cellWidth: 35 }, 
            4: { cellWidth: 35 },
            5: { halign: 'right' }, // Elev right-align
            6: { halign: 'right' }  // Speed right-align
        },
        theme: "grid",
        
        // --- Watermark & Footer Hook ---
        didDrawPage: (_data: any) => {
            const pageSize = doc.internal.pageSize;
            const pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();
            const pageWidth = pageSize.width ? pageSize.width : pageSize.getWidth();

            // Watermark (Top Right, Small, Thin)
            doc.saveGraphicsState();
            doc.setTextColor(180, 180, 180); // Subtle Gray
            doc.setFontSize(9);
            doc.setFont("helvetica", "normal"); 
            doc.text("Landscape 360", pageWidth - 14, 12, {
                align: 'right',
            });
            doc.restoreGraphicsState();

            // Footer
            const pageCount = (doc.internal as any).getNumberOfPages();
            const str = "Page " + pageCount;
            doc.setFontSize(8);
            doc.setTextColor(100, 100, 100);
            doc.text(str, pageWidth - 20, pageHeight - 10, { align: 'right' });
            doc.text("Landscape 360 Tracking System", 14, pageHeight - 10);
        }
      };

      if (typeof autoTable === 'function') {
          // @ts-ignore
          autoTable(doc, autoTableOptions);
      } else {
          // Fallback to prototype method
          (doc as any).autoTable(autoTableOptions);
      }

      doc.save(`tracking_logs_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error("Export failed:", err);
      // Detailed error for debugging
      alert(`Failed to export PDF: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Delete Log Function (Monitor Only)
  const deleteLog = async (logId: string) => {
    if (userRole !== "monitor360") return;
    // Removed default confirm alert
    
    try {
      const { error } = await supabase
        .from("tracker_logs")
        .delete()
        .eq("id", logId);

      if (error) throw error;

      // Remove from local state immediately
      setLogs((prev) => prev.filter((l) => l.id !== logId));
      setDeleteConfirmation(null); // Close modal on success
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
    setSessionPage(0);
    setHasMoreSessions(true);
    if (viewMode === 'sessions') {
        fetchSessions(false);
    } else {
        fetchLogs(false);
    }
  }, [selectedUserFilter, viewMode]);

  // Load More when page changes (scrolling)
  useEffect(() => {
      if (page > 0 && viewMode === 'logs') {
          fetchLogs(true);
      }
  }, [page, viewMode]);

  // Load More Sessions
  useEffect(() => {
      if (sessionPage > 0 && viewMode === 'sessions') {
          // This useEffect might be redundant if we call fetchSessions directly in handleScroll, 
          // but sticking to the pattern: state change triggers fetch
          fetchSessions(true);
      }
  }, [sessionPage, viewMode]);

  // Infinite Scroll Handler
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
      const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
      if (scrollHeight - scrollTop <= clientHeight + 50 && !isLoading) {
          if (viewMode === 'logs' && hasMore) {
              setPage(prev => prev + 1);
          } else if (viewMode === 'sessions' && hasMoreSessions) {
              // Note: sessionPage is incremented AFTER fetch success in fetchSessions to avoid race conditions 
              // or we can increment here. 
              // Current pattern: fetchLogs increments page in handleScroll -> useEffect calls fetch.
              // fetchSessions logic I wrote: "if (isLoadMore) setSessionPage(prev => prev + 1);" INSIDE fetchSessions.
              // This is conflicting. Let's align them.
              
              // REFACTOR: Let's use the same pattern as Logs.
              // Increment page here, and let useEffect trigger fetch.
              // BUT fetchSessions implementation above uses sessionPage for offset calculation.
              // So we should increment it here.
              setSessionPage(prev => prev + 1); // This will trigger useEffect
          }
      }
  };

  if (!user) return null;

  return (
    <>
      {/* Toggle Button - Repositioned to group with Mapbox Controls (Top Right) */}
      <div className="absolute top-[270px] right-4.5 flex flex-col items-center gap-2 z-[20]">
        <button
          onClick={() => setIsOpen(true)}
          className="cursor-pointer w-[40px] h-[40px] bg-white rounded-xl shadow-[0_0_0_2px_rgba(0,0,0,0.1)] flex items-center justify-center text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition-colors border border-slate-300/50"
          title="Tracking Lists"
        >
          <List size={16} strokeWidth={2.5} />
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
                Tracking Lists
              </h2>
              <p className="text-xs text-slate-500">
                {userRole === "monitor360"
                  ? "Monitoring All Units"
                  : "Your Movement History"}
              </p>
            </div>
          </div>

          {/* Controls Group: Refresh + Filter */}
          <div className="flex items-center gap-2">
            
            {/* View Mode Toggle */}
            <div className="flex bg-slate-100 p-0.5 rounded-lg mr-2">
                <button
                    onClick={() => setViewMode('sessions')}
                    className={`cursor-pointer px-2 py-1 text-[10px] font-bold rounded-md transition-all ${viewMode === 'sessions' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Sessions
                </button>
                <button
                    onClick={() => setViewMode('logs')}
                    className={`cursor-pointer px-2 py-1 text-[10px] font-bold rounded-md transition-all ${viewMode === 'logs' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Logs
                </button>
            </div>

            {/* Manual Refresh Button */}
            <button
              onClick={() => {
                  if (viewMode === 'sessions') {
                      fetchSessions();
                  } else {
                      setPage(0);
                      setHasMore(true);
                      fetchLogs(false);
                  }
              }}
              className="cursor-pointer p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-blue-600 transition-colors"
              title="Refresh Data"
            >
              <RefreshCw
                size={16}
                className={isLoading ? "animate-spin" : ""}
              />
            </button>
            
            {/* Export PDF (Monitor Only) */}
            {userRole === "monitor360" && viewMode === 'logs' && (
                <button
                    onClick={exportPDF}
                    disabled={isExporting}
                    className="cursor-pointer p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-red-600 transition-colors disabled:opacity-50"
                    title="Export to PDF"
                >
                    <FileDown size={16} className={isExporting ? "animate-bounce" : ""} />
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
                  className="cursor-pointer text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none bg-slate-50 text-slate-600 max-w-[120px]"
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
              className="cursor-pointer p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
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
          {/* --- SESSIONS VIEW --- */}
          {viewMode === 'sessions' && (
              <div className="p-2 space-y-2">
                  {/* Clear View Button if Session Active */}
                  {viewingSession && (
                      <div className="mb-2 p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-between">
                          <div className="flex items-center gap-2 text-blue-700">
                              <MapIcon size={16} />
                              <span className="text-xs font-bold">Currently Viewing Session on Map</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {/* Show/Hide Toggle */}
                            <button
                                onClick={() => setSessionVisible(!isSessionVisible)}
                                className="p-1.5 bg-white text-blue-600 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors"
                                title={isSessionVisible ? "Hide Path" : "Show Path"}
                            >
                                {isSessionVisible ? <Eye size={14} /> : <EyeOff size={14} />}
                            </button>
                            {/* Clear Button */}
                            <button 
                                onClick={() => setViewingSession(null)}
                                className="px-3 py-1.5 bg-white text-blue-600 text-xs font-bold rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors"
                            >
                                Clear Map
                            </button>
                          </div>
                      </div>
                  )}

                  {isLoading && sessions.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-2">
                          <RefreshCw size={24} className="animate-spin" />
                          <span className="text-xs">Loading sessions...</span>
                      </div>
                  ) : sessions.length === 0 ? (
                      <div className="text-center py-8 text-slate-400">
                          <Calendar size={32} className="mx-auto mb-2 opacity-20" />
                          <p className="text-xs">No recorded sessions found.</p>
                      </div>
                  ) : (
                      sessions.map((session, idx) => (
                          <div key={idx} className="bg-white border border-slate-100 rounded-xl p-3 hover:border-blue-200 transition-all shadow-sm hover:shadow-md group">
                              <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex flex-col items-center justify-center border border-indigo-100">
                                          <span className="text-[10px] font-bold uppercase">{new Date(session.date).toLocaleString('en-US', { month: 'short' })}</span>
                                          <span className="text-sm font-bold leading-none">{new Date(session.date).getDate()}</span>
                                      </div>
                                      <div>
                                          <h4 className="text-sm font-bold text-slate-800">
                                              {session.email ? session.email.split('@')[0] : 'User Session'}
                                          </h4>
                                          <div className="flex items-center gap-2 text-[10px] text-slate-500">
                                              <span>{new Date(session.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {new Date(session.endTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                              <span>•</span>
                                              <span>{session.count} points</span>
                                          </div>
                                      </div>
                                  </div>
                                  <button 
                                    onClick={() => handleLoadSession(session)}
                                    className="cursor-pointer p-2 rounded-full bg-slate-50 text-slate-400 group-hover:bg-blue-500 group-hover:text-white transition-colors"
                                    title="View on Map"
                                  >
                                      <Eye size={18} />
                                  </button>
                              </div>
                          </div>
                      ))
                  )}
                  {/* Loading Indicator for Infinite Scroll */}
              {isLoading && sessions.length > 0 && (
                  <div className="p-4 flex justify-center items-center text-slate-400 gap-2 text-xs">
                      <RefreshCw size={14} className="animate-spin" /> Loading more...
                  </div>
              )}
              
              {!hasMoreSessions && sessions.length > 0 && (
                  <div className="p-4 text-center text-[10px] text-slate-300 uppercase tracking-widest font-medium">
                      No more sessions
                  </div>
              )}
          </div>
          )}

          {/* --- LOGS VIEW (Original) --- */}
          {viewMode === 'logs' && (
            isLoading && logs.length === 0 ? (
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
                        onClick={() => setDeleteConfirmation(log.id)}
                        className="cursor-pointer p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors ml-1"
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
          ))}
        </div>
      </div>
      {/* Custom Delete Confirmation Modal */}
      {deleteConfirmation && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-700">
                {/* Header */}
                <div className="px-5 py-4 border-b border-slate-700/50 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                         <Trash2 size={16} className="text-red-500" />
                    </div>
                    <div>
                        <h3 className="text-white font-semibold text-sm">Delete Log Entry</h3>
                        <p className="text-slate-400 text-xs mt-0.5">This action cannot be undone.</p>
                    </div>
                </div>
                
                {/* Content */}
                <div className="px-5 py-4 text-slate-300 text-sm leading-relaxed">
                    Are you sure you want to delete this tracking history record permanently?
                </div>

                {/* Footer Actions */}
                <div className="px-5 py-4 bg-slate-900/50 flex items-center justify-end gap-3">
                    <button 
                        onClick={() => setDeleteConfirmation(null)}
                        className="cursor-pointer px-4 py-2 rounded-lg text-slate-400 text-xs font-medium hover:text-white hover:bg-slate-700 transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={() => deleteLog(deleteConfirmation)}
                        className="cursor-pointer px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-bold shadow-lg shadow-red-500/20 transition-all transform active:scale-95"
                    >
                        Yes, Delete it
                    </button>
                </div>
            </div>
        </div>
      )}
    </>
  );
};
