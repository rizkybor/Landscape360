import { useState } from "react";
import { ExternalLink, Mail, X } from "lucide-react";
import { EMAIL_TEMPLATES, gmailComposeUrl } from "../lib/adminEmail";

interface Props {
  email: string;
  name: string;
  plan: string;
  onClose: () => void;
  onOpened?: (email: string) => void;
  // Prefill instead of a template (e.g. login details after approving a request)
  initialSubject?: string;
  initialMessage?: string;
}

const inputClass =
  "w-full bg-sand-50 border border-sand-200 rounded-lg px-3 py-2 text-xs text-ink placeholder:text-sand-500 outline-none focus:border-forest-300";

// Prepare an email to one account and open it in Gmail, where the admin sends it (admin only)
export const UserEmailComposer = ({
  email,
  name,
  plan,
  onClose,
  onOpened,
  initialSubject = "",
  initialMessage = "",
}: Props) => {
  const [templateId, setTemplateId] = useState(initialSubject || initialMessage ? "" : "blank");
  const [subject, setSubject] = useState(initialSubject);
  const [message, setMessage] = useState(initialMessage);

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const template = EMAIL_TEMPLATES.find((t) => t.id === id);
    if (!template) return;
    const draft = template.build({ name, email, plan, siteUrl: window.location.origin });
    setSubject(draft.subject);
    setMessage(draft.message);
  };

  return (
    <div className="mt-2 p-3 rounded-xl bg-white border border-sand-200 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-sand-600 flex items-center gap-1.5">
          <Mail size={12} /> Email via Gmail
        </span>
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer p-1 rounded hover:bg-sand-100 text-sand-600 hover:text-ink transition-colors"
          title="Close"
        >
          <X size={12} />
        </button>
      </div>

      <div className="flex gap-2">
        <input value={email} readOnly className={`${inputClass} text-sand-600`} aria-label="Recipient" />
        <select
          value={templateId}
          onChange={(e) => applyTemplate(e.target.value)}
          className="cursor-pointer shrink-0 bg-sand-50 border border-sand-200 rounded-lg px-2 text-[11px] text-ink outline-none"
          title="Template"
        >
          {templateId === "" && <option value="">Prefilled</option>}
          {EMAIL_TEMPLATES.map((t) => (
            <option key={t.id} value={t.id} className="bg-white">
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <input
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        maxLength={200}
        placeholder="Subject"
        className={inputClass}
        aria-label="Subject"
      />
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={5000}
        rows={6}
        placeholder="Message"
        className={`${inputClass} resize-y`}
        aria-label="Message"
      />

      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-sand-500">
          Opens Gmail in a new tab. Choose the sender there, then press Send.
        </span>
        <a
          href={gmailComposeUrl({ to: email, subject, message })}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => onOpened?.(email)}
          className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-forest-800 hover:bg-forest-700 text-white text-xs font-bold transition-colors"
        >
          <ExternalLink size={14} /> Open in Gmail
        </a>
      </div>
    </div>
  );
};
