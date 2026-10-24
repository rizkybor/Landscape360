import { describe, it, expect } from 'vitest';
import { gmailComposeUrl, planBroadcast } from './adminEmail';

const emails = (n: number) => Array.from({ length: n }, (_, i) => `user${i}@example.com`);

describe('gmailComposeUrl', () => {
  it('puts broadcast recipients in BCC', () => {
    const url = new URL(gmailComposeUrl({ to: 'admin@x.com', bcc: ['a@x.com', 'b@x.com'], subject: 'Hi', message: 'Body' }));
    expect(url.searchParams.get('to')).toBe('admin@x.com');
    expect(url.searchParams.get('bcc')).toBe('a@x.com,b@x.com');
    expect(url.searchParams.get('su')).toBe('Hi');
  });

  it('leaves BCC out for a single email', () => {
    expect(new URL(gmailComposeUrl({ to: 'a@x.com', subject: '', message: '' })).searchParams.has('bcc')).toBe(false);
  });
});

describe('planBroadcast', () => {
  it('splits recipients into batches of at most 50', () => {
    const plan = planBroadcast({ sender: 'admin@x.com', recipients: emails(120), subject: 'S', message: 'M' });
    expect(plan.batches.map((b) => b.length)).toEqual([50, 50, 20]);
    expect(plan.recipientCount).toBe(120);
  });

  it('drops duplicates, blanks and the sender', () => {
    const plan = planBroadcast({
      sender: 'Admin@x.com',
      recipients: ['a@x.com', 'A@x.com ', '', 'admin@x.com', 'b@x.com'],
      subject: 'S',
      message: 'M',
    });
    expect(plan.batches).toEqual([['a@x.com', 'b@x.com']]);
  });

  it('keeps every compose link short enough to open', () => {
    const message = 'x'.repeat(4000);
    const plan = planBroadcast({ sender: 'admin@x.com', recipients: emails(200), subject: 'S', message });
    for (const batch of plan.batches) {
      expect(gmailComposeUrl({ to: 'admin@x.com', bcc: batch, subject: 'S', message }).length).toBeLessThanOrEqual(8000);
    }
    expect(plan.batches.flat()).toHaveLength(200);
  });

  it('flags a message too long for any compose link', () => {
    const plan = planBroadcast({ sender: 'admin@x.com', recipients: emails(3), subject: 'S', message: 'é'.repeat(3000) });
    expect(plan.messageTooLong).toBe(true);
    expect(plan.batches).toEqual([]);
  });
});
