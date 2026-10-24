import { useMemo, useState } from "react";
import { Check, Copy, ExternalLink, Megaphone, X } from "lucide-react";
import {
  BROADCAST_TEMPLATES,
  GMAIL_DAILY_RECIPIENT_LIMIT,
  gmailComposeUrl,
  planBroadcast,
} from "../lib/adminEmail";

interface Props {
  sender: string; // the admin's own address, used as "To" (recipients are in BCC)
  recipients: string[];
  onClose: () => void;
}

const inputClass =
  "w-full bg-sand-50 border border-sand-200 rounded-lg px-3 py-2 text-xs text-ink placeholder:text-sand-500 outline-none focus:border-forest-300";

// Prepare one message for many accounts and open it in Gmail in batches, where the admin
// sends each batch from their own mailbox (admin only)
export const BroadcastComposer = ({ sender, recipients, onClose }: Props) => {
  const [templateId, setTemplateId] = useState("blank");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [showRecipients, setShowRecipients] = useState(false);
  const [opened, setOpened] = useState<Set<number>>(new Set());
  const [copyNote, setCopyNote] = useState<string | null>(null);

  // Comma separated, as Gmail's To / BCC fields accept it
  const copyEmails = async (emails: string[], label: string) => {
    try {
      await navigator.clipboard.writeText(emails.join(", "));
      setCopyNote(`${label} copied`);
    } catch {
      setCopyNote("Could not copy to clipboard");
    }
    setTimeout(() => setCopyNote(null), 2500);
  };

  const plan = useMemo(
    () => planBroadcast({ sender, recipients, subject, message }),
    [sender, recipients, subject, message],
  );
  const canOpen = subject.trim() !== "" && message.trim() !== "" && !plan.messageTooLong;

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const template = BROADCAST_TEMPLATES.find((t) => t.id === id);
    if (!template) return;
    const draft = template.build({ siteUrl: window.location.origin });
    setSubject(draft.subject);
    setMessage(draft.message);
  };

  // The batches change when the text changes, so start the progress over
  const edit = (apply: () => void) => {
    apply();
    setOpened(new Set());
  };

  return (
    <div className="m-3 p-3 rounded-xl bg-white border border-forest-200 space-y-2 shrink-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-forest-700 flex items-center gap-1.5">
          <Megaphone size={14} /> Broadcast via Gmail
        </span>
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer p-1 rounded hover:bg-sand-100 text-sand-600 hover:text-ink transition-colors"
          title="Close"
        >
          <X size={14} />
        </button>
      </div>

      <div className="text-[11px] text-sand-700">
        <strong>{plan.recipientCount}</strong> recipient{plan.recipientCount === 1 ? "" : "s"} in BCC (they
        do not see each other's addresses).{" "}
        <button
          type="button"
          onClick={() => setShowRecipients((v) => !v)}
          className="cursor-pointer font-bold text-forest-700 hover:underline"
        >
          {showRecipients ? "Hide list" : "Show list"}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() =>
            copyEmails(
              plan.batches.flat(),
              `${plan.recipientCount} email${plan.recipientCount === 1 ? "" : "s"}`,
            )
          }
          disabled={plan.recipientCount === 0}
          className="cursor-pointer flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-sand-50 border border-sand-200 hover:bg-sand-100 text-sand-700 text-[11px] font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          title="Copy every recipient's address, comma separated"
        >
          <Copy size={12} /> Copy all emails ({plan.recipientCount})
        </button>
        <span className="text-[10px] text-sand-500">
          {copyNote ?? "To copy only some, tick those users in the list first."}
        </span>
      </div>
      {showRecipients && (
        <div className="max-h-24 overflow-y-auto custom-scrollbar p-2 rounded-lg bg-sand-50 border border-sand-100 text-[10px] text-sand-700 font-mono break-all">
          {plan.batches.flat().join(", ") || "No recipients"}
        </div>
      )}

      <div className="flex gap-2">
        <input value={sender} readOnly className={`${inputClass} text-sand-600`} aria-label="To (you)" title="To: your own address" />
        <select
          value={templateId}
          onChange={(e) => edit(() => applyTemplate(e.target.value))}
          className="cursor-pointer shrink-0 bg-sand-50 border border-sand-200 rounded-lg px-2 text-[11px] text-ink outline-none"
          title="Template"
          aria-label="Template"
        >
          {BROADCAST_TEMPLATES.map((t) => (
            <option key={t.id} value={t.id} className="bg-white">
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <input
        value={subject}
        onChange={(e) => edit(() => setSubject(e.target.value))}
        maxLength={200}
        placeholder="Subject"
        className={inputClass}
        aria-label="Subject"
      />
      <textarea
        value={message}
        onChange={(e) => edit(() => setMessage(e.target.value))}
        maxLength={5000}
        rows={6}
        placeholder="Message (the same text goes to everyone)"
        className={`${inputClass} resize-y`}
        aria-label="Message"
      />

      {plan.messageTooLong && (
        <p className="text-[10px] text-brick-600">
          The message is too long to open in Gmail. Shorten it, or paste the full text into Gmail after opening.
        </p>
      )}
      {plan.recipientCount > GMAIL_DAILY_RECIPIENT_LIMIT && (
        <p className="text-[10px] text-gold-700">
          Gmail allows about {GMAIL_DAILY_RECIPIENT_LIMIT} recipients a day on a personal account (2,000 on
          Google Workspace). Send the remaining batches on another day if Gmail stops you.
        </p>
      )}

      {plan.batches.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] text-sand-500">
            {plan.batches.length === 1
              ? "Opens one Gmail draft. Choose the sender there, then press Send."
              : `Split into ${plan.batches.length} Gmail drafts. Open and send them one by one.`}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {plan.batches.map((batch, i) => {
              const isOpened = opened.has(i);
              return (
                <div key={i} className="flex items-stretch">
                <a
                  href={canOpen ? gmailComposeUrl({ to: sender, bcc: batch, subject, message }) : undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-disabled={!canOpen}
                  onClick={(e) => {
                    if (!canOpen) {
                      e.preventDefault();
                      return;
                    }
                    setOpened((prev) => new Set(prev).add(i));
                  }}
                  title={canOpen ? batch.join(", ") : "Write a subject and a message first"}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-l-lg text-xs font-bold transition-colors ${
                    !canOpen
                      ? "bg-sand-100 text-sand-400 cursor-not-allowed"
                      : isOpened
                        ? "bg-forest-50 text-forest-700 border border-forest-200"
                        : "bg-forest-800 hover:bg-forest-700 text-white"
                  }`}
                >
                  {isOpened ? <Check size={14} /> : <ExternalLink size={14} />}
                  {plan.batches.length === 1 ? "Open in Gmail" : `Batch ${i + 1}`}
                  <span className="font-normal opacity-80">({batch.length})</span>
                </a>
                <button
                  type="button"
                  onClick={() => copyEmails(batch, plan.batches.length === 1 ? "Emails" : `Batch ${i + 1} emails`)}
                  className="cursor-pointer px-2 rounded-r-lg border border-l-0 border-sand-200 bg-white hover:bg-sand-100 text-sand-600 hover:text-ink transition-colors"
                  title={`Copy the ${batch.length} addresses in this ${plan.batches.length === 1 ? "draft" : "batch"}`}
                  aria-label={plan.batches.length === 1 ? "Copy emails" : `Copy batch ${i + 1} emails`}
                >
                  <Copy size={12} />
                </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
