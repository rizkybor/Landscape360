import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Users,
  X,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  KeyRound,
  Check,
  Loader2,
} from "lucide-react";
import {
  PLANS,
  ROLES,
  MIN_PASSWORD_LENGTH,
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  type ManagedUser,
  type Plan,
  type Role,
} from "../lib/adminUsers";

const ROLE_LABELS: Record<Role, string> = {
  pengguna360: "User",
  monitor360: "Monitor",
};

const PLAN_STYLES: Record<Plan, string> = {
  Free: "bg-sand-100 text-sand-700 border-sand-300",
  Pro: "bg-forest-50 text-forest-700 border-forest-200",
  Enterprise: "bg-gold-50 text-gold-700 border-gold-200",
};

const selectClass =
  "cursor-pointer bg-sand-50 border border-sand-200 rounded-lg px-2 py-1 text-[11px] text-ink outline-none focus:border-forest-300 disabled:opacity-50 disabled:cursor-not-allowed";
const inputClass =
  "w-full bg-sand-50 border border-sand-200 rounded-lg px-3 py-2 text-xs text-ink placeholder:text-sand-500 outline-none focus:border-forest-300";

interface Props {
  currentUserId: string;
  onClose: () => void;
}

export const UserManagementPanel = ({ currentUserId, onClose }: Props) => {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [passwordEditId, setPasswordEditId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");

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
      setUsers(await listUsers());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        u.displayName?.toLowerCase().includes(q),
    );
  }, [users, query]);

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
            <div className="p-2 rounded-lg bg-forest-50 text-forest-700">
              <Users size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-ink">Manage Users</h2>
              <p className="text-[10px] text-sand-500">
                {users.length} accounts · create, edit plan & role, reset password, delete
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
        <div className="flex items-center gap-2 p-3 border-b border-sand-100 shrink-0">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-sand-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search email or name..."
              className={`${inputClass} pl-9`}
            />
          </div>
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="cursor-pointer shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-forest-800 hover:bg-forest-700 text-white text-xs font-bold transition-colors"
          >
            <Plus size={14} /> Add User
          </button>
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

        {/* User list */}
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-3 space-y-2">
          {isLoading && users.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-12 text-xs text-sand-500">
              <Loader2 size={16} className="animate-spin" /> Loading users...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-12 text-center text-xs text-sand-500">No users found</div>
          ) : (
            filteredUsers.map((u, index) => {
              const isSelf = u.id === currentUserId;
              const isBusy = busyId === u.id;
              return (
                <div
                  key={u.id}
                  className="p-3 rounded-xl bg-sand-50 border border-sand-100 hover:border-sand-200 transition-colors"
                >
                  <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
                    <div className="flex-1 min-w-0 flex items-start gap-3">
                      <span className="shrink-0 w-7 h-7 rounded-lg bg-sand-50 border border-sand-200 flex items-center justify-center text-[10px] font-mono font-bold text-sand-600">
                        {index + 1}
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
                        <div className="text-[10px] text-sand-500 truncate">
                          {u.displayName || "—"} · Joined {new Date(u.createdAt).toLocaleDateString()}
                          {u.lastSignInAt && ` · Last login ${new Date(u.lastSignInAt).toLocaleDateString()}`}
                        </div>
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
                          setPasswordEditId(passwordEditId === u.id ? null : u.id);
                          setNewPassword("");
                          setConfirmDeleteId(null);
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
            })
          )}
        </div>
      </div>
    </div>
  );
};
