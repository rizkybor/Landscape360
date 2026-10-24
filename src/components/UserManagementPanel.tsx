import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Users,
  X,
  ChevronLeft,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  KeyRound,
  Check,
  Loader2,
  HardDrive,
  Mail,
  History,
  Megaphone,
  ShieldCheck,
} from "lucide-react";
import { UserEmailComposer } from "./UserEmailComposer";
import { BroadcastComposer } from "./BroadcastComposer";
import { ScrollShadowArea } from "./ScrollShadowArea";
import { whatsappUrl } from "../lib/profileContact";
import { UserLoginHistory } from "./UserLoginHistory";
import {
  PLANS,
  ROLES,
  MIN_PASSWORD_LENGTH,
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  updatePlanStorageLimits,
  type ManagedUser,
  type Plan,
  type PlanStorageLimits,
  type Role,
} from "../lib/adminUsers";
import {
  STORAGE_CATEGORY_LABELS,
  formatBytes,
  formatMb,
  usageBarClass,
  usagePercent,
} from "../lib/storageUsage";

const ROLE_LABELS: Record<Role, string> = {
  pengguna360: "User",
  monitor360: "Monitor",
};

const PLAN_STYLES: Record<Plan, string> = {
  Free: "bg-sand-100 text-sand-700 border-sand-300",
  Pro: "bg-forest-50 text-forest-700 border-forest-200",
  Enterprise: "bg-gold-50 text-gold-700 border-gold-200",
};

// Rows rendered per step in the user list
const USER_ROWS_PAGE = 20;

// Same threshold as the red usage bar
const NEAR_LIMIT_PERCENT = 90;

const selectClass =
  "cursor-pointer bg-sand-50 border border-sand-200 rounded-lg px-2 py-1 text-[11px] text-ink outline-none focus:border-forest-300 disabled:opacity-50 disabled:cursor-not-allowed";
const inputClass =
  "w-full bg-sand-50 border border-sand-200 rounded-lg px-3 py-2 text-xs text-ink placeholder:text-sand-500 outline-none focus:border-forest-300";

// 16px text on phones so iOS Safari does not zoom in when the search box is focused
const searchInputClass =
  "w-full bg-sand-50 border border-sand-200 rounded-lg pl-9 pr-3 py-2 text-base sm:text-xs text-ink placeholder:text-sand-500 outline-none focus:border-forest-300";

interface Props {
  currentUserId: string;
  onClose: () => void;
  onBack?: () => void;
}

const breakdownTitle = (u: ManagedUser) =>
  u.storage
    ? (Object.keys(STORAGE_CATEGORY_LABELS) as (keyof typeof STORAGE_CATEGORY_LABELS)[])
        .map((key) => `${STORAGE_CATEGORY_LABELS[key]}: ${formatBytes(u.storage!.breakdown[key])}`)
        .join("\n")
    : "";

export const UserManagementPanel = ({ currentUserId, onClose, onBack }: Props) => {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [passwordEditId, setPasswordEditId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [emailUserId, setEmailUserId] = useState<string | null>(null);
  const [historyUserId, setHistoryUserId] = useState<string | null>(null);
  const [quotaEditId, setQuotaEditId] = useState<string | null>(null);
  const [quotaValue, setQuotaValue] = useState("");
  const [sortBy, setSortBy] = useState<"email" | "storage">("email");
  const [planFilter, setPlanFilter] = useState<Plan | "all">("all");
  const [roleFilter, setRoleFilter] = useState<Role | "all">("all");
  const [nearLimitOnly, setNearLimitOnly] = useState(false);
  // Accounts ticked for a broadcast; none ticked = everyone shown
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBroadcast, setShowBroadcast] = useState(false);

  const [planLimits, setPlanLimits] = useState<PlanStorageLimits | null>(null);
  const [showPlanLimits, setShowPlanLimits] = useState(false);
  const [planLimitForm, setPlanLimitForm] = useState<Record<Plan, string>>({ Free: "", Pro: "", Enterprise: "" });
  const [isSavingPlanLimits, setIsSavingPlanLimits] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    displayName: "",
    plan: "Free" as Plan,
    role: "pengguna360" as Role,
  });

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await listUsers();
      setUsers(result.users);
      setPlanLimits(result.planStorageLimits);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Admin accounts are not counted as users: they are listed in their own section and left
  // out of the filters, counts, totals and broadcasts
  const adminUsers = useMemo(() => users.filter((u) => u.isAdmin), [users]);
  const memberUsers = useMemo(() => users.filter((u) => !u.isAdmin), [users]);
  const matchesQuery = (u: ManagedUser, q: string) =>
    !q || u.email.toLowerCase().includes(q) || !!u.displayName?.toLowerCase().includes(q);

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matching = memberUsers.filter((u) => {
      if (!matchesQuery(u, q)) return false;
      if (planFilter !== "all" && u.plan !== planFilter) return false;
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (nearLimitOnly) {
        const percent = u.storage ? usagePercent(u.storage.usedBytes, u.storage.limitBytes) : null;
        if (percent === null || percent < NEAR_LIMIT_PERCENT) return false;
      }
      return true;
    });
    if (sortBy === "email") return matching;
    return [...matching].sort((a, b) => (b.storage?.usedBytes ?? 0) - (a.storage?.usedBytes ?? 0));
  }, [memberUsers, query, sortBy, planFilter, roleFilter, nearLimitOnly]);

  // Rows rendered so far; starts over at one page whenever the search, filters or sort change
  const listKey = [query, planFilter, roleFilter, nearLimitOnly, sortBy].join("|");
  const [rowWindow, setRowWindow] = useState({ key: listKey, count: USER_ROWS_PAGE });
  const rowLimit = rowWindow.key === listKey ? rowWindow.count : USER_ROWS_PAGE;
  const showMoreRows = () => {
    if (rowLimit >= filteredUsers.length) return;
    setRowWindow({ key: listKey, count: rowLimit + USER_ROWS_PAGE });
  };

  // Admins follow the search box only; plan, role and storage filters do not apply to them
  const shownAdmins =
    planFilter !== "all" || roleFilter !== "all" || nearLimitOnly
      ? []
      : adminUsers.filter((u) => matchesQuery(u, query.trim().toLowerCase()));

  // Broadcast: the ticked users, or every user shown when none is ticked (never admins)
  const allShownSelected = filteredUsers.length > 0 && filteredUsers.every((u) => selectedIds.has(u.id));
  const broadcastRecipients = useMemo(
    () =>
      (selectedIds.size > 0 ? memberUsers.filter((u) => selectedIds.has(u.id)) : filteredUsers).map((u) => u.email),
    [memberUsers, filteredUsers, selectedIds],
  );
  const senderEmail = users.find((u) => u.id === currentUserId)?.email ?? "";

  const toggleSelected = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAllShown = () =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filteredUsers.forEach((u) => (allShownSelected ? next.delete(u.id) : next.add(u.id)));
      return next;
    });

  const hasFilters = planFilter !== "all" || roleFilter !== "all" || nearLimitOnly || query.trim() !== "";
  const resetFilters = () => {
    setQuery("");
    setPlanFilter("all");
    setRoleFilter("all");
    setNearLimitOnly(false);
  };

  const totalUsedBytes = useMemo(
    () => memberUsers.reduce((sum, u) => sum + (u.storage?.usedBytes ?? 0), 0),
    [memberUsers],
  );
  const storageEnabled = planLimits !== null;

  const flash = (message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(null), 2500);
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

  const handleFieldChange = async (user: ManagedUser, changes: { plan?: Plan; role?: Role }) => {
    const ok = await runAction(
      user.id,
      () => updateUser({ id: user.id, ...changes }),
      `${user.email} updated`,
    );
    if (ok) {
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, ...changes } : u)));
    }
  };

  const handlePasswordReset = async (user: ManagedUser) => {
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }
    const ok = await runAction(
      user.id,
      () => updateUser({ id: user.id, password: newPassword }),
      `Password for ${user.email} changed`,
    );
    if (ok) {
      setPasswordEditId(null);
      setNewPassword("");
    }
  };

  const handleQuotaSave = async (user: ManagedUser, storageLimitMb: number | null) => {
    if (storageLimitMb !== null && (!Number.isFinite(storageLimitMb) || storageLimitMb < 0)) {
      setError("Storage limit must be a number of MB (0 or more)");
      return;
    }
    const ok = await runAction(
      user.id,
      () => updateUser({ id: user.id, storageLimitMb }),
      storageLimitMb === null
        ? `${user.email} now uses the ${user.plan} plan limit`
        : `${user.email} storage limit set to ${formatMb(storageLimitMb)}`,
    );
    if (ok) {
      setQuotaEditId(null);
      await refresh();
    }
  };

  const openPlanLimits = () => {
    if (planLimits) {
      setPlanLimitForm({
        Free: String(planLimits.Free ?? ""),
        Pro: String(planLimits.Pro ?? ""),
        Enterprise: String(planLimits.Enterprise ?? ""),
      });
    }
    setShowPlanLimits((v) => !v);
  };

  const handlePlanLimitsSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const values = Object.fromEntries(PLANS.map((p) => [p, Number(planLimitForm[p])])) as PlanStorageLimits;
    if (PLANS.some((p) => planLimitForm[p].trim() === "" || !Number.isFinite(values[p]) || values[p] < 0)) {
      setError("Each plan limit must be a number of MB (0 or more)");
      return;
    }
    setIsSavingPlanLimits(true);
    setError(null);
    try {
      await updatePlanStorageLimits(values);
      flash("Plan storage limits saved");
      setShowPlanLimits(false);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSavingPlanLimits(false);
    }
  };

  const handleDelete = async (user: ManagedUser) => {
    const ok = await runAction(user.id, () => deleteUser(user.id), `${user.email} deleted`);
    if (ok) {
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
    }
    setConfirmDeleteId(null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }
    setIsCreating(true);
    setError(null);
    try {
      await createUser({
        email: form.email.trim(),
        password: form.password,
        displayName: form.displayName.trim() || undefined,
        plan: form.plan,
        role: form.role,
      });
      flash(`${form.email} created`);
      setForm({ email: "", password: "", displayName: "", plan: "Free", role: "pengguna360" });
      setShowCreate(false);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsCreating(false);
    }
  };

  // One account row; index is null for the administrators section (no number, no tick)
  const renderUserRow = (u: ManagedUser, index: number | null) => {
    const isSelf = u.id === currentUserId;
    const isBusy = busyId === u.id;
    return (
      <div
        key={u.id}
        className="p-3 rounded-xl bg-sand-50 border border-sand-100 hover:border-sand-200 transition-colors"
      >
        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
          <div className="flex-1 min-w-0 flex items-start gap-3">
            {index !== null && (
              <input
                type="checkbox"
                checked={selectedIds.has(u.id)}
                onChange={() => toggleSelected(u.id)}
                className="cursor-pointer mt-2 shrink-0 accent-forest-700"
                aria-label={`Select ${u.email}`}
                title="Select for a broadcast"
              />
            )}
            <span className="shrink-0 w-7 h-7 rounded-lg bg-sand-50 border border-sand-200 flex items-center justify-center text-[10px] font-mono font-bold text-sand-600">
              {index !== null ? index + 1 : <ShieldCheck size={13} className="text-forest-700" />}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-ink truncate">{u.email}</span>
                {isSelf && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-gold-50 text-gold-700 shrink-0">
                    You
                  </span>
                )}
                {u.isAdmin && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-forest-900 text-gold-300 shrink-0">
                    Admin
                  </span>
                )}
                {!u.isAdmin && (
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full border shrink-0 ${PLAN_STYLES[u.plan] ?? PLAN_STYLES.Free}`}>
                    {u.plan}
                  </span>
                )}
              </div>
              {(u.organization || u.phone) && (
                <div className="text-[10px] text-sand-600 truncate">
                  {u.organization}
                  {u.organization && u.phone && " · "}
                  {u.phone && (
                    <a
                      href={whatsappUrl(u.phone) ?? undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-forest-700 hover:underline"
                      title="Chat on WhatsApp"
                    >
                      {u.phone}
                    </a>
                  )}
                </div>
              )}
              <div className="text-[10px] text-sand-500 truncate">
                {u.displayName || "—"} · Joined {new Date(u.createdAt).toLocaleDateString()}
                {` · Last login ${u.lastSignInAt ? new Date(u.lastSignInAt).toLocaleString() : "never"}`}
              </div>
              {u.storage && (() => {
                const percent = usagePercent(u.storage.usedBytes, u.storage.limitBytes);
                return (
                  <div className="mt-1.5 max-w-xs" title={breakdownTitle(u)}>
                    <div className="flex items-center justify-between text-[10px] text-sand-600">
                      <span>
                        {formatBytes(u.storage.usedBytes)} /{" "}
                        {u.storage.limitBytes === null ? "Unlimited" : formatBytes(u.storage.limitBytes)}
                      </span>
                      {u.storage.overrideMb !== null && (
                        <span className="text-[9px] px-1 rounded bg-forest-50 text-forest-700 border border-forest-200">
                          custom
                        </span>
                      )}
                    </div>
                    <div className="h-1 bg-sand-200 rounded-full overflow-hidden mt-0.5">
                      <div
                        className={`h-full rounded-full ${usageBarClass(percent)}`}
                        style={{ width: `${percent ?? 0}%` }}
                      />
                    </div>
                  </div>
                );
              })()}
              </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isBusy && <Loader2 size={14} className="animate-spin text-sand-600" />}
            {u.isAdmin ? (
              <span className="text-[10px] text-sand-600 px-2" title="Admins have access to every feature">
                All access
              </span>
            ) : (
            <>
            <select
              value={u.plan}
              disabled={isSelf || isBusy}
              onChange={(e) => handleFieldChange(u, { plan: e.target.value as Plan })}
              className={selectClass}
              title={isSelf ? "You cannot change your own plan" : "Plan"}
            >
              {PLANS.map((p) => (
                <option key={p} value={p} className="bg-white">{p}</option>
              ))}
            </select>
            <select
              value={u.role}
              disabled={isSelf || isBusy}
              onChange={(e) => handleFieldChange(u, { role: e.target.value as Role })}
              className={selectClass}
              title={isSelf ? "You cannot change your own role" : "Role"}
            >
              {ROLES.map((r) => (
                <option key={r} value={r} className="bg-white">{ROLE_LABELS[r]}</option>
              ))}
            </select>
            </>
            )}
            <button
              onClick={() => {
                setEmailUserId(emailUserId === u.id ? null : u.id);
                setHistoryUserId(null);
                setQuotaEditId(null);
                setPasswordEditId(null);
                setConfirmDeleteId(null);
              }}
              disabled={isBusy}
              className={`cursor-pointer p-1.5 rounded-lg hover:bg-sand-100 transition-colors disabled:opacity-50 ${
                emailUserId === u.id ? "text-forest-700 bg-sand-100" : "text-sand-600 hover:text-ink"
              }`}
              title="Send email"
            >
              <Mail size={14} />
            </button>
            <button
              onClick={() => {
                setHistoryUserId(historyUserId === u.id ? null : u.id);
                setEmailUserId(null);
                setQuotaEditId(null);
                setPasswordEditId(null);
                setConfirmDeleteId(null);
              }}
              className={`cursor-pointer p-1.5 rounded-lg hover:bg-sand-100 transition-colors ${
                historyUserId === u.id ? "text-forest-700 bg-sand-100" : "text-sand-600 hover:text-ink"
              }`}
              title="Login history"
            >
              <History size={14} />
            </button>
            {u.storage && !u.isAdmin && (
              <button
                onClick={() => {
                  setEmailUserId(null);
                  setHistoryUserId(null);
                  setQuotaEditId(quotaEditId === u.id ? null : u.id);
                  setQuotaValue(u.storage?.overrideMb != null ? String(u.storage.overrideMb) : "");
                  setPasswordEditId(null);
                  setConfirmDeleteId(null);
                }}
                disabled={isBusy}
                className={`cursor-pointer p-1.5 rounded-lg hover:bg-sand-100 transition-colors disabled:opacity-50 ${
                  quotaEditId === u.id ? "text-forest-700 bg-sand-100" : "text-sand-600 hover:text-ink"
                }`}
                title="Storage limit"
              >
                <HardDrive size={14} />
              </button>
            )}
            <button
              onClick={() => {
                setPasswordEditId(passwordEditId === u.id ? null : u.id);
                setNewPassword("");
                setConfirmDeleteId(null);
                setQuotaEditId(null);
                setEmailUserId(null);
                setHistoryUserId(null);
              }}
              disabled={isBusy}
              className="cursor-pointer p-1.5 rounded-lg hover:bg-sand-100 text-sand-600 hover:text-ink transition-colors disabled:opacity-50"
              title="Reset password"
            >
              <KeyRound size={14} />
            </button>
            {confirmDeleteId === u.id ? (
              <>
                <button
                  onClick={() => handleDelete(u)}
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
                  setConfirmDeleteId(u.id);
                  setPasswordEditId(null);
                  setEmailUserId(null);
                  setHistoryUserId(null);
                  setQuotaEditId(null);
                }}
                disabled={isSelf || isBusy}
                className="cursor-pointer p-1.5 rounded-lg hover:bg-brick-50 text-brick-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title={isSelf ? "You cannot delete your own account" : "Delete user"}
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>

        {confirmDeleteId === u.id && (
          <div className="mt-2 text-[10px] text-brick-600">
            Delete {u.email} permanently? This cannot be undone.
          </div>
        )}

        {emailUserId === u.id && (
          <UserEmailComposer
            email={u.email}
            name={u.displayName || u.email.split("@")[0]}
            plan={u.isAdmin ? "Admin" : u.plan}
            onClose={() => setEmailUserId(null)}
          />
        )}

        {historyUserId === u.id && (
          <UserLoginHistory
            userId={u.id}
            lastSignInAt={u.lastSignInAt}
            onClose={() => setHistoryUserId(null)}
          />
        )}

        {quotaEditId === u.id && u.storage && (
          <div className="mt-2 space-y-1.5">
            <div className="flex gap-2">
              <input
                type="number"
                min={0}
                step="any"
                autoFocus
                placeholder={`Custom limit in MB (plan: ${planLimits ? formatMb(planLimits[u.plan] ?? 0) : "—"})`}
                value={quotaValue}
                onChange={(e) => setQuotaValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && quotaValue.trim() && handleQuotaSave(u, Number(quotaValue))}
                className={inputClass}
                aria-label="Custom storage limit in MB"
              />
              <button
                onClick={() => handleQuotaSave(u, Number(quotaValue))}
                disabled={isBusy || quotaValue.trim() === ""}
                className="cursor-pointer shrink-0 px-3 rounded-lg bg-forest-800 hover:bg-forest-700 text-white text-xs font-bold transition-colors disabled:opacity-50"
              >
                Save
              </button>
              {u.storage.overrideMb !== null && (
                <button
                  onClick={() => handleQuotaSave(u, null)}
                  disabled={isBusy}
                  className="cursor-pointer shrink-0 px-3 rounded-lg bg-sand-100 hover:bg-sand-200 text-sand-700 text-xs font-bold transition-colors disabled:opacity-50"
                >
                  Use plan limit
                </button>
              )}
            </div>
            <div className="text-[10px] text-sand-500">
              {breakdownTitle(u).replace(/\n/g, " · ")}
            </div>
          </div>
        )}

        {passwordEditId === u.id && (
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              autoFocus
              placeholder={`New password (min ${MIN_PASSWORD_LENGTH} chars)`}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handlePasswordReset(u)}
              className={inputClass}
              autoComplete="new-password"
            />
            <button
              onClick={() => handlePasswordReset(u)}
              disabled={isBusy}
              className="cursor-pointer shrink-0 px-3 rounded-lg bg-forest-800 hover:bg-forest-700 text-white text-xs font-bold transition-colors disabled:opacity-50"
            >
              Save
            </button>
          </div>
        )}
      </div>
    );
  };
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
              <Users size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-ink">Manage Users</h2>
              <p className="text-[10px] text-sand-500">
                {memberUsers.length} {memberUsers.length === 1 ? "user" : "users"}
                {storageEnabled && ` · ${formatBytes(totalUsedBytes)} cloud storage used`} · plan, role,
                storage, password
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

        {/* Toolbar */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 p-3 border-b border-sand-100 shrink-0">
          <div className="relative w-full sm:w-auto sm:flex-1 min-w-0">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-sand-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search email or name..."
              className={searchInputClass}
            />
          </div>
          {storageEnabled && (
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "email" | "storage")}
              className={`${selectClass} py-2 flex-1 sm:flex-none min-w-0`}
              title="Sort users"
            >
              <option value="email" className="bg-white">Sort: Email</option>
              <option value="storage" className="bg-white">Sort: Storage used</option>
            </select>
          )}
          <button
            onClick={openPlanLimits}
            disabled={!storageEnabled}
            className={`cursor-pointer shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              showPlanLimits ? "bg-forest-50 border-forest-200 text-forest-700" : "bg-sand-50 border-sand-200 text-sand-700 hover:bg-sand-100"
            }`}
            title={storageEnabled ? "Storage limits per plan" : "Run the storage quota migration to enable storage limits"}
          >
            <HardDrive size={14} /> Storage
          </button>
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="cursor-pointer shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-forest-800 hover:bg-forest-700 text-white text-xs font-bold transition-colors"
          >
            <Plus size={14} /> Add User
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-sand-100 shrink-0">
          <label className="flex items-center gap-1.5 text-[11px] text-sand-600 cursor-pointer" title="Select every account shown">
            <input
              type="checkbox"
              checked={allShownSelected}
              onChange={toggleAllShown}
              disabled={filteredUsers.length === 0}
              className="cursor-pointer accent-forest-700"
              aria-label="Select all shown"
            />
            <span className="hidden sm:inline">Select shown</span>
          </label>
          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value as Plan | "all")}
            className={selectClass}
            aria-label="Filter by plan"
          >
            <option value="all" className="bg-white">All plans</option>
            {PLANS.map((p) => (
              <option key={p} value={p} className="bg-white">{p}</option>
            ))}
          </select>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as Role | "all")}
            className={selectClass}
            aria-label="Filter by role"
          >
            <option value="all" className="bg-white">All roles</option>
            {ROLES.map((r) => (
              <option key={r} value={r} className="bg-white">{ROLE_LABELS[r]}</option>
            ))}
          </select>
          {storageEnabled && (
            <button
              onClick={() => setNearLimitOnly((v) => !v)}
              aria-pressed={nearLimitOnly}
              className={`cursor-pointer px-2 py-1 rounded-lg border text-[11px] transition-colors ${
                nearLimitOnly
                  ? "bg-brick-50 border-brick-200 text-brick-600 font-bold"
                  : "bg-sand-50 border-sand-200 text-sand-600 hover:bg-sand-100"
              }`}
              title={`Accounts using ${NEAR_LIMIT_PERCENT}% or more of their storage limit`}
            >
              Near storage limit
            </button>
          )}
          <span className="ml-auto text-[10px] text-sand-500">
            {filteredUsers.length} of {memberUsers.length}
            {selectedIds.size > 0 && ` · ${selectedIds.size} selected`}
          </span>
          {selectedIds.size > 0 && (
            <button
              onClick={() => setSelectedIds(new Set())}
              className="cursor-pointer text-[10px] text-sand-600 hover:text-ink hover:underline"
            >
              Clear
            </button>
          )}
          <button
            onClick={() => setShowBroadcast((v) => !v)}
            disabled={broadcastRecipients.length === 0}
            aria-pressed={showBroadcast}
            title={
              selectedIds.size > 0
                ? "Email the selected accounts via Gmail"
                : "Email every account shown via Gmail (tick accounts to pick some)"
            }
            className={`cursor-pointer flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              showBroadcast
                ? "bg-forest-800 border-forest-800 text-white"
                : "bg-forest-50 border-forest-200 text-forest-700 hover:bg-forest-100"
            }`}
          >
            <Megaphone size={12} /> Broadcast ({broadcastRecipients.length})
          </button>
          {hasFilters && (
            <button
              onClick={resetFilters}
              className="cursor-pointer text-[10px] font-bold text-forest-700 hover:underline"
            >
              Reset
            </button>
          )}
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

        {showBroadcast && (
          <BroadcastComposer
            sender={senderEmail}
            recipients={broadcastRecipients}
            onClose={() => setShowBroadcast(false)}
          />
        )}

        {/* Plan storage limits */}
        {showPlanLimits && storageEnabled && (
          <form
            onSubmit={handlePlanLimitsSave}
            className="m-3 p-3 rounded-xl bg-forest-50 border border-forest-200 space-y-2 shrink-0"
          >
            <div className="text-xs font-bold text-forest-700">Cloud storage limit per plan</div>
            <p className="text-[10px] text-sand-600">
              Counts tracks, marked locations, surveys and custom basemaps. Accounts with a custom
              limit keep it; the admin account is unlimited. Lowering a limit never deletes data, it
              only blocks new data until the account is back under the limit.
            </p>
            <div className="grid grid-cols-3 gap-2">
              {PLANS.map((p) => (
                <label key={p} className="space-y-1">
                  <span className="text-[10px] font-bold text-sand-600">{p} (MB)</span>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={planLimitForm[p]}
                    onChange={(e) => setPlanLimitForm({ ...planLimitForm, [p]: e.target.value })}
                    className={inputClass}
                    aria-label={`${p} storage limit in MB`}
                  />
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowPlanLimits(false)}
                className="cursor-pointer px-3 py-2 rounded-lg bg-white hover:bg-sand-100 text-sand-700 text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingPlanLimits}
                className="cursor-pointer flex items-center gap-1.5 px-3 py-2 rounded-lg bg-forest-800 hover:bg-forest-700 text-white text-xs font-bold transition-colors disabled:opacity-50"
              >
                {isSavingPlanLimits ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Save Limits
              </button>
            </div>
          </form>
        )}

        {/* Create form */}
        {showCreate && (
          <form
            onSubmit={handleCreate}
            className="m-3 p-3 rounded-xl bg-sand-50 border border-sand-200 grid grid-cols-1 md:grid-cols-2 gap-2 shrink-0"
          >
            <input
              type="email"
              required
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className={inputClass}
            />
            <input
              type="text"
              required
              minLength={MIN_PASSWORD_LENGTH}
              placeholder={`Password (min ${MIN_PASSWORD_LENGTH} chars)`}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className={inputClass}
              autoComplete="new-password"
            />
            <input
              type="text"
              placeholder="Display name (optional)"
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              className={inputClass}
            />
            <div className="flex gap-2">
              <select
                value={form.plan}
                onChange={(e) => setForm({ ...form, plan: e.target.value as Plan })}
                className={`${selectClass} flex-1 py-2`}
              >
                {PLANS.map((p) => (
                  <option key={p} value={p} className="bg-white">{p}</option>
                ))}
              </select>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
                className={`${selectClass} flex-1 py-2`}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r} className="bg-white">{ROLE_LABELS[r]}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="cursor-pointer px-3 py-2 rounded-lg bg-sand-50 hover:bg-sand-100 text-sand-700 text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isCreating}
                className="cursor-pointer flex items-center gap-1.5 px-3 py-2 rounded-lg bg-forest-800 hover:bg-forest-700 text-white text-xs font-bold transition-colors disabled:opacity-50"
              >
                {isCreating ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Create User
              </button>
            </div>
          </form>
        )}

        {/* User list: rows render a page at a time as the list is scrolled down (all users
            are loaded at once, since search, filters, sorting and totals need them all) */}
        <ScrollShadowArea
          wrapperClassName="flex-1"
          className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2"
          onReachEnd={showMoreRows}
        >
          {isLoading && users.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-12 text-xs text-sand-500">
              <Loader2 size={16} className="animate-spin" /> Loading users...
            </div>
          ) : (
            <>
              {shownAdmins.length > 0 && (
                <section className="space-y-2 pb-2 mb-1 border-b border-sand-200" aria-label="Administrators">
                  <h3 className="flex items-center gap-1.5 px-1 text-[10px] font-bold uppercase tracking-wider text-sand-500">
                    <ShieldCheck size={12} /> Administrators
                    <span className="font-normal normal-case tracking-normal">· not counted as users</span>
                  </h3>
                  {shownAdmins.map((u) => renderUserRow(u, null))}
                </section>
              )}
              {shownAdmins.length > 0 && (
                <h3 className="px-1 pt-1 text-[10px] font-bold uppercase tracking-wider text-sand-500">
                  Users
                </h3>
              )}
              {filteredUsers.length === 0 ? (
                <div className="py-12 text-center text-xs text-sand-500">No users found</div>
              ) : (
                <>
                  {filteredUsers.slice(0, rowLimit).map((u, index) => renderUserRow(u, index))}
                  {filteredUsers.length > rowLimit && (
                    <div className="py-2 text-center text-[10px] text-sand-500">
                      Showing {rowLimit} of {filteredUsers.length} ·{" "}
                      <button onClick={showMoreRows} className="cursor-pointer font-bold text-forest-700 hover:underline">
                        Show more
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </ScrollShadowArea>
      </div>
    </div>
  );
};
