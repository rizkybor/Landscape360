import { useCallback, useEffect, useRef, useState } from "react";
import {
  Inbox,
  X,
  ChevronLeft,
  RefreshCw,
  Trash2,
  Check,
  Loader2,
  UserCheck,
  UserX,
  Wand2,
  Copy,
  Mail,
} from "lucide-react";
import {
  PLANS,
  ROLES,
  MIN_PASSWORD_LENGTH,
  type Plan,
  type Role,
} from "../lib/adminUsers";
import {
  listAccountRequests,
  approveAccountRequest,
  rejectAccountRequest,
  deleteAccountRequest,
  generatePassword,
  latestCreatedAt,
  ACCOUNT_REQUESTS_PAGE_SIZE,
  type AccountRequest,
  type RequestStatus,
} from "../lib/accountRequests";
import { UserEmailComposer } from "./UserEmailComposer";
import { ScrollShadowArea } from "./ScrollShadowArea";
import { whatsappUrl } from "../lib/profileContact";

const ROLE_LABELS: Record<Role, string> = {
  pengguna360: "User",
  monitor360: "Monitor",
};

const PLAN_STYLES: Record<Plan, string> = {
  Free: "bg-sand-100 text-sand-700 border-sand-300",
  Pro: "bg-forest-50 text-forest-700 border-forest-200",
  Enterprise: "bg-gold-50 text-gold-700 border-gold-200",
};

const STATUS_STYLES: Record<RequestStatus, string> = {
  pending: "bg-gold-50 text-gold-700 border-gold-200",
  approved: "bg-forest-50 text-forest-700 border-forest-200",
  rejected: "bg-brick-50 text-brick-600 border-brick-200",
};

const TABS: { value: RequestStatus | "all"; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
];

const selectClass =
  "cursor-pointer bg-sand-50 border border-sand-200 rounded-lg px-2 py-2 text-[11px] text-ink outline-none focus:border-forest-300 disabled:opacity-50 disabled:cursor-not-allowed";
const inputClass =
  "w-full bg-sand-50 border border-sand-200 rounded-lg px-3 py-2 text-xs text-ink placeholder:text-sand-500 outline-none focus:border-forest-300";

interface ApproveForm {
  displayName: string;
  password: string;
  plan: Plan;
  role: Role;
}

interface Props {
  onClose: () => void;
  onBack?: () => void;
  onPendingCountChange?: (count: number) => void;
  // Called whenever the pending list is shown, with the newest request in it, so the
  // "new request" notification can be cleared
  onSeen?: (latestCreatedAt: string | null) => void;
}

export const AccountRequestsPanel = ({ onClose, onBack, onPendingCountChange, onSeen }: Props) => {
  const [tab, setTab] = useState<RequestStatus | "all">("pending");
  const [requests, setRequests] = useState<AccountRequest[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);
  // The tab a response belongs to; answers for a tab no longer open are dropped
  const tabRef = useRef(tab);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [approveId, setApproveId] = useState<string | null>(null);
  const [approveForm, setApproveForm] = useState<ApproveForm>({
    displayName: "",
    password: "",
    plan: "Free",
    role: "pengguna360",
  });
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  // Shown once after approval so the admin can pass the login details on
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);
  const [showCredentialsEmail, setShowCredentialsEmail] = useState(false);

  // Latest callback without reloading the list when its identity changes
  const onSeenRef = useRef(onSeen);
  useEffect(() => {
    onSeenRef.current = onSeen;
  }, [onSeen]);

  // First page of the open tab (after a change, the list starts over from the newest)
  const refresh = useCallback(async () => {
    tabRef.current = tab;
    setIsLoading(true);
    setError(null);
    try {
      const result = await listAccountRequests(tab);
      if (tabRef.current !== tab) return;
      setRequests(result.requests);
      setHasMore(result.hasMore);
      setPendingCount(result.pendingCount);
      onPendingCountChange?.(result.pendingCount);
      if (tab === "pending") onSeenRef.current?.(latestCreatedAt(result.requests));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [tab, onPendingCountChange]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMoreRef.current || requests.length === 0) return;
    const requested = tab;
    loadingMoreRef.current = true;
    setIsLoadingMore(true);
    try {
      const result = await listAccountRequests(requested, requests[requests.length - 1].createdAt);
      if (tabRef.current !== requested) return;
      setRequests((prev) => {
        const seen = new Set(prev.map((r) => r.id));
        return [...prev, ...result.requests.filter((r) => !seen.has(r.id))];
      });
      setHasMore(result.hasMore);
    } catch (err) {
      if (tabRef.current === requested) setError((err as Error).message);
    } finally {
      loadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [hasMore, requests, tab]);

  const flash = (message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(null), 2500);
  };

  const closeForms = () => {
    setApproveId(null);
    setRejectId(null);
    setRejectNote("");
    setConfirmDeleteId(null);
  };

  const runAction = async (id: string, action: () => Promise<unknown>, success: string) => {
    setBusyId(id);
    setError(null);
    try {
      await action();
      flash(success);
      return true;
    } catch (err) {
      setError((err as Error).message);
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const openApprove = (r: AccountRequest) => {
    closeForms();
    setApproveId(r.id);
    setApproveForm({
      displayName: r.fullName,
      password: generatePassword(),
      plan: r.requestedPlan,
      role: "pengguna360",
    });
  };

  const handleApprove = async (r: AccountRequest) => {
    if (approveForm.password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }
    const ok = await runAction(
      r.id,
      () =>
        approveAccountRequest({
          id: r.id,
          password: approveForm.password,
          plan: approveForm.plan,
          role: approveForm.role,
          displayName: approveForm.displayName.trim() || undefined,
        }),
      `Account created for ${r.email}`,
    );
    if (ok) {
      setCredentials({ email: r.email, password: approveForm.password });
      setShowCredentialsEmail(false);
      closeForms();
      await refresh();
    }
  };

  const handleReject = async (r: AccountRequest) => {
    const ok = await runAction(
      r.id,
      () => rejectAccountRequest(r.id, rejectNote.trim() || undefined),
      `Request from ${r.email} rejected`,
    );
    if (ok) {
      closeForms();
      await refresh();
    }
  };

  const handleDelete = async (r: AccountRequest) => {
    const ok = await runAction(r.id, () => deleteAccountRequest(r.id), "Request deleted");
    if (ok) {
      closeForms();
      await refresh();
    }
  };

  const copyCredentials = async () => {
    if (!credentials) return;
    try {
      await navigator.clipboard.writeText(
        `Email: ${credentials.email}\nPassword: ${credentials.password}`,
      );
      flash("Login details copied");
    } catch {
      setError("Could not copy to clipboard");
    }
  };

  const credentialsMessage = credentials
    ? `Hello,\n\nYour Landscape 360 account request has been approved.\n\nSign in at ${window.location.origin}\nEmail: ${credentials.email}\nPassword: ${credentials.password}\n\nPlease keep your password private.\n\nBest regards,\nLandscape 360 Admin`
    : "";

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center md:p-4 bg-ink/40 backdrop-blur-sm md:backdrop-blur-md animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div
        className="relative w-full h-full md:h-auto md:max-w-3xl bg-white border-0 md:border md:border-sand-200 rounded-none md:rounded-2xl overflow-hidden flex flex-col md:max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 p-4 border-b border-sand-200 shrink-0">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="cursor-pointer p-1.5 -ml-1 text-sand-600 hover:text-ink hover:bg-sand-100 rounded-lg transition-colors"
                title="Back to User Account"
              >
                <ChevronLeft size={20} />
              </button>
            )}
            <div className="p-2 rounded-lg bg-forest-50 text-forest-700">
              <Inbox size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-ink">Account Requests</h2>
              <p className="text-[10px] text-sand-500">
                {pendingCount} pending · approve to create the account, or reject
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={refresh}
              disabled={isLoading}
              className="cursor-pointer p-2 rounded-lg hover:bg-sand-100 text-sand-600 hover:text-ink transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
            </button>
            <button
              onClick={onClose}
              className="cursor-pointer p-2 rounded-lg hover:bg-sand-100 text-sand-600 hover:text-ink transition-colors"
              title="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 p-3 border-b border-sand-100 shrink-0 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => {
                setTab(t.value);
                closeForms();
              }}
              className={`cursor-pointer shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                tab === t.value
                  ? "bg-forest-800 text-white"
                  : "bg-sand-50 text-sand-600 hover:bg-sand-100 hover:text-ink"
              }`}
            >
              {t.label}
              {t.value === "pending" && pendingCount > 0 && (
                <span
                  className={`text-[9px] px-1.5 rounded-full ${
                    tab === t.value ? "bg-gold-300 text-forest-900" : "bg-gold-100 text-gold-700"
                  }`}
                >
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {(error || notice) && (
          <div
            className={`mx-3 mt-3 text-[11px] p-2 rounded-lg border flex justify-between items-center gap-2 ${
              error
                ? "bg-brick-50 border-brick-200 text-brick-600"
                : "bg-forest-50 border-forest-200 text-forest-700"
            }`}
          >
            <span>{error || notice}</span>
            {error && (
              <button onClick={() => setError(null)} className="cursor-pointer text-brick-600 hover:text-ink">
                <X size={12} />
              </button>
            )}
          </div>
        )}

        {/* Login details of the account just approved */}
        {credentials && (
          <div className="m-3 p-3 rounded-xl bg-forest-50 border border-forest-200 shrink-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs font-bold text-forest-700 mb-1">Account created</div>
                <div className="text-[11px] text-ink font-mono break-all">Email: {credentials.email}</div>
                <div className="text-[11px] text-ink font-mono break-all">Password: {credentials.password}</div>
                <div className="text-[10px] text-sand-600 mt-1">
                  Send these login details to the user. The password is not shown again after you close this.
                </div>
              </div>
              <button
                onClick={() => setCredentials(null)}
                className="cursor-pointer p-1 rounded-lg hover:bg-forest-100 text-sand-600 hover:text-ink"
                title="Dismiss"
              >
                <X size={14} />
              </button>
            </div>
            <div className="flex gap-2 mt-2">
              <button
                onClick={copyCredentials}
                className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-forest-200 hover:bg-forest-100 text-forest-700 text-xs font-bold transition-colors"
              >
                <Copy size={12} /> Copy
              </button>
              <button
                onClick={() => setShowCredentialsEmail((v) => !v)}
                className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-forest-800 hover:bg-forest-700 text-white text-xs font-bold transition-colors"
              >
                <Mail size={12} /> Email user
              </button>
            </div>
            {showCredentialsEmail && (
              <UserEmailComposer
                email={credentials.email}
                name={credentials.email.split("@")[0]}
                plan=""
                initialSubject="Your Landscape 360 account is ready"
                initialMessage={credentialsMessage}
                onClose={() => setShowCredentialsEmail(false)}
                onOpened={() => flash(`Gmail opened for ${credentials.email}`)}
              />
            )}
          </div>
        )}

        {/* Request list: one page at a time, older pages load as it is scrolled down */}
        <ScrollShadowArea
          wrapperClassName="flex-1"
          className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2"
          onReachEnd={loadMore}
        >
          {isLoading && requests.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-12 text-xs text-sand-500">
              <Loader2 size={16} className="animate-spin" /> Loading requests...
            </div>
          ) : requests.length === 0 ? (
            <div className="py-12 text-center text-xs text-sand-500">
              {tab === "pending" ? "No pending requests" : "No requests found"}
            </div>
          ) : (
            requests.map((r) => {
              const isBusy = busyId === r.id;
              const isPending = r.status === "pending";
              return (
                <div
                  key={r.id}
                  className="p-3 rounded-xl bg-sand-50 border border-sand-100 hover:border-sand-200 transition-colors"
                >
                  <div className="flex flex-col md:flex-row md:items-start gap-2 md:gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-ink truncate">{r.fullName}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full border shrink-0 ${PLAN_STYLES[r.requestedPlan] ?? PLAN_STYLES.Free}`}>
                          {r.requestedPlan}
                        </span>
                        {tab === "all" && (
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full border shrink-0 capitalize ${STATUS_STYLES[r.status]}`}>
                            {r.status}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-sand-700 truncate">{r.email}</div>
                      <div className="text-[10px] text-sand-500 truncate">
                        {r.organization || (!r.phone && "—")}
                        {r.organization && r.phone && " · "}
                        {r.phone && (
                          <a
                            href={whatsappUrl(r.phone) ?? undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-forest-700 hover:underline"
                            title="Chat on WhatsApp"
                          >
                            {r.phone}
                          </a>
                        )}
                        {" · Requested "}
                        {new Date(r.createdAt).toLocaleDateString()}
                        {r.reviewedAt && ` · Reviewed ${new Date(r.reviewedAt).toLocaleDateString()}`}
                      </div>
                      {r.message && (
                        <div className="mt-1.5 bg-white border border-sand-100 rounded-lg p-2">
                          <div className="text-[9px] font-bold uppercase tracking-wider text-sand-500 mb-0.5">
                            Message
                          </div>
                          <p className="text-[11px] text-sand-700 whitespace-pre-wrap break-words">{r.message}</p>
                        </div>
                      )}
                      {r.adminNote && (
                        <div className="mt-1 text-[10px] text-brick-600">Note: {r.adminNote}</div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isBusy && <Loader2 size={14} className="animate-spin text-sand-600" />}
                      {isPending && (
                        <>
                          <button
                            onClick={() => (approveId === r.id ? closeForms() : openApprove(r))}
                            disabled={isBusy}
                            className="cursor-pointer flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-forest-800 hover:bg-forest-700 text-white text-[11px] font-bold transition-colors disabled:opacity-50"
                            title="Approve and create account"
                          >
                            <UserCheck size={13} /> Approve
                          </button>
                          <button
                            onClick={() => {
                              const open = rejectId !== r.id;
                              closeForms();
                              if (open) setRejectId(r.id);
                            }}
                            disabled={isBusy}
                            className="cursor-pointer flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-brick-50 hover:bg-brick-100 text-brick-600 text-[11px] font-bold transition-colors disabled:opacity-50"
                            title="Reject request"
                          >
                            <UserX size={13} /> Reject
                          </button>
                        </>
                      )}
                      {confirmDeleteId === r.id ? (
                        <>
                          <button
                            onClick={() => handleDelete(r)}
                            disabled={isBusy}
                            className="cursor-pointer p-1.5 rounded-lg bg-brick-50 hover:bg-brick-100 text-brick-600 transition-colors"
                            title="Confirm delete"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="cursor-pointer p-1.5 rounded-lg hover:bg-sand-100 text-sand-600 transition-colors"
                            title="Cancel"
                          >
                            <X size={14} />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => {
                            closeForms();
                            setConfirmDeleteId(r.id);
                          }}
                          disabled={isBusy}
                          className="cursor-pointer p-1.5 rounded-lg hover:bg-brick-50 text-brick-600 transition-colors disabled:opacity-30"
                          title="Delete request"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {confirmDeleteId === r.id && (
                    <div className="mt-2 text-[10px] text-brick-600">
                      Delete this request? {r.status === "approved" && "The account itself is not deleted."}
                    </div>
                  )}

                  {approveId === r.id && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleApprove(r);
                      }}
                      className="mt-3 p-3 rounded-xl bg-white border border-sand-200 grid grid-cols-1 md:grid-cols-2 gap-2"
                    >
                      <input
                        type="text"
                        placeholder="Display name"
                        value={approveForm.displayName}
                        onChange={(e) => setApproveForm({ ...approveForm, displayName: e.target.value })}
                        className={inputClass}
                      />
                      <div className="flex gap-2">
                        <input
                          type="text"
                          required
                          minLength={MIN_PASSWORD_LENGTH}
                          placeholder={`Password (min ${MIN_PASSWORD_LENGTH} chars)`}
                          value={approveForm.password}
                          onChange={(e) => setApproveForm({ ...approveForm, password: e.target.value })}
                          className={`${inputClass} font-mono`}
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          onClick={() => setApproveForm({ ...approveForm, password: generatePassword() })}
                          className="cursor-pointer shrink-0 p-2 rounded-lg bg-sand-50 border border-sand-200 hover:bg-sand-100 text-sand-600 hover:text-ink transition-colors"
                          title="Generate password"
                        >
                          <Wand2 size={14} />
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <select
                          value={approveForm.plan}
                          onChange={(e) => setApproveForm({ ...approveForm, plan: e.target.value as Plan })}
                          className={`${selectClass} flex-1`}
                          title="Plan"
                        >
                          {PLANS.map((p) => (
                            <option key={p} value={p} className="bg-white">{p}</option>
                          ))}
                        </select>
                        <select
                          value={approveForm.role}
                          onChange={(e) => setApproveForm({ ...approveForm, role: e.target.value as Role })}
                          className={`${selectClass} flex-1`}
                          title="Role"
                        >
                          {ROLES.map((role) => (
                            <option key={role} value={role} className="bg-white">{ROLE_LABELS[role]}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={closeForms}
                          className="cursor-pointer px-3 py-2 rounded-lg bg-sand-50 hover:bg-sand-100 text-sand-700 text-xs transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isBusy}
                          className="cursor-pointer flex items-center gap-1.5 px-3 py-2 rounded-lg bg-forest-800 hover:bg-forest-700 text-white text-xs font-bold transition-colors disabled:opacity-50"
                        >
                          {isBusy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                          Create Account
                        </button>
                      </div>
                    </form>
                  )}

                  {rejectId === r.id && (
                    <div className="mt-3 flex gap-2">
                      <input
                        type="text"
                        autoFocus
                        maxLength={500}
                        placeholder="Reason (optional, internal note)"
                        value={rejectNote}
                        onChange={(e) => setRejectNote(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleReject(r)}
                        className={inputClass}
                      />
                      <button
                        onClick={() => handleReject(r)}
                        disabled={isBusy}
                        className="cursor-pointer shrink-0 px-3 rounded-lg bg-brick-600 hover:bg-brick-500 text-white text-xs font-bold transition-colors disabled:opacity-50"
                      >
                        Confirm Reject
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
          {requests.length > 0 && (
            <div className="py-2 text-center text-[10px] text-sand-500">
              {isLoadingMore ? (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 size={11} className="animate-spin" /> Loading older requests...
                </span>
              ) : hasMore ? (
                <button onClick={loadMore} className="cursor-pointer font-bold text-forest-700 hover:underline">
                  Load more
                </button>
              ) : (
                requests.length > ACCOUNT_REQUESTS_PAGE_SIZE && "No older requests"
              )}
            </div>
          )}
        </ScrollShadowArea>
      </div>
    </div>
  );
};
