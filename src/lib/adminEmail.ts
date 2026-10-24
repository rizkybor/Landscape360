// Admin emails: the compose form opens Gmail with the recipient, subject and message filled
// in, and the admin reviews and sends it from their own mailbox.

export interface EmailDraft {
  to: string;
  subject: string;
  message: string;
}

export const gmailComposeUrl = ({ to, subject, message }: EmailDraft) => {
  const params = new URLSearchParams({ view: 'cm', fs: '1', to, su: subject, body: message });
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
