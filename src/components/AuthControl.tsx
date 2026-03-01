import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../lib/supabaseClient";
import { useSurveyStore } from "../store/useSurveyStore";
import { useMapStore } from "../store/useMapStore";
import { useOfflineStore } from "../store/useOfflineStore";
import { OfflineManager } from "./OfflineManager";
import { RegionDrawingOverlay } from "./RegionDrawingOverlay";
import {
  LogIn,
  LogOut,
  FolderOpen,
  Plus,
  Loader2,
  WifiOff,
  Trash2,
  Eye,
  EyeOff,
  Pencil,
  X,
  Check,
} from "lucide-react";

export const AuthControl = () => {
  const {
    user,
    setUser,
    savedSurveys,
    loadSavedSurveys,
    loadSurvey,
    // saveCurrentSurvey,
    createNewSurvey,
    createGroup,
    deleteSurvey,
    currentSurveyId,
    isSyncing,
    subscriptionStatus,
    userRole,
  } = useSurveyStore();

  const { interactionMode } = useMapStore();
  const { regions } = useOfflineStore();

  const [showMenu, setShowMenu] = useState(false);
  const [showOfflineManager, setShowOfflineManager] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadSavedSurveys();
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadSavedSurveys();
      }
    });

    return () => subscription.unsubscribe();
  }, [setUser, loadSavedSurveys]);

  const [isLoginView, setIsLoginView] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Upgrade Modal State
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Profile Edit State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState("");

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.updateUser({
        data: {
          full_name: editName,
        },
      });

      if (error) throw error;

      // Update local user state immediately
      if (data.user) {
        setUser(data.user);
        loadSavedSurveys(); // Reload surveys just in case
      }

      setIsEditingProfile(false);
      setMessage({ type: "success", text: "Profile updated successfully" });
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (isForgotPassword) {
        // Request password reset via email
        const subject = encodeURIComponent(
          "Reset Password Request for Landscape360",
        );
        const body = encodeURIComponent(
          `Dear Admin,\n\nI forgot my password and would like to request a password reset.\n\nMy Email: ${email.trim()}\n\nThank you.`,
        );
        window.location.href = `mailto:contact@jcdigital.co.id?subject=${subject}&body=${body}`;

        setMessage({
          type: "success",
          text: "Opening email client to send reset request...",
        });
      } else if (isLoginView) {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      } else {
        // Registration: Send request via email instead of direct signup
        const subject = encodeURIComponent("Request Account for Landscape360");
        const body = encodeURIComponent(
          `Dear Admin,\n\nI would like to request an account for the Landscape360 application.\n\nMy Email: ${email.trim()}\n\nThank you.`,
        );
        window.location.href = `mailto:contact@jcdigital.co.id?subject=${subject}&body=${body}`;

        setMessage({
          type: "success",
          text: "Opening email client to send request...",
        });
        // Optional: Switch back to login view or keep as is
      }
    } catch (err: any) {
      // Improve error message for common cases
      let errorMessage = err.message;

      // Handle Rate Limiting (Brute Force Protection)
      if (
        err.status === 429 ||
        err.message.toLowerCase().includes("too many requests")
      ) {
        errorMessage =
          "Too many attempts. Please wait a few minutes before trying again.";
      }
      // Handle Invalid Credentials
      else if (
        err.message.includes("Invalid login credentials") &&
        isLoginView
      ) {
        errorMessage =
          "Invalid credentials. Have you registered this account yet?";
      }

      setMessage({ type: "error", text: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setShowMenu(false);
    setShowLogoutConfirm(false);
  };

  // --- RENDER FOR GUEST (NOT LOGGED IN) ---
  if (!user) {
    return (
      <>
        <div className="relative w-full">
          <button
            onClick={() => setShowMenu(true)}
            className="cursor-pointer w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600/80 to-blue-500/80 hover:from-blue-600 hover:to-blue-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-lg shadow-blue-500/20 border border-blue-400/30 backdrop-blur-sm"
          >
            <LogIn size={14} />
            <span>Sign In / Register</span>
          </button>
        </div>

        {/* Full Screen Modal for Auth - Rendered via Portal */}
        {showMenu &&
          createPortal(
            <div className="fixed inset-0 z-[100] flex items-center justify-center md:p-4 bg-black/80 backdrop-blur-sm md:backdrop-blur-md animate-in fade-in duration-200">
              <div
                className="relative w-full h-full md:h-auto md:max-w-md bg-[#0a0a0a] border-0 md:border md:border-white/10 rounded-none md:rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col justify-center"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Glow Decor */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent"></div>

                {/* Background Effects */}
                <div className="absolute top-0 right-0 -mt-16 -mr-16 w-64 h-64 bg-blue-600/10 blur-[100px] rounded-full pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 -mb-16 -ml-16 w-64 h-64 bg-purple-600/10 blur-[100px] rounded-full pointer-events-none"></div>

                <div className="p-8 relative z-10 overflow-y-auto custom-scrollbar flex-1 flex flex-col justify-center">
                  {/* Header */}
                  <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">
                      {isForgotPassword
                        ? "Reset Password"
                        : isLoginView
                          ? "Welcome Back"
                          : "Request Account"}
                    </h2>
                    <p className="text-sm text-gray-400 font-mono tracking-wide">
                      {isForgotPassword
                        ? "REQUEST RESET VIA EMAIL"
                        : isLoginView
                          ? "AUTHENTICATION REQUIRED"
                          : "USER REGISTRATION"}
                    </p>
                  </div>

                  {/* Status Message */}
                  {message && (
                    <div
                      className={`p-3 rounded-lg text-xs font-medium mb-6 flex items-start gap-2 ${message.type === "success" ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}
                    >
                      <span>{message.type === "success" ? "✓" : "⚠️"}</span>
                      {message.text}
                    </div>
                  )}

                  {/* Form */}
                  <form onSubmit={handleEmailAuth} className="space-y-5">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider ml-1">
                        Email Address
                      </label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500 group-focus-within:text-blue-400 transition-colors">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                            <polyline points="22,6 12,13 2,6"></polyline>
                          </svg>
                        </div>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-gray-600 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 focus:bg-black/40 transition-all outline-none"
                          required
                          pattern="[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$"
                          title="Please enter a valid email address"
                          placeholder={isLoginView ? "name@company.com" : ""}
                        />
                      </div>
                    </div>

                    {!isForgotPassword && isLoginView && (
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider ml-1">
                          Password
                        </label>
                        <div className="relative group">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500 group-focus-within:text-blue-400 transition-colors">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <rect
                                x="3"
                                y="11"
                                width="18"
                                height="11"
                                rx="2"
                                ry="2"
                              ></rect>
                              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                            </svg>
                          </div>
                          <input
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-3 pl-10 pr-12 text-sm text-white placeholder-gray-600 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 focus:bg-black/40 transition-all outline-none"
                            required
                            minLength={8}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-500 hover:text-blue-400 transition-colors cursor-pointer"
                          >
                            {showPassword ? (
                              <EyeOff size={16} />
                            ) : (
                              <Eye size={16} />
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loading}
                      className="cursor-pointer w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl text-sm font-bold shadow-lg shadow-blue-600/20 transition-all transform active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <>
                          {isForgotPassword
                            ? "Request Reset"
                            : isLoginView
                              ? "Sign In"
                              : "Request Account"}
                          {!loading && !isForgotPassword && (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <line x1="5" y1="12" x2="19" y2="12"></line>
                              <polyline points="12 5 19 12 12 19"></polyline>
                            </svg>
                          )}
                        </>
                      )}
                    </button>
                  </form>

                  {/* Footer Links */}
                  <div className="mt-8 pt-6 border-t border-white/5 flex flex-col items-center gap-4 text-sm">
                    {!isForgotPassword && (
                      <div className="text-gray-400">
                        {isLoginView
                          ? "Don't have an account?"
                          : "Already have an account? "}{" "}
                        <button
                          onClick={() => {
                            setIsLoginView(!isLoginView);
                            setMessage(null);
                          }}
                          className="cursor-pointer text-blue-400 hover:text-blue-300 font-semibold transition-colors"
                        >
                          {isLoginView ? "Request Account" : "Sign In"}
                        </button>
                      </div>
                    )}

                    <button
                      onClick={() => {
                        setIsForgotPassword(!isForgotPassword);
                        setMessage(null);
                      }}
                      className="cursor-pointer text-xs text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      {isForgotPassword
                        ? "Back to Login"
                        : "Forgot Password? (Request via Email)"}
                    </button>
                  </div>
                </div>

                {/* Close Button - Moved to bottom for better stacking */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                  }}
                  className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors z-[60] p-2 hover:bg-white/10 rounded-full cursor-pointer"
                  title="Close Modal"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
            </div>,
            document.body,
          )}
      </>
    );
  }

  // --- RENDER FOR LOGGED IN USER ---
  // Cast user to any to avoid strict type checking issues with user_metadata in this context
  const currentUser = user as any;

  // Calculate Limits
  const mapUsage = regions.filter((r) => r.userId === user?.id).length;
  const surveyUsage = savedSurveys.length;

  const limits = {
    Free: { maps: 1, surveys: 2 },
    Pro: { maps: 3, surveys: 4 },
    Enterprise: { maps: 10, surveys: 10 },
  };

  const currentLimits =
    limits[subscriptionStatus as keyof typeof limits] || limits["Free"];

  return (
    <div className="relative w-full">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="cursor-pointer w-full flex items-center justify-center gap-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-200 px-3 py-1.5 rounded-lg text-[10px] font-medium transition-colors border border-blue-500/30"
      >
        {currentUser.user_metadata?.avatar_url ? (
          <img
            src={currentUser.user_metadata.avatar_url}
            className="w-4 h-4 rounded-full"
            alt="Avatar"
          />
        ) : (
          <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center text-[8px]">
            {currentUser.email?.charAt(0).toUpperCase()}
          </div>
        )}
        <span className="max-w-[80px] truncate">
          {currentUser.user_metadata?.full_name ||
            currentUser.user_metadata?.name ||
            currentUser.email}
        </span>
        {isSyncing && (
          <Loader2 size={12} className="animate-spin text-blue-400" />
        )}
      </button>

      {/* Full Screen Modal for User Menu - Rendered via Portal */}
      {showMenu &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center md:p-4 bg-black/80 backdrop-blur-sm md:backdrop-blur-md animate-in fade-in duration-200">
            <div
              className="relative w-full h-full md:h-auto md:max-w-sm bg-[#0a0a0a] border-0 md:border md:border-white/10 rounded-none md:rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-white/5 bg-white/[0.02]">
                <h2 className="text-sm font-bold text-white tracking-wide uppercase flex items-center gap-2">
                  <div className="w-1 h-4 bg-blue-500 rounded-full"></div>
                  User Account
                </h2>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                  }}
                  className="cursor-pointer text-gray-400 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-lg cursor-pointer"
                  title="Close Menu"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6">
                {isEditingProfile ? (
                  <form
                    onSubmit={handleSaveProfile}
                    className="mb-6 space-y-3 bg-white/5 p-4 rounded-xl border border-white/10"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-bold text-white">
                        Edit Name
                      </h3>
                      <button
                        type="button"
                        onClick={() => setIsEditingProfile(false)}
                        className="cursor-pointer text-gray-400 hover:text-white"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex-1 space-y-2">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="Display Name"
                          className="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:border-blue-500 outline-none"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="cursor-pointer w-full bg-blue-600 hover:bg-blue-500 text-white py-1.5 rounded text-xs font-bold transition-colors flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <>
                          <Check size={12} /> Save Changes
                        </>
                      )}
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center gap-4 mb-6 relative group">
                    {currentUser.user_metadata?.avatar_url ? (
                      <img
                        src={currentUser.user_metadata.avatar_url}
                        className="w-16 h-16 rounded-full border-2 border-blue-500 object-cover"
                        alt="Avatar"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-2xl font-bold text-white shadow-lg shadow-blue-500/30">
                        {currentUser.email?.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-lg text-white">
                          {currentUser.user_metadata?.full_name ||
                            currentUser.user_metadata?.name ||
                            "User L360"}
                        </h3>
                        <button
                          onClick={() => {
                            setEditName(
                              currentUser.user_metadata?.full_name ||
                                currentUser.user_metadata?.name ||
                                "",
                            );
                            setIsEditingProfile(true);
                          }}
                          className="cursor-pointer p-1.5 text-gray-500 hover:text-white bg-transparent hover:bg-white/10 rounded-lg transition-colors"
                          title="Edit Name"
                        >
                          <Pencil size={14} />
                        </button>
                      </div>
                      <p className="text-xs text-gray-400">
                        {currentUser.email}
                      </p>

                      {/* Status & Limits */}
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <div
                            className={`text-[10px] px-2 py-0.5 rounded-full border ${
                              subscriptionStatus === "Enterprise"
                                ? "bg-purple-500/20 text-purple-300 border-purple-500/20"
                                : subscriptionStatus === "Pro"
                                  ? "bg-blue-500/20 text-blue-300 border-blue-500/20"
                                  : "bg-gray-500/20 text-gray-300 border-gray-500/20"
                            }`}
                          >
                            {subscriptionStatus} Plan
                          </div>
                          <div className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/20">
                            Status:{" "}
                            {userRole === "monitor360" ? "Monitor" : "Active"}
                          </div>
                          <button
                            onClick={() => setShowUpgradeModal(true)}
                            className="cursor-pointer text-[10px] text-blue-400 hover:text-blue-300 hover:underline"
                          >
                            Upgrade
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-white/5 rounded-lg p-2 border border-white/5">
                            <div className="text-[9px] text-gray-500 uppercase font-bold mb-1">
                              Offline Maps
                            </div>
                            <div className="flex items-end justify-between">
                              <span
                                className={`text-xs font-bold ${mapUsage >= currentLimits.maps ? "text-red-400" : "text-white"}`}
                              >
                                {mapUsage}{" "}
                                <span className="text-gray-500 font-normal">
                                  / {currentLimits.maps}
                                </span>
                              </span>
                              <div className="w-12 h-1 bg-gray-700 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${mapUsage >= currentLimits.maps ? "bg-red-500" : "bg-blue-500"}`}
                                  style={{
                                    width: `${Math.min(100, (mapUsage / currentLimits.maps) * 100)}%`,
                                  }}
                                ></div>
                              </div>
                            </div>
                          </div>
                          <div className="bg-white/5 rounded-lg p-2 border border-white/5">
                            <div className="text-[9px] text-gray-500 uppercase font-bold mb-1">
                              Surveys / Markers
                            </div>
                            <div className="flex items-end justify-between">
                              <span
                                className={`text-xs font-bold ${surveyUsage >= currentLimits.surveys ? "text-red-400" : "text-white"}`}
                              >
                                {surveyUsage}{" "}
                                <span className="text-gray-500 font-normal">
                                  / {currentLimits.surveys}
                                </span>
                              </span>
                              <div className="w-12 h-1 bg-gray-700 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${surveyUsage >= currentLimits.surveys ? "bg-red-500" : "bg-purple-500"}`}
                                  style={{
                                    width: `${Math.min(100, (surveyUsage / currentLimits.surveys) * 100)}%`,
                                  }}
                                ></div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Quick Actions Grid */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <button
                    onClick={() => {
                      createNewSurvey(); // Reset state for fresh survey
                      createGroup(); // Start Navigator Mode (new survey group)
                      setShowMenu(false);
                    }}
                    className="cursor-pointer flex flex-col items-center gap-2 p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 transition-all group"
                  >
                    <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                      <Plus size={20} />
                    </div>
                    <span className="text-xs font-medium text-gray-300">
                      New Survey
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      setShowOfflineManager(true);
                      setShowMenu(false);
                    }}
                    className="cursor-pointer flex flex-col items-center gap-2 p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 transition-all group"
                  >
                    <div className="p-2 bg-green-500/10 rounded-lg text-green-400 group-hover:bg-green-500 group-hover:text-white transition-colors">
                      <WifiOff size={20} />
                    </div>
                    <span className="text-xs font-medium text-gray-300">
                      Offline Map
                    </span>
                  </button>
                </div>

                {/* Survey / Marker Lists */}
                <div className="space-y-1 mb-3">
                  <div className="p-3">
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <FolderOpen size={12} />
                      Survey / Marker Lists
                    </div>
                    <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                      {isSyncing && savedSurveys.length === 0 ? (
                        <div className="flex items-center gap-2 py-2">
                          <Loader2
                            size={12}
                            className="animate-spin text-blue-400"
                          />
                          <span className="text-[10px] text-gray-500">
                            Loading surveys...
                          </span>
                        </div>
                      ) : savedSurveys.length === 0 ? (
                        <div className="text-[10px] text-gray-600 italic">
                          No saved surveys found
                        </div>
                      ) : (
                        savedSurveys.map((survey) => (
                          <div
                            key={survey.id}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs group transition-colors ${currentSurveyId === survey.id ? "bg-blue-600/20 text-blue-300 border border-blue-500/20" : "hover:bg-white/5 text-gray-400 hover:text-gray-200"}`}
                          >
                            <button
                              onClick={() => {
                                loadSurvey(survey.id);
                                setShowMenu(false);
                              }}
                              className="cursor-pointer flex-1 text-left truncate mr-2"
                            >
                              <span className="block truncate">
                                {survey.name}
                              </span>
                              <span className="text-[9px] opacity-50 block">
                                {new Date(
                                  survey.updated_at,
                                ).toLocaleDateString()}
                              </span>
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirmId(survey.id);
                              }}
                              className="cursor-pointer p-2 md:p-1.5 hover:bg-red-500/20 text-gray-500 hover:text-red-400 rounded transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100 flex-shrink-0"
                              title="Delete Survey"
                            >
                              <Trash2 size={14} className="md:w-3 md:h-3" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Logout Button */}
                <button
                  onClick={() => setShowLogoutConfirm(true)}
                  className="cursor-pointer w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 transition-all font-medium text-sm"
                >
                  <LogOut size={16} /> Sign Out
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {showOfflineManager &&
        createPortal(
          <OfflineManager
            onClose={() => setShowOfflineManager(false)}
            onBack={() => {
              setShowOfflineManager(false);
              setShowMenu(true);
            }}
          />,
          document.body,
        )}

      {interactionMode === "draw_region" &&
        createPortal(<RegionDrawingOverlay />, document.body)}

      {showUpgradeModal &&
        createPortal(
          <div className="fixed inset-0 z-[110] flex items-center justify-center md:p-4 bg-black/80 backdrop-blur-sm md:backdrop-blur-md animate-in fade-in duration-300">
            <div
              className="relative w-full h-full md:h-auto md:max-w-2xl bg-[#0a0a0a] border-0 md:border md:border-white/10 rounded-none md:rounded-2xl shadow-[0_0_50px_rgba(59,130,246,0.15)] overflow-hidden flex flex-col md:max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-white/5 bg-white/[0.02]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center text-blue-400">
                    <Check size={20} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white tracking-tight">
                      Upgrade Plan
                    </h2>
                    <div className="text-xs text-gray-400">
                      Unlock more features and limits
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowUpgradeModal(false)}
                  className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-full cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                <div className="grid md:grid-cols-3 gap-4">
                  {/* Free Plan */}
                  <div
                    className={`p-4 rounded-xl border ${subscriptionStatus === "Free" ? "bg-white/5 border-blue-500/50" : "bg-transparent border-white/10"} relative flex flex-col`}
                  >
                    {subscriptionStatus === "Free" && (
                      <div className="absolute top-2 right-2 text-[10px] bg-blue-500 text-white px-2 py-0.5 rounded-full font-bold">
                        CURRENT
                      </div>
                    )}
                    <div className="mb-4">
                      <span className="text-xs font-bold px-2 py-1 bg-gray-800 text-gray-300 rounded uppercase tracking-wider">
                        Starter
                      </span>
                    </div>
                    <h3 className="font-bold text-white mb-1">Free</h3>
                    <p className="text-sm text-gray-400 mb-6">
                      Basic exploration tools
                    </p>

                    <ul className="space-y-2 text-xs text-gray-400 mb-6 flex-1">
                      <li className="flex gap-2">
                        <span>✓</span> 1 MB Max Download
                      </li>
                      <li className="flex gap-2">
                        <span>✓</span> 1 Offline Maps
                      </li>
                      <li className="flex gap-2">
                        <span>✓</span> 2 Saved Surveys
                      </li>
                      <li className="flex gap-2 text-gray-600 line-through decoration-gray-700">
                        <span className="opacity-50">×</span> No GPS Tracking
                      </li>
                    </ul>

                    {subscriptionStatus !== "Free" && (
                      <a
                        href="mailto:contact@jcdigital.co.id?subject=Account Request: Landscape360 Starter Plan&body=Dear Admin,%0D%0A%0D%0AI hope this message finds you well.%0D%0A%0D%0AI would like to request the creation of a Starter (Free) account for the Landscape360 platform.%0D%0A%0D%0APlease let me know if any further information is required from my side.%0D%0A%0D%0AThank you,%0D%0A[Your Name]"
                        className="block w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-center rounded-lg text-xs font-bold transition-colors"
                      >
                        Request Account
                      </a>
                    )}
                  </div>

                  {/* Pro Plan */}
                  <div
                    className={`p-4 rounded-xl border ${subscriptionStatus === "Pro" ? "bg-blue-500/10 border-blue-500" : "bg-transparent border-white/10 hover:border-blue-500/50"} relative transition-colors flex flex-col`}
                  >
                    {subscriptionStatus === "Pro" && (
                      <div className="absolute top-2 right-2 text-[10px] bg-blue-500 text-white px-2 py-0.5 rounded-full font-bold">
                        CURRENT
                      </div>
                    )}
                    <div className="mb-4">
                      <span className="text-xs font-bold px-2 py-1 bg-blue-500/20 text-blue-400 rounded uppercase tracking-wider border border-blue-500/20">
                        Recommended
                      </span>
                    </div>
                    <div className="flex items-end gap-2 mb-1">
                      <span className="text-xs text-gray-500 line-through decoration-red-500/50 decoration-1">
                        Rp 85.000
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-1">
                      Rp 55.000
                      <span className="text-xs font-normal text-gray-500">
                        /bln
                      </span>
                    </h3>
                    <p className="text-xs text-gray-400 mb-6">
                      For field professionals
                    </p>

                    <ul className="space-y-2 text-xs text-gray-300 mb-6 flex-1">
                      <li className="flex gap-2">
                        <span>✓</span> 10 MB Max Download
                      </li>
                      <li className="flex gap-2">
                        <span>✓</span> 3 Offline Maps
                      </li>
                      <li className="flex gap-2">
                        <span>✓</span> 4 Saved Surveys
                      </li>
                      <li className="flex gap-2">
                        <span>✓</span> High-Res Export
                      </li>
                      <li className="flex gap-2 font-bold text-white">
                        <span className="text-green-400">✓</span> GPS Broadcast
                      </li>
                    </ul>

                    {subscriptionStatus !== "Pro" && (
                      <a
                        href="mailto:contact@jcdigital.co.id?subject=Subscription Upgrade: Landscape360 Pro Plan&body=Dear Admin,%0D%0A%0D%0AI hope this message finds you well.%0D%0A%0D%0AI am writing to request an upgrade of my account to the Landscape360 Pro Plan. I am interested in utilizing the advanced field tools and GPS broadcasting features.%0D%0A%0D%0APlease guide me through the payment and activation process.%0D%0A%0D%0AThank you,%0D%0A[Your Name]"
                        className="block w-full py-2 bg-blue-600 hover:bg-blue-500 text-white text-center rounded-lg text-xs font-bold transition-colors"
                      >
                        Upgrade to Pro
                      </a>
                    )}
                  </div>

                  {/* Enterprise Plan */}
                  <div
                    className={`p-4 rounded-xl border ${subscriptionStatus === "Enterprise" ? "bg-purple-500/10 border-purple-500" : "bg-transparent border-white/10 hover:border-purple-500/50"} relative transition-colors flex flex-col`}
                  >
                    {subscriptionStatus === "Enterprise" && (
                      <div className="absolute top-2 right-2 text-[10px] bg-purple-500 text-white px-2 py-0.5 rounded-full font-bold">
                        CURRENT
                      </div>
                    )}
                    <div className="mb-4">
                      <span className="text-xs font-bold px-2 py-1 bg-cyan-900/30 text-cyan-400 rounded uppercase tracking-wider border border-cyan-500/20">
                        Enterprise
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-6">
                      Available Upon Request
                    </h3>

                    <ul className="space-y-2 text-xs text-gray-300 mb-6 flex-1">
                      <li className="flex gap-2">
                        <span>✓</span> 25 MB Max Download
                      </li>
                      <li className="flex gap-2">
                        <span>✓</span> 10 Offline Maps
                      </li>
                      <li className="flex gap-2">
                        <span>✓</span> 10 Saved Surveys
                      </li>
                      <li className="flex gap-2 font-bold text-white">
                        <span className="text-green-400">✓</span> Realtime
                        Monitoring
                      </li>
                      <li className="flex gap-2">
                        <span>✓</span> 24/7 Priority Support
                      </li>
                    </ul>

                    {subscriptionStatus !== "Enterprise" && (
                      <a
                        href="mailto:contact@jcdigital.co.id?subject=Subscription Upgrade: Landscape360 Enterprise Plan&body=Dear Admin,%0D%0A%0D%0AI hope this message finds you well.%0D%0A%0D%0AWe are interested in upgrading our organization's access to the Landscape360 Enterprise Plan to leverage the Realtime Monitoring and dedicated support features.%0D%0A%0D%0APlease contact us to arrange the upgrade and discuss any specific requirements.%0D%0A%0D%0ABest regards,%0D%0A[Your Name/Organization]"
                        className="block w-full py-2 bg-purple-600 hover:bg-purple-500 text-white text-center rounded-lg text-xs font-bold transition-colors"
                      >
                        Upgrade to Enterprise
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId &&
        createPortal(
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm md:backdrop-blur-md animate-in fade-in duration-300">
            <div
              className="relative w-full max-w-xs bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-[0_0_50px_rgba(239,68,68,0.15)] overflow-hidden p-6 animate-in zoom-in-95 duration-300"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Red Glow Decor */}
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-red-500/50 to-transparent"></div>

              <div className="flex flex-col items-center text-center gap-5">
                <div className="relative">
                  <div className="absolute inset-0 bg-red-500/20 blur-xl rounded-full"></div>
                  <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500/20 to-red-600/10 border border-red-500/30 flex items-center justify-center text-red-500 shadow-inner">
                    <Trash2 size={28} strokeWidth={1.5} />
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-white tracking-tight">
                    Delete Survey?
                  </h3>
                  <p className="text-xs text-gray-400 leading-relaxed px-2">
                    This action cannot be undone. All survey data will be
                    permanently deleted from your device and cloud.
                  </p>
                </div>

                <div className="flex flex-col gap-2 w-full mt-2">
                  <button
                    onClick={() => {
                      if (deleteConfirmId) {
                        deleteSurvey(deleteConfirmId);
                        setDeleteConfirmId(null);
                      }
                    }}
                    className="cursor-pointer w-full py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-red-600/30 transition-all active:scale-[0.98] border border-red-400/20"
                  >
                    Delete Permanently
                  </button>
                  <button
                    onClick={() => setDeleteConfirmId(null)}
                    className="cursor-pointer w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-gray-400 hover:text-white transition-all active:scale-[0.98]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
      {/* Logout Confirmation Modal */}
      {showLogoutConfirm &&
        createPortal(
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm md:backdrop-blur-md animate-in fade-in duration-300">
            <div
              className="relative w-full max-w-xs bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-[0_0_50px_rgba(239,68,68,0.15)] overflow-hidden p-6 animate-in zoom-in-95 duration-300"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Red Glow Decor */}
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-red-500/50 to-transparent"></div>

              <div className="flex flex-col items-center text-center gap-5">
                <div className="relative">
                  <div className="absolute inset-0 bg-red-500/20 blur-xl rounded-full"></div>
                  <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500/20 to-red-600/10 border border-red-500/30 flex items-center justify-center text-red-500 shadow-inner">
                    <LogOut size={28} strokeWidth={1.5} />
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-white tracking-tight">
                    Sign Out?
                  </h3>
                  <p className="text-xs text-gray-400 leading-relaxed px-2">
                    Are you sure you want to sign out? You will need to log in
                    again to access your saved data.
                  </p>
                </div>

                <div className="flex flex-col gap-2 w-full mt-2">
                  <button
                    onClick={handleLogout}
                    className="cursor-pointer w-full py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-red-600/30 transition-all active:scale-[0.98] border border-red-400/20"
                  >
                    Yes, Sign Out
                  </button>
                  <button
                    onClick={() => setShowLogoutConfirm(false)}
                    className="cursor-pointer w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-gray-400 hover:text-white transition-all active:scale-[0.98]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};
