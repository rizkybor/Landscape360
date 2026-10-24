import { useState } from "react";
import { Check, Eye, EyeOff, KeyRound, Loader2, X } from "lucide-react";
import { changeMyPassword, passwordChangeError } from "../lib/accountPassword";

const inputClass =
  "w-full bg-sand-50 border border-sand-200 rounded-lg px-3 py-2 pr-10 text-base sm:text-sm text-ink focus:border-forest-600 outline-none";

// The signed-in user changes their own password (User Account)
export const ChangePasswordForm = ({ email, onClose, onChanged }: { email: string; onClose: () => void; onChanged: () => void }) => {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [signOutOthers, setSignOutOthers] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = passwordChangeError({ current, next, confirm });
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await changeMyPassword(email, { current, next }, { signOutOtherDevices: signOutOthers });
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const field = (label: string, value: string, set: (v: string) => void, autoComplete: string) => (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => set(e.target.value)}
        placeholder={label}
        aria-label={label}
        autoComplete={autoComplete}
        maxLength={72}
        className={inputClass}
      />
    </div>
  );

  return (
    <form onSubmit={submit} className="space-y-3 bg-white p-4 rounded-xl border border-sand-200">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-ink flex items-center gap-1.5">
          <KeyRound size={14} /> Change Password
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer p-1 rounded text-sand-600 hover:text-ink hover:bg-sand-100"
          title="Cancel"
        >
          <X size={14} />
        </button>
      </div>

      {field("Current password", current, setCurrent, "current-password")}
      {field("New password (min 8 characters)", next, setNext, "new-password")}
      {field("Confirm new password", confirm, setConfirm, "new-password")}

      <div className="flex items-center justify-between gap-2 text-[11px] text-sand-600">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={signOutOthers}
            onChange={(e) => setSignOutOthers(e.target.checked)}
            className="accent-forest-700"
          />
          Sign out other devices
        </label>
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="cursor-pointer flex items-center gap-1 hover:text-ink"
          aria-pressed={show}
        >
          {show ? <EyeOff size={12} /> : <Eye size={12} />} {show ? "Hide" : "Show"}
        </button>
      </div>

      {error && <p className="text-[11px] text-brick-600">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="cursor-pointer w-full bg-forest-800 hover:bg-forest-700 text-white py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {saving ? <Loader2 size={12} className="animate-spin" /> : <><Check size={12} /> Update Password</>}
      </button>
    </form>
  );
};
