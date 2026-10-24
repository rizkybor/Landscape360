import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../lib/supabaseClient";
import { LOGO_AVATAR_EMAILS } from "../config";
import landscapeLogo from "../assets/LandscapeLogo.svg";
import { useSurveyStore } from "../store/useSurveyStore";
import { useMapStore } from "../store/useMapStore";
import { useShallow } from "zustand/react/shallow";
import { useOfflineStore } from "../store/useOfflineStore";
import { OfflineManager } from "./OfflineManager";
import { RegionDrawingOverlay } from "./RegionDrawingOverlay";
import { UserManagementPanel } from "./UserManagementPanel";
import { AccountRequestsPanel } from "./AccountRequestsPanel";
import { PoiManagerPanel } from "./PoiManagerPanel";
import { useSosAlertsStore } from "../store/useSosAlertsStore";
import { SosScreen } from "./SosScreen";
import { AdminActivityFeed } from "./AdminActivityFeed";
import { ChangePasswordForm } from "./ChangePasswordForm";
import { PLANS, type Plan } from "../lib/adminUsers";
import { submitAccountRequest } from "../lib/accountRequests";
import { SEEN_AT_KEY, useAccountRequestAlerts } from "../services/useAccountRequestAlerts";
import { recordLogin, recordLogout } from "../lib/loginHistory";
import {
  accountDisplayName,
  fetchMyContact,
  isValidPhone,
  updateMyContact,
  type ProfileContact,
} from "../lib/profileContact";
import {
  STORAGE_CATEGORY_LABELS,
  fetchMyStorageUsage,
  formatBytes,
  usageBarClass,
  usagePercent,
  type MyStorageUsage,
} from "../lib/storageUsage";
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
  KeyRound,
  MapPin,
  Siren,
  Building2,
  Phone,
  X,
  Check,
  Users,
  Inbox,
} from "lucide-react";

// Set to true to show the Upgrade button (opens the Upgrade Plan modal) again
const SHOW_UPGRADE_BUTTON = false;

// One row of the account menu's usage list: "label  value / limit" over a progress bar
const UsageMeter = ({
  label,
  value,
  limit,
  percent,
  barClass,
  warn,
  title,
}: {
  label: string;
  value: string;
  limit: string;
  percent: number;
  barClass: string;
  warn: boolean;
  title?: string;
}) => (
  <div className="bg-white rounded-xl p-3 border border-sand-100" title={title}>
    <div className="flex items-baseline justify-between gap-2 mb-1.5">
      <span className="text-[10px] text-sand-500 uppercase font-bold tracking-wide">{label}</span>
      <span className={`text-xs font-bold ${warn ? "text-brick-600" : "text-ink"}`}>
        {value} <span className="text-sand-500 font-normal">/ {limit}</span>
      </span>
    </div>
    <div className="h-1.5 bg-sand-200 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${barClass}`} style={{ width: `${percent}%` }} />
    </div>
  </div>
);

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
    isAdmin,
  } = useSurveyStore();

  const { interactionMode } = useMapStore(
    useShallow((s) => ({ interactionMode: s.interactionMode })),
  );
  const { regions } = useOfflineStore();
  const activeSosCount = useSosAlertsStore((s) => s.active.length);
  const openSosAlerts = useSosAlertsStore((s) => s.openPanel);

  const [showMenu, setShowMenu] = useState(false);
  const [showOfflineManager, setShowOfflineManager] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showUserManagement, setShowUserManagement] = useState(false);
  const [showAccountRequests, setShowAccountRequests] = useState(false);
  const [showPoiManager, setShowPoiManager] = useState(false);

  // Cloud storage used by this account, refreshed whenever the menu opens
  const [storageUsage, setStorageUsage] = useState<MyStorageUsage | null>(null);
  useEffect(() => {
    if (!user || !showMenu) return;
    fetchMyStorageUsage()
      .then(setStorageUsage)
      .catch(() => setStorageUsage(null)); // storage migration not run yet
  }, [user, showMenu]);

  // Organization and phone from the account (null until the profile contact migration)
  const [contact, setContact] = useState<ProfileContact | null>(null);
  useEffect(() => {
    if (!user || !showMenu) return;
    let active = true;
    fetchMyContact(user.id).then((result) => active && setContact(result));
    return () => {
      active = false;
    };
  }, [user, showMenu]);

  // Admin: notification for account requests that arrived since Account Requests was last opened
  const requestsSeenAt =
    (user?.user_metadata?.[SEEN_AT_KEY] as string | undefined) ?? null;
  const { newCount: newRequestCount, markSeen: markRequestsSeen } = useAccountRequestAlerts(
    !!user && isAdmin,
    requestsSeenAt,
  );

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
  const [requestForm, setRequestForm] = useState({
    fullName: "",
    organization: "",
    phone: "",
    requestedPlan: "Free" as Plan,
    message: "",
    website: "", // honeypot
  });
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Upgrade Modal State
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Profile Edit State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState("");
  const [editOrganization, setEditOrganization] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showSos, setShowSos] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidPhone(editPhone)) {
      setProfileError("Phone / WhatsApp number must have 8 to 15 digits");
      return;
    }
    setProfileError(null);
    setLoading(true);
    try {
      // display_name is the one name field (full_name kept in step for older code)
      const name = editName.trim();
      const { data, error } = await supabase.auth.updateUser({
        data: { display_name: name, full_name: name },
      });

      if (error) throw error;

      if (contact) {
        const next = { organization: editOrganization.trim() || null, phone: editPhone.trim() || null };
        await updateMyContact(next);
        setContact(next);
      }

      // Update local user state immediately
      if (data.user) {
        setUser(data.user);
        loadSavedSurveys(); // Reload surveys just in case
      }

      setIsEditingProfile(false);
      setMessage({ type: "success", text: "Profile updated successfully" });
    } catch (err: any) {
      setProfileError(err.message);
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
        recordLogin();
      } else {
        // Registration: the request is stored for the admin to approve or reject
        // Phone is optional; when given it must have 8 to 15 digits
        if (!isValidPhone(requestForm.phone)) {
          throw new Error("Phone / WhatsApp number must have 8 to 15 digits");
        }
        await submitAccountRequest({
          email: email.trim(),
          fullName: requestForm.fullName.trim(),
          organization: requestForm.organization.trim(),
          phone: requestForm.phone.trim(),
          requestedPlan: "Free",
          message: requestForm.message.trim(),
          website: requestForm.website,
        });
        setRequestForm({
          fullName: "",
          organization: "",
          phone: "",
          requestedPlan: "Free",
          message: "",
          website: "",
        });
        setMessage({
          type: "success",
          text: "Request sent. The admin will review it and email your login details.",
        });
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
    await recordLogout();
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
            className="cursor-pointer w-full flex items-center justify-center gap-2 bg-forest-800 hover:bg-forest-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-lg border border-forest-200 backdrop-blur-sm"
          >
            <LogIn size={14} />
            <span>Sign In / Register</span>
          </button>
        </div>

        {/* Full Screen Modal for Auth - Rendered via Portal */}
        {showMenu &&
          createPortal(
            <div className="fixed inset-0 z-[100] flex items-center justify-center md:p-4 bg-ink/40 backdrop-blur-sm md:backdrop-blur-md animate-in fade-in duration-200">
              <div
                className="relative w-full h-full md:h-auto md:max-h-[92vh] md:max-w-md bg-white border-0 md:border md:border-sand-200 rounded-none md:rounded-2xl overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Glow Decor */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-1 bg-gradient-to-r from-transparent via-forest-700 to-transparent"></div>

                {/* Background Effects */}
                {/* Large blurs are costly to paint on phones: desktop only */}
                <div className="hidden md:block absolute top-0 right-0 -mt-16 -mr-16 w-64 h-64 bg-forest-50 blur-[100px] rounded-full pointer-events-none"></div>
                <div className="hidden md:block absolute bottom-0 left-0 -mb-16 -ml-16 w-64 h-64 bg-gold-50 blur-[100px] rounded-full pointer-events-none"></div>

                {/* The form sits in the middle when it fits and scrolls from the top when
                    it is taller than the screen (Request Account on a phone) */}
                <div className="relative z-10 overflow-y-auto custom-scrollbar flex-1 flex flex-col px-5 pt-[calc(3.5rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:p-8">
                  <div className="my-auto w-full max-w-sm mx-auto">
                  {/* Header */}
                  <div className="text-center mb-6 md:mb-8">
                    <img
                      src={landscapeLogo}
                      alt="Landscape 360"
                      className="w-14 h-14 md:w-16 md:h-16 mx-auto mb-3 object-contain"
                    />
                    <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-forest-700 mb-3">
                      Landscape 360
                    </div>
                    <h2 className="text-xl md:text-2xl font-bold text-ink mb-1.5 md:mb-2 tracking-tight">
                      {isForgotPassword
                        ? "Reset Password"
                        : isLoginView
                          ? "Welcome Back"
                          : "Request Account"}
                    </h2>
                    <p className="text-[11px] md:text-sm text-sand-600 font-mono tracking-wide">
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
                      className={`p-3 rounded-lg text-xs font-medium mb-6 flex items-start gap-2 ${message.type === "success" ? "bg-forest-50 text-forest-700 border border-forest-200" : "bg-brick-50 text-brick-600 border border-brick-200"}`}
                    >
                      <span>{message.type === "success" ? "✓" : "⚠️"}</span>
                      {message.text}
                    </div>
                  )}

                  {/* Form */}
                  <form onSubmit={handleEmailAuth} className="space-y-4 md:space-y-5">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-sand-500 tracking-wider ml-1">
                        Email Address
                        {!isForgotPassword && !isLoginView && (
                          <span className="text-brick-600"> *</span>
                        )}
                      </label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-sand-500 group-focus-within:text-forest-700 transition-colors">
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
                          className="w-full bg-sand-50 border border-sand-200 rounded-xl py-3 pl-10 pr-4 text-base sm:text-sm text-ink placeholder-sand-400 focus:border-forest-300 focus:ring-1 focus:ring-forest-300 focus:bg-white/90 transition-all outline-none"
                          required
                          pattern="[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$"
                          title="Please enter a valid email address"
                          placeholder={isLoginView ? "name@company.com" : ""}
                        />
                      </div>
                    </div>

                    {!isForgotPassword && !isLoginView && (
                      <>
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-bold text-sand-500 tracking-wider ml-1">
                            Full Name <span className="text-brick-600">*</span>
                          </label>
                          <input
                            type="text"
                            value={requestForm.fullName}
                            onChange={(e) => setRequestForm({ ...requestForm, fullName: e.target.value })}
                            className="w-full bg-sand-50 border border-sand-200 rounded-xl py-3 px-4 text-base sm:text-sm text-ink placeholder-sand-400 focus:border-forest-300 focus:ring-1 focus:ring-forest-300 focus:bg-white/90 transition-all outline-none"
                            required
                            maxLength={120}
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-sand-500 tracking-wider ml-1">
                              Organization <span className="font-normal normal-case tracking-normal text-sand-400">(optional)</span>
                            </label>
                            <input
                              type="text"
                              value={requestForm.organization}
                              onChange={(e) => setRequestForm({ ...requestForm, organization: e.target.value })}
                              className="w-full bg-sand-50 border border-sand-200 rounded-xl py-3 px-4 text-base sm:text-sm text-ink placeholder-sand-400 focus:border-forest-300 focus:ring-1 focus:ring-forest-300 focus:bg-white/90 transition-all outline-none"
                              maxLength={120}
                              placeholder="Company, club or university"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-sand-500 tracking-wider ml-1">
                              Phone / WhatsApp <span className="font-normal normal-case tracking-normal text-sand-400">(optional)</span>
                            </label>
                            <input
                              type="tel"
                              value={requestForm.phone}
                              onChange={(e) => setRequestForm({ ...requestForm, phone: e.target.value })}
                              className="w-full bg-sand-50 border border-sand-200 rounded-xl py-3 px-4 text-base sm:text-sm text-ink placeholder-sand-400 focus:border-forest-300 focus:ring-1 focus:ring-forest-300 focus:bg-white/90 transition-all outline-none"
                              maxLength={20}
                              pattern="\+?[0-9][0-9\s\-]{6,18}[0-9]"
                              title="Phone number with 8 to 15 digits, e.g. +62 812 3456 7890"
                              placeholder="+62 812..."
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-bold text-sand-500 tracking-wider ml-1">
                            Plan <span className="text-brick-600">*</span>
                          </label>
                          <select
                            value={requestForm.requestedPlan}
                            onChange={(e) => setRequestForm({ ...requestForm, requestedPlan: e.target.value as Plan })}
                            className="cursor-pointer w-full bg-sand-50 border border-sand-200 rounded-xl py-3 px-4 text-base sm:text-sm text-ink focus:border-forest-300 focus:ring-1 focus:ring-forest-300 transition-all outline-none"
                          >
                            {PLANS.map((p) => (
                              <option key={p} value={p} disabled={p !== "Free"} className="bg-white">
                                {p === "Free" ? p : `${p} (upgrade after sign-up)`}
                              </option>
                            ))}
                          </select>
                          <p className="text-[10px] text-sand-500 ml-1">
                            New accounts start on Free. Pro and Enterprise are available as an
                            upgrade once your account is active.
                          </p>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-bold text-sand-500 tracking-wider ml-1">
                            Message <span className="text-brick-600">*</span>
                          </label>
                          <textarea
                            value={requestForm.message}
                            onChange={(e) => setRequestForm({ ...requestForm, message: e.target.value })}
                            className="w-full bg-sand-50 border border-sand-200 rounded-xl py-3 px-4 text-base sm:text-sm text-ink placeholder-sand-400 focus:border-forest-300 focus:ring-1 focus:ring-forest-300 focus:bg-white/90 transition-all outline-none resize-none"
                            rows={3}
                            required
                            maxLength={1000}
                            placeholder="What will you use Landscape360 for?"
                          />
                        </div>

                        {/* Honeypot: hidden from people, filled in by bots */}
                        <input
                          type="text"
                          name="website"
                          value={requestForm.website}
                          onChange={(e) => setRequestForm({ ...requestForm, website: e.target.value })}
                          className="hidden"
                          tabIndex={-1}
                          autoComplete="off"
                          aria-hidden="true"
                        />
                      </>
                    )}

                    {!isForgotPassword && isLoginView && (
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-sand-500 tracking-wider ml-1">
                          Password
                        </label>
                        <div className="relative group">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-sand-500 group-focus-within:text-forest-700 transition-colors">
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
                            className="w-full bg-sand-50 border border-sand-200 rounded-xl py-3 pl-10 pr-12 text-base sm:text-sm text-ink placeholder-sand-400 focus:border-forest-300 focus:ring-1 focus:ring-forest-300 focus:bg-white/90 transition-all outline-none"
                            required
                            minLength={8}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute inset-y-0 right-0 pr-4 flex items-center text-sand-500 hover:text-forest-700 transition-colors cursor-pointer"
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
                      className="cursor-pointer w-full bg-forest-800 hover:bg-forest-700 text-white py-3 rounded-xl text-sm font-bold shadow-lg transition-all transform active:scale-[0.98] flex items-center justify-center gap-2"
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
                  <div className="mt-6 md:mt-8 pt-5 md:pt-6 border-t border-sand-100 flex flex-col items-center gap-4 text-sm">
                    {!isForgotPassword && (
                      <div className="text-sand-600">
                        {isLoginView
                          ? "Don't have an account?"
                          : "Already have an account? "}{" "}
                        <button
                          onClick={() => {
                            setIsLoginView(!isLoginView);
                            setMessage(null);
                          }}
                          className="cursor-pointer text-forest-700 hover:text-forest-700 font-semibold transition-colors"
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
                      className="cursor-pointer text-xs text-sand-500 hover:text-sand-700 transition-colors"
                    >
                      {isForgotPassword
                        ? "Back to Login"
                        : "Forgot Password? (Request via Email)"}
                    </button>
                  </div>
                  </div>

                  {/* Credits: Sign In on phones only (the sidebar shows them on desktop).
                      Outside the centred block, so they sit at the bottom of the screen. */}
                  {isLoginView && !isForgotPassword && (
                    <div className="md:hidden pt-6 text-center text-[8px] text-sand-500 font-mono">
                      <div className="uppercase tracking-[0.2em] mb-0.5 text-sand-400">
                        In Collaboration With
                      </div>
                      <div className="text-[9px] font-bold text-sand-600 uppercase tracking-wider leading-relaxed">
                        <a
                          href="https://instagram.com/jendelacakradigital"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-forest-700 transition-colors"
                        >
                          Jendela Cakra Digital
                        </a>{" "}
                        &amp;{" "}
                        <a
                          href="https://instagram.com/makopala_ubl"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-forest-700 transition-colors"
                        >
                          Makopala Univ. Budi Luhur
                        </a>
                      </div>
                      <div className="opacity-50">@2026</div>
                    </div>
                  )}
                </div>

                {/* Close Button - Moved to bottom for better stacking */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                  }}
                  className="absolute top-[calc(0.75rem+env(safe-area-inset-top))] right-3 md:top-4 md:right-4 text-sand-600 hover:text-ink transition-colors z-[60] p-2 bg-white/90 shadow-sm md:bg-transparent md:shadow-none hover:bg-sand-100 rounded-full cursor-pointer"
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
  const usesLogoAvatar = LOGO_AVATAR_EMAILS.includes(String(currentUser.email ?? "").toLowerCase());

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
        className="relative cursor-pointer w-full flex items-center justify-center gap-2 bg-forest-50 hover:bg-forest-100 text-forest-700 px-3 py-1.5 rounded-lg text-[10px] font-medium transition-colors border border-forest-200"
        title={newRequestCount > 0 ? `${newRequestCount} new account request(s)` : undefined}
      >
        {newRequestCount > 0 && (
          <span
            className="absolute -top-2 -right-2 flex h-5 min-w-5 px-1 items-center justify-center rounded-full bg-brick-600 text-white text-[10px] font-bold ring-2 ring-white shadow"
            aria-label={`${newRequestCount} new account requests`}
          >
            <span className="absolute inset-0 rounded-full bg-brick-500 animate-ping opacity-60" />
            <span className="relative">{newRequestCount > 99 ? "99+" : newRequestCount}</span>
          </span>
        )}
        {usesLogoAvatar ? (
          <img
            src={landscapeLogo}
            className="w-4 h-4 rounded-full bg-white object-contain p-px"
            alt="Landscape 360"
          />
        ) : currentUser.user_metadata?.avatar_url ? (
          <img
            src={currentUser.user_metadata.avatar_url}
            className="w-4 h-4 rounded-full"
            alt="Avatar"
          />
        ) : (
          <div className="w-4 h-4 rounded-full bg-forest-700 flex items-center justify-center text-[8px]">
            {currentUser.email?.charAt(0).toUpperCase()}
          </div>
        )}
        <span className="max-w-[80px] truncate">
          {accountDisplayName(currentUser) || currentUser.email}
        </span>
        {isSyncing && (
          <Loader2 size={12} className="animate-spin text-forest-700" />
        )}
      </button>

      {/* Full Screen Modal for User Menu - Rendered via Portal */}
      {showMenu &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center md:p-6 bg-ink/40 backdrop-blur-sm md:backdrop-blur-md animate-in fade-in duration-200">
            <div
              // 100dvh on phones: h-full can be taller than the visible area in mobile
              // browsers, which pushed the footer (Sign Out) under the browser bar
              className={`relative w-full h-full h-dvh md:h-auto md:max-h-[90vh] md:max-w-3xl ${isAdmin ? "xl:max-w-6xl" : ""} bg-white border-0 md:border md:border-sand-200 rounded-none md:rounded-2xl overflow-hidden flex flex-col shadow-2xl`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-sand-100 bg-sand-50 shrink-0">
                <h2 className="text-sm font-bold text-ink tracking-wide uppercase flex items-center gap-2">
                  <div className="w-1 h-4 bg-forest-700 rounded-full"></div>
                  User Account
                </h2>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                    }}
                    className="cursor-pointer text-sand-600 hover:text-ink transition-colors p-1.5 hover:bg-sand-100 rounded-lg"
                    title="Close Menu"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div
                className={`flex-1 min-h-0 overflow-y-auto custom-scrollbar md:grid md:grid-cols-[300px_1fr] ${
                  isAdmin ? "xl:grid-cols-[300px_1fr_320px]" : ""
                }`}
              >
                {/* Left: profile & usage */}
                <aside className="p-5 md:p-6 bg-sand-50/60 border-b md:border-b-0 md:border-r border-sand-100 space-y-6">
                  {isEditingProfile ? (
                    <form
                      onSubmit={handleSaveProfile}
                      className="space-y-3 bg-white p-4 rounded-xl border border-sand-200"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-ink">Edit Profile</h3>
                        <button
                          type="button"
                          onClick={() => setIsEditingProfile(false)}
                          className="cursor-pointer p-1 rounded text-sand-600 hover:text-ink hover:bg-sand-100"
                          title="Cancel"
                        >
                          <X size={14} />
                        </button>
                      </div>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Display Name"
                        aria-label="Display name"
                        maxLength={120}
                        className="w-full bg-sand-50 border border-sand-200 rounded-lg px-3 py-2 text-sm text-ink focus:border-forest-600 outline-none"
                      />
                      {contact && (
                        <>
                          <input
                            type="text"
                            value={editOrganization}
                            onChange={(e) => setEditOrganization(e.target.value)}
                            placeholder="Organization (optional)"
                            aria-label="Organization"
                            maxLength={120}
                            className="w-full bg-sand-50 border border-sand-200 rounded-lg px-3 py-2 text-sm text-ink focus:border-forest-600 outline-none"
                          />
                          <input
                            type="tel"
                            value={editPhone}
                            onChange={(e) => setEditPhone(e.target.value)}
                            placeholder="Phone / WhatsApp (optional)"
                            aria-label="Phone / WhatsApp"
                            maxLength={30}
                            className="w-full bg-sand-50 border border-sand-200 rounded-lg px-3 py-2 text-sm text-ink focus:border-forest-600 outline-none"
                          />
                        </>
                      )}
                      {profileError && <p className="text-[11px] text-brick-600">{profileError}</p>}
                      <button
                        type="submit"
                        disabled={loading}
                        className="cursor-pointer w-full bg-forest-800 hover:bg-forest-700 text-white py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2"
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
                  ) : isChangingPassword ? (
                    <ChangePasswordForm
                      email={currentUser.email}
                      onClose={() => setIsChangingPassword(false)}
                      onChanged={() => {
                        setIsChangingPassword(false);
                        setPasswordNotice("Password updated");
                        setTimeout(() => setPasswordNotice(null), 4000);
                      }}
                    />
                  ) : (
                    <div className="flex md:flex-col items-center md:text-center gap-4">
                      {usesLogoAvatar ? (
                        <img
                          src={landscapeLogo}
                          className="w-16 h-16 md:w-24 md:h-24 shrink-0 rounded-full bg-white ring-2 ring-gold-300 object-contain p-2 md:p-3 shadow-lg"
                          alt="Landscape 360"
                        />
                      ) : currentUser.user_metadata?.avatar_url ? (
                        <img
                          src={currentUser.user_metadata.avatar_url}
                          className="w-16 h-16 md:w-24 md:h-24 shrink-0 rounded-full border-2 border-forest-600 object-cover shadow-lg"
                          alt="Avatar"
                        />
                      ) : (
                        <div className="w-16 h-16 md:w-24 md:h-24 shrink-0 rounded-full bg-forest-800 ring-2 ring-gold-300 flex items-center justify-center text-2xl md:text-4xl font-bold text-white shadow-lg">
                          {currentUser.email?.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1 md:w-full">
                        <div className="flex items-center md:justify-center gap-1">
                          <h3 className="font-bold text-lg text-ink truncate">
                            {accountDisplayName(currentUser) || "User L360"}
                          </h3>
                          <button
                            onClick={() => {
                              setEditName(accountDisplayName(currentUser));
                              setEditOrganization(contact?.organization ?? "");
                              setEditPhone(contact?.phone ?? "");
                              setProfileError(null);
                              setIsChangingPassword(false);
                              setIsEditingProfile(true);
                            }}
                            className="cursor-pointer shrink-0 p-1.5 text-sand-500 hover:text-ink hover:bg-sand-100 rounded-lg transition-colors"
                            title="Edit profile"
                          >
                            <Pencil size={14} />
                          </button>
                        </div>
                        <p className="text-xs text-sand-600 truncate">{currentUser.email}</p>
                        {(contact?.organization || contact?.phone) && (
                          <div className="mt-1 space-y-0.5 text-[11px] text-sand-600">
                            {contact.organization && (
                              <p className="flex items-center md:justify-center gap-1 truncate">
                                <Building2 size={11} className="shrink-0" /> {contact.organization}
                              </p>
                            )}
                            {contact.phone && (
                              <p className="flex items-center md:justify-center gap-1 truncate">
                                <Phone size={11} className="shrink-0" /> {contact.phone}
                              </p>
                            )}
                          </div>
                        )}
                        <div className="flex flex-wrap md:justify-center items-center gap-1.5 mt-3">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              isAdmin
                                ? "bg-forest-900 text-gold-300 border-forest-900"
                                : subscriptionStatus === "Enterprise"
                                  ? "bg-gold-50 text-gold-700 border-gold-200"
                                  : subscriptionStatus === "Pro"
                                    ? "bg-forest-50 text-forest-700 border-forest-200"
                                    : "bg-sand-100 text-sand-700 border-sand-300"
                            }`}
                          >
                            {isAdmin ? "Admin · All Access" : `${subscriptionStatus} Plan`}
                          </span>
                          {!isAdmin && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-forest-50 text-forest-700 border border-forest-200">
                              Status: {userRole === "monitor360" ? "Monitor" : "Active"}
                            </span>
                          )}
                          {SHOW_UPGRADE_BUTTON && !isAdmin && (
                            <button
                              onClick={() => setShowUpgradeModal(true)}
                              className="cursor-pointer text-[10px] text-forest-700 hover:underline"
                            >
                              Upgrade
                            </button>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            setIsEditingProfile(false);
                            setPasswordNotice(null);
                            setIsChangingPassword(true);
                          }}
                          className="cursor-pointer mt-3 inline-flex items-center gap-1.5 text-[11px] font-bold text-forest-700 hover:underline"
                        >
                          <KeyRound size={12} /> Change password
                        </button>
                        {passwordNotice && (
                          <p className="mt-1 text-[11px] text-forest-700 flex items-center md:justify-center gap-1">
                            <Check size={12} /> {passwordNotice}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Usage */}
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-bold text-sand-500 uppercase tracking-wider">
                      Usage
                    </h4>
                    <UsageMeter
                      label="Offline Maps"
                      value={String(mapUsage)}
                      limit={String(currentLimits.maps)}
                      percent={Math.min(100, (mapUsage / currentLimits.maps) * 100)}
                      barClass={mapUsage >= currentLimits.maps ? "bg-brick-500" : "bg-forest-700"}
                      warn={mapUsage >= currentLimits.maps}
                    />
                    <UsageMeter
                      label="Surveys / Markers"
                      value={String(surveyUsage)}
                      limit={String(currentLimits.surveys)}
                      percent={Math.min(100, (surveyUsage / currentLimits.surveys) * 100)}
                      barClass={surveyUsage >= currentLimits.surveys ? "bg-brick-500" : "bg-gold-400"}
                      warn={surveyUsage >= currentLimits.surveys}
                    />
                    {storageUsage && (() => {
                      const percent = usagePercent(storageUsage.usedBytes, storageUsage.limitBytes);
                      return (
                        <UsageMeter
                          label="Cloud Storage"
                          value={formatBytes(storageUsage.usedBytes)}
                          limit={storageUsage.limitBytes === null ? "Unlimited" : formatBytes(storageUsage.limitBytes)}
                          percent={percent ?? 0}
                          barClass={usageBarClass(percent)}
                          warn={percent !== null && percent >= 90}
                          title={(Object.keys(STORAGE_CATEGORY_LABELS) as (keyof typeof STORAGE_CATEGORY_LABELS)[])
                            .map((k) => `${STORAGE_CATEGORY_LABELS[k]}: ${formatBytes(storageUsage.breakdown[k])}`)
                            .join("\n")}
                        />
                      );
                    })()}
                  </div>
                </aside>

                {/* Right: actions, surveys, administration */}
                <section className="p-5 md:p-6 space-y-6 min-w-0">
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => {
                        createNewSurvey(); // Reset state for fresh survey
                        createGroup(); // Start Navigator Mode (new survey group)
                        setShowMenu(false);
                      }}
                      className="cursor-pointer flex flex-col md:flex-row items-center md:items-start gap-2 md:gap-3 p-4 rounded-xl bg-sand-50 hover:bg-sand-100 border border-sand-100 hover:border-sand-300 transition-all group text-center md:text-left"
                    >
                      <div className="p-2 bg-forest-50 rounded-lg text-forest-700 group-hover:bg-forest-700 group-hover:text-white transition-colors shrink-0">
                        <Plus size={20} />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-ink">New Survey</div>
                        <div className="hidden md:block text-[11px] text-sand-500">
                          Plot points with Navigator
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        setShowOfflineManager(true);
                        setShowMenu(false);
                      }}
                      className="cursor-pointer flex flex-col md:flex-row items-center md:items-start gap-2 md:gap-3 p-4 rounded-xl bg-sand-50 hover:bg-sand-100 border border-sand-100 hover:border-sand-300 transition-all group text-center md:text-left"
                    >
                      <div className="p-2 bg-forest-50 rounded-lg text-forest-700 group-hover:bg-forest-700 group-hover:text-white transition-colors shrink-0">
                        <WifiOff size={20} />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-ink">Offline Map</div>
                        <div className="hidden md:block text-[11px] text-sand-500">
                          Download areas for no signal
                        </div>
                      </div>
                    </button>
                  </div>

                  {/* Survey / Marker Lists */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-[10px] font-bold text-sand-500 uppercase tracking-wider flex items-center gap-2">
                        <FolderOpen size={12} />
                        Survey / Marker Lists
                      </h4>
                      <span className="text-[10px] text-sand-400">{savedSurveys.length} saved</span>
                    </div>
                    <div className="rounded-xl border border-sand-100 divide-y divide-sand-100 max-h-56 overflow-y-auto custom-scrollbar">
                      {isSyncing && savedSurveys.length === 0 ? (
                        <div className="flex items-center gap-2 p-4">
                          <Loader2 size={12} className="animate-spin text-forest-700" />
                          <span className="text-[11px] text-sand-500">Loading surveys...</span>
                        </div>
                      ) : savedSurveys.length === 0 ? (
                        <div className="p-4 text-[11px] text-sand-400 italic text-center">
                          No saved surveys found
                        </div>
                      ) : (
                        savedSurveys.map((survey) => (
                          <div
                            key={survey.id}
                            className={`flex items-center justify-between px-3 py-2.5 text-xs group transition-colors ${currentSurveyId === survey.id ? "bg-forest-50 text-forest-700" : "hover:bg-sand-50 text-sand-700"}`}
                          >
                            <button
                              onClick={() => {
                                loadSurvey(survey.id);
                                setShowMenu(false);
                              }}
                              className="cursor-pointer flex-1 min-w-0 text-left mr-2"
                            >
                              <span className="block truncate font-medium">{survey.name}</span>
                              <span className="text-[10px] text-sand-500 block">
                                Updated {new Date(survey.updated_at).toLocaleDateString()}
                              </span>
                            </button>
                            {currentSurveyId === survey.id && (
                              <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-forest-700 text-white mr-1">
                                Open
                              </span>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirmId(survey.id);
                              }}
                              className="cursor-pointer p-2 md:p-1.5 hover:bg-brick-50 text-sand-500 hover:text-brick-600 rounded transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100 shrink-0"
                              title="Delete Survey"
                            >
                              <Trash2 size={14} className="md:w-3 md:h-3" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Administration */}
                  {isAdmin && (
                    <div>
                      <h4 className="text-[10px] font-bold text-sand-500 uppercase tracking-wider mb-2">
                        Administration
                      </h4>
                      <div className="grid sm:grid-cols-2 gap-3">
                        <button
                          onClick={() => {
                            setShowMenu(false);
                            setShowUserManagement(true);
                          }}
                          className="cursor-pointer flex items-center justify-center gap-2 p-3 rounded-xl bg-forest-50 hover:bg-forest-100 text-forest-700 border border-forest-200 transition-all font-medium text-sm"
                        >
                          <Users size={16} /> Manage Users & Plans
                        </button>
                        <button
                          onClick={() => {
                            setShowMenu(false);
                            setShowAccountRequests(true);
                          }}
                          className="cursor-pointer flex items-center justify-center gap-2 p-3 rounded-xl bg-forest-50 hover:bg-forest-100 text-forest-700 border border-forest-200 transition-all font-medium text-sm"
                        >
                          <Inbox size={16} /> Account Requests
                          {newRequestCount > 0 && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brick-600 text-white">
                              {newRequestCount > 99 ? "99+" : newRequestCount} new
                            </span>
                          )}
                        </button>
                        <button
                          onClick={() => {
                            setShowMenu(false);
                            setShowPoiManager(true);
                          }}
                          className="cursor-pointer sm:col-span-2 flex items-center justify-center gap-2 p-3 rounded-xl bg-forest-50 hover:bg-forest-100 text-forest-700 border border-forest-200 transition-all font-medium text-sm"
                        >
                          <MapPin size={16} /> Points of Interest
                        </button>
                        <button
                          onClick={() => {
                            setShowMenu(false);
                            openSosAlerts();
                          }}
                          className="cursor-pointer sm:col-span-2 flex items-center justify-center gap-2 p-3 rounded-xl bg-brick-50 hover:bg-brick-100 text-brick-700 border border-brick-200 transition-all font-medium text-sm"
                        >
                          <Siren size={16} /> S.O.S Alerts
                          {activeSosCount > 0 && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brick-600 text-white animate-pulse">
                              {activeSosCount} active
                            </span>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </section>

                {/* Right: activity of all users (admin only) */}
                {isAdmin && <AdminActivityFeed />}
              </div>

              {/* Footer */}
              <div className="shrink-0 flex items-center justify-between gap-3 px-5 py-3 border-t border-sand-100 bg-sand-50">
                <span className="hidden sm:block text-[11px] text-sand-500 truncate">
                  Signed in as <strong className="text-sand-700">{currentUser.email}</strong>
                </span>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  {isAdmin && (
                    // Admin: the S.O.S button lives here instead of on the map
                    <button
                      onClick={() => setShowSos(true)}
                      className="cursor-pointer flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brick-600 hover:bg-brick-700 text-white border border-brick-600 transition-all font-black tracking-wider text-sm shadow-sm"
                      title="Open S.O.S (starts after a 5 second countdown you can cancel)"
                    >
                      <Siren size={16} /> S.O.S
                    </button>
                  )}
                  <button
                    onClick={() => setShowLogoutConfirm(true)}
                    className="cursor-pointer flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brick-50 hover:bg-brick-100 text-brick-600 border border-brick-200 transition-all font-medium text-sm"
                  >
                    <LogOut size={16} /> Sign Out
                  </button>
                </div>
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

      {showSos && user && isAdmin && (
        <SosScreen
          userId={user.id}
          userName={accountDisplayName(user) || user.email || ""}
          onClose={() => setShowSos(false)}
        />
      )}

      {showPoiManager &&
        isAdmin &&
        createPortal(
          <PoiManagerPanel
            onClose={() => setShowPoiManager(false)}
            onBack={() => {
              setShowPoiManager(false);
              setShowMenu(true);
            }}
          />,
          document.body,
        )}

      {showUserManagement &&
        user &&
        isAdmin &&
        createPortal(
          <UserManagementPanel
            currentUserId={user.id}
            onClose={() => setShowUserManagement(false)}
            onBack={() => {
              setShowUserManagement(false);
              setShowMenu(true);
            }}
          />,
          document.body,
        )}

      {showAccountRequests &&
        isAdmin &&
        createPortal(
          <AccountRequestsPanel
            onClose={() => setShowAccountRequests(false)}
            onBack={() => {
              setShowAccountRequests(false);
              setShowMenu(true);
            }}
            onSeen={markRequestsSeen}
          />,
          document.body,
        )}

      {interactionMode === "draw_region" &&
        createPortal(<RegionDrawingOverlay />, document.body)}

      {showUpgradeModal &&
        createPortal(
          <div className="fixed inset-0 z-[110] flex items-center justify-center md:p-4 bg-ink/40 backdrop-blur-sm md:backdrop-blur-md animate-in fade-in duration-300">
            <div
              className="relative w-full h-full md:h-auto md:max-w-2xl bg-white border-0 md:border md:border-sand-200 rounded-none md:rounded-2xl overflow-hidden flex flex-col md:max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-sand-100 bg-sand-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-forest-50 border border-sand-200 flex items-center justify-center text-forest-700">
                    <Check size={20} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-ink tracking-tight">
                      Upgrade Plan
                    </h2>
                    <div className="text-xs text-sand-600">
                      Unlock more features and limits
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowUpgradeModal(false)}
                  className="text-sand-600 hover:text-ink transition-colors p-2 hover:bg-sand-100 rounded-full cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                <div className="grid md:grid-cols-3 gap-4">
                  {/* Free Plan */}
                  <div
                    className={`p-4 rounded-xl border ${subscriptionStatus === "Free" ? "bg-sand-50 border-forest-300" : "bg-transparent border-sand-200"} relative flex flex-col`}
                  >
                    {subscriptionStatus === "Free" && (
                      <div className="absolute top-2 right-2 text-[10px] bg-forest-700 text-white px-2 py-0.5 rounded-full font-bold">
                        CURRENT
                      </div>
                    )}
                    <div className="mb-4">
                      <span className="text-xs font-bold px-2 py-1 bg-sand-100 text-sand-700 rounded uppercase tracking-wider">
                        Starter
                      </span>
                    </div>
                    <h3 className="font-bold text-ink mb-1">Free</h3>
                    <p className="text-sm text-sand-600 mb-6">
                      Basic exploration tools
                    </p>

                    <ul className="space-y-2 text-xs text-sand-600 mb-6 flex-1">
                      <li className="flex gap-2">
                        <span>✓</span> 1 MB Max Download
                      </li>
                      <li className="flex gap-2">
                        <span>✓</span> 1 Offline Maps
                      </li>
                      <li className="flex gap-2">
                        <span>✓</span> 2 Saved Surveys
                      </li>
                      <li className="flex gap-2 text-sand-400 line-through decoration-sand-400">
                        <span className="opacity-50">×</span> No GPS Tracking
                      </li>
                    </ul>

                    {subscriptionStatus !== "Free" && (
                      <a
                        href="mailto:contact@jcdigital.co.id?subject=Account Request: Landscape360 Starter Plan&body=Dear Admin,%0D%0A%0D%0AI hope this message finds you well.%0D%0A%0D%0AI would like to request the creation of a Starter (Free) account for the Landscape360 platform.%0D%0A%0D%0APlease let me know if any further information is required from my side.%0D%0A%0D%0AThank you,%0D%0A[Your Name]"
                        className="block w-full py-2 bg-sand-50 hover:bg-sand-100 border border-sand-200 text-ink text-center rounded-lg text-xs font-bold transition-colors"
                      >
                        Request Account
                      </a>
                    )}
                  </div>

                  {/* Pro Plan */}
                  <div
                    className={`p-4 rounded-xl border ${subscriptionStatus === "Pro" ? "bg-forest-50 border-forest-600" : "bg-transparent border-sand-200 hover:border-forest-300"} relative transition-colors flex flex-col`}
                  >
                    {subscriptionStatus === "Pro" && (
                      <div className="absolute top-2 right-2 text-[10px] bg-forest-700 text-white px-2 py-0.5 rounded-full font-bold">
                        CURRENT
                      </div>
                    )}
                    <div className="mb-4">
                      <span className="text-xs font-bold px-2 py-1 bg-forest-50 text-forest-700 rounded uppercase tracking-wider border border-forest-200">
                        Recommended
                      </span>
                    </div>
                    <div className="flex items-end gap-2 mb-1">
                      <span className="text-xs text-sand-500 line-through decoration-brick-600 decoration-1">
                        Rp 85.000
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-ink mb-1">
                      Rp 10.000
                      <span className="text-xs font-normal text-sand-500">
                        /bln
                      </span>
                    </h3>
                    <p className="text-xs text-sand-600 mb-6">
                      For field professionals
                    </p>

                    <ul className="space-y-2 text-xs text-sand-700 mb-6 flex-1">
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
                      <li className="flex gap-2 font-bold text-ink">
                        <span className="text-forest-700">✓</span> GPS Broadcast
                      </li>
                    </ul>

                    {subscriptionStatus !== "Pro" && (
                      <a
                        href="mailto:contact@jcdigital.co.id?subject=Subscription Upgrade: Landscape360 Pro Plan&body=Dear Admin,%0D%0A%0D%0AI hope this message finds you well.%0D%0A%0D%0AI am writing to request an upgrade of my account to the Landscape360 Pro Plan. I am interested in utilizing the advanced field tools and GPS broadcasting features.%0D%0A%0D%0APlease guide me through the payment and activation process.%0D%0A%0D%0AThank you,%0D%0A[Your Name]"
                        className="block w-full py-2 bg-forest-800 hover:bg-forest-700 text-white text-center rounded-lg text-xs font-bold transition-colors"
                      >
                        Upgrade to Pro
                      </a>
                    )}
                  </div>

                  {/* Enterprise Plan */}
                  <div
                    className={`p-4 rounded-xl border ${subscriptionStatus === "Enterprise" ? "bg-gold-50 border-gold-400" : "bg-transparent border-sand-200 hover:border-gold-300"} relative transition-colors flex flex-col`}
                  >
                    {subscriptionStatus === "Enterprise" && (
                      <div className="absolute top-2 right-2 text-[10px] bg-gold-400 text-white px-2 py-0.5 rounded-full font-bold">
                        CURRENT
                      </div>
                    )}
                    <div className="mb-4">
                      <span className="text-xs font-bold px-2 py-1 bg-forest-100 text-forest-700 rounded uppercase tracking-wider border border-forest-200">
                        Enterprise
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-ink mb-6">
                      Available Upon Request
                    </h3>

                    <ul className="space-y-2 text-xs text-sand-700 mb-6 flex-1">
                      <li className="flex gap-2">
                        <span>✓</span> 25 MB Max Download
                      </li>
                      <li className="flex gap-2">
                        <span>✓</span> 10 Offline Maps
                      </li>
                      <li className="flex gap-2">
                        <span>✓</span> 10 Saved Surveys
                      </li>
                      <li className="flex gap-2 font-bold text-ink">
                        <span className="text-forest-700">✓</span> Realtime
                        Monitoring
                      </li>
                      <li className="flex gap-2">
                        <span>✓</span> 24/7 Priority Support
                      </li>
                    </ul>

                    {subscriptionStatus !== "Enterprise" && (
                      <a
                        href="mailto:contact@jcdigital.co.id?subject=Subscription Upgrade: Landscape360 Enterprise Plan&body=Dear Admin,%0D%0A%0D%0AI hope this message finds you well.%0D%0A%0D%0AWe are interested in upgrading our organization's access to the Landscape360 Enterprise Plan to leverage the Realtime Monitoring and dedicated support features.%0D%0A%0D%0APlease contact us to arrange the upgrade and discuss any specific requirements.%0D%0A%0D%0ABest regards,%0D%0A[Your Name/Organization]"
                        className="block w-full py-2 bg-gold-500 hover:bg-gold-400 text-white text-center rounded-lg text-xs font-bold transition-colors"
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
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm md:backdrop-blur-md animate-in fade-in duration-300">
            <div
              className="relative w-full max-w-xs bg-white border border-sand-200 rounded-2xl overflow-hidden p-6 animate-in zoom-in-95 duration-300"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Red Glow Decor */}
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-brick-100 to-transparent"></div>

              <div className="flex flex-col items-center text-center gap-5">
                <div className="relative">
                  <div className="absolute inset-0 bg-brick-50 blur-xl rounded-full"></div>
                  <div className="relative w-14 h-14 rounded-2xl bg-brick-50 border border-brick-200 flex items-center justify-center text-brick-600 shadow-inner">
                    <Trash2 size={28} strokeWidth={1.5} />
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-ink tracking-tight">
                    Delete Survey?
                  </h3>
                  <p className="text-xs text-sand-600 leading-relaxed px-2">
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
                    className="cursor-pointer w-full py-3 bg-brick-600 hover:bg-brick-500 text-white rounded-xl text-xs font-bold shadow-lg transition-all active:scale-[0.98] border border-brick-200"
                  >
                    Delete Permanently
                  </button>
                  <button
                    onClick={() => setDeleteConfirmId(null)}
                    className="cursor-pointer w-full py-3 bg-sand-50 hover:bg-sand-100 border border-sand-200 rounded-xl text-xs font-bold text-sand-600 hover:text-ink transition-all active:scale-[0.98]"
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
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm md:backdrop-blur-md animate-in fade-in duration-300">
            <div
              className="relative w-full max-w-xs bg-white border border-sand-200 rounded-2xl overflow-hidden p-6 animate-in zoom-in-95 duration-300"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Red Glow Decor */}
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-brick-100 to-transparent"></div>

              <div className="flex flex-col items-center text-center gap-5">
                <div className="relative">
                  <div className="absolute inset-0 bg-brick-50 blur-xl rounded-full"></div>
                  <div className="relative w-14 h-14 rounded-2xl bg-brick-50 border border-brick-200 flex items-center justify-center text-brick-600 shadow-inner">
                    <LogOut size={28} strokeWidth={1.5} />
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-ink tracking-tight">
                    Sign Out?
                  </h3>
                  <p className="text-xs text-sand-600 leading-relaxed px-2">
                    Are you sure you want to sign out? You will need to log in
                    again to access your saved data.
                  </p>
                </div>

                <div className="flex flex-col gap-2 w-full mt-2">
                  <button
                    onClick={handleLogout}
                    className="cursor-pointer w-full py-3 bg-brick-600 hover:bg-brick-500 text-white rounded-xl text-xs font-bold shadow-lg transition-all active:scale-[0.98] border border-brick-200"
                  >
                    Yes, Sign Out
                  </button>
                  <button
                    onClick={() => setShowLogoutConfirm(false)}
                    className="cursor-pointer w-full py-3 bg-sand-50 hover:bg-sand-100 border border-sand-200 rounded-xl text-xs font-bold text-sand-600 hover:text-ink transition-all active:scale-[0.98]"
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
