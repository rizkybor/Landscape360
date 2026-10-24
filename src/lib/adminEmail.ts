// Admin emails: the compose form opens Gmail with the recipient, subject and message filled
// in, and the admin reviews and sends it from their own mailbox.

export interface EmailDraft {
  to: string;
  bcc?: string[];
  subject: string;
  message: string;
}

export const gmailComposeUrl = ({ to, bcc, subject, message }: EmailDraft) => {
  const params = new URLSearchParams({ view: 'cm', fs: '1', to });
  if (bcc?.length) params.set('bcc', bcc.join(','));
  params.set('su', subject);
  params.set('body', message);
  return `https://mail.google.com/mail/?${params.toString()}`;
};

export interface EmailTemplateContext {
  name: string;
  email: string;
  plan: string;
  siteUrl: string;
}

// Starting points for the compose form; the admin can edit everything before opening Gmail
export const EMAIL_TEMPLATES: {
  id: string;
  label: string;
  build: (ctx: EmailTemplateContext) => { subject: string; message: string };
}[] = [
  {
    id: 'blank',
    label: 'Blank',
    build: () => ({ subject: '', message: '' }),
  },
  {
    id: 'account',
    label: 'Account information',
    build: (ctx) => ({
      subject: 'Your Landscape 360 account',
      message: `Hello ${ctx.name},\n\nYour Landscape 360 account (${ctx.email}) is on the ${ctx.plan} plan.\nSign in at ${ctx.siteUrl}\n\nIf you have any questions, just reply to this email.\n\nBest regards,\nLandscape 360 Admin`,
    }),
  },
  {
    id: 'plan',
    label: 'Plan updated',
    build: (ctx) => ({
      subject: `Your plan is now ${ctx.plan}`,
      message: `Hello ${ctx.name},\n\nYour Landscape 360 account has been updated to the ${ctx.plan} plan. The new features and limits are available the next time you sign in at ${ctx.siteUrl}\n\nBest regards,\nLandscape 360 Admin`,
    }),
  },
  {
    id: 'storage',
    label: 'Storage almost full',
    build: (ctx) => ({
      subject: 'Your Landscape 360 storage is almost full',
      message: `Hello ${ctx.name},\n\nYour Landscape 360 cloud storage is almost full. You can free up space by deleting tracks, marked locations or surveys you no longer need, or reply to this email to discuss more space.\n\nBest regards,\nLandscape 360 Admin`,
    }),
  },
];

// --- Broadcast: one message to many accounts ---
// Recipients go in BCC so nobody sees the other addresses, and are split into batches,
// each opened as its own Gmail draft. Gmail caps recipients per message and per day
// (about 500 a day on a personal account, 2,000 on Google Workspace) and very long compose
// links can fail to open, so a batch stays under both limits.

export const BROADCAST_BATCH_SIZE = 50;
export const GMAIL_DAILY_RECIPIENT_LIMIT = 500;
const MAX_COMPOSE_URL_LENGTH = 8000;

export interface BroadcastPlan {
  batches: string[][];
  recipientCount: number;
  // The subject and message alone make the compose link too long to open
  messageTooLong: boolean;
}

export const planBroadcast = ({
  sender,
  recipients,
  subject,
  message,
  batchSize = BROADCAST_BATCH_SIZE,
}: {
  sender: string;
  recipients: string[];
  subject: string;
  message: string;
  batchSize?: number;
}): BroadcastPlan => {
  const own = sender.trim().toLowerCase();
  const unique = [...new Set(recipients.map((r) => r.trim().toLowerCase()))].filter((r) => r && r !== own);
  const urlLength = (bcc: string[]) => gmailComposeUrl({ to: sender, bcc, subject, message }).length;

  if (unique.length > 0 && urlLength([unique[0]]) > MAX_COMPOSE_URL_LENGTH) {
    return { batches: [], recipientCount: unique.length, messageTooLong: true };
  }

  const batches: string[][] = [];
  let batch: string[] = [];
  for (const email of unique) {
    const next = [...batch, email];
    if (batch.length > 0 && (next.length > batchSize || urlLength(next) > MAX_COMPOSE_URL_LENGTH)) {
      batches.push(batch);
      batch = [email];
    } else {
      batch = next;
    }
  }
  if (batch.length) batches.push(batch);
  return { batches, recipientCount: unique.length, messageTooLong: false };
};

// Starting points for a broadcast. Recipients are in BCC, so the text cannot be personal.
export const BROADCAST_TEMPLATES: {
  id: string;
  label: string;
  build: (ctx: { siteUrl: string }) => { subject: string; message: string };
}[] = [
  {
    id: 'blank',
    label: 'Blank',
    build: () => ({ subject: '', message: '' }),
  },
  {
    id: 'announcement',
    label: 'Announcement',
    build: (ctx) => ({
      subject: 'News from Landscape 360',
      message: `Hello,\n\nWe have an update for Landscape 360 users:\n\n[Write your announcement here]\n\nOpen Landscape 360: ${ctx.siteUrl}\n\nBest regards,\nLandscape 360 Admin`,
    }),
  },
  {
    id: 'features',
    label: 'New features',
    build: (ctx) => ({
      subject: 'New in Landscape 360',
      message: `Hello,\n\nLandscape 360 has new features:\n\n- [Feature 1]\n- [Feature 2]\n\nTry them now at ${ctx.siteUrl}\n\nBest regards,\nLandscape 360 Admin`,
    }),
  },
  {
    id: 'maintenance',
    label: 'Maintenance notice',
    build: (ctx) => ({
      subject: 'Scheduled maintenance for Landscape 360',
      message: `Hello,\n\nLandscape 360 will be under maintenance on [date] from [time] to [time] (WIB). During this time the app may be unavailable. Maps you saved for offline use keep working.\n\n${ctx.siteUrl}\n\nThank you for your patience,\nLandscape 360 Admin`,
    }),
  },
];
