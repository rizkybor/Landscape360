import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AdminActivityFeed } from './AdminActivityFeed';
import { fetchActivity, type ActivityEvent } from '../lib/adminUsers';

vi.mock('../lib/adminUsers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/adminUsers')>()),
  fetchActivity: vi.fn(),
}));
vi.mock('../lib/supabaseClient', () => ({ supabase: {} }));

const minutesAgo = (m: number) => new Date(Date.now() - m * 60000).toISOString();
const CHROME_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 Chrome/120.0 Safari/537.36';

const activity: ActivityEvent[] = [
  { id: 'logout-2', type: 'logout', email: 'pro@x.com', name: null, detail: CHROME_MAC, at: minutesAgo(2) },
  { id: 'request-a', type: 'request', email: 'budi@x.com', name: 'Budi', detail: 'Pro · pending', at: minutesAgo(30) },
  { id: 'login-1', type: 'login', email: 'pro@x.com', name: null, detail: CHROME_MAC, at: minutesAgo(90) },
];

describe('AdminActivityFeed', () => {
  beforeEach(() => {
    vi.mocked(fetchActivity).mockResolvedValue({
      activity,
      available: { logins: true, logouts: true, requests: true },
    });
  });

  it('lists sign-ins, sign-outs and account requests newest first', async () => {
    render(<AdminActivityFeed />);
    expect(await screen.findByText('Signed out')).toBeInTheDocument();
    expect(screen.getByText('Budi requested an account')).toBeInTheDocument();
    expect(screen.getByText('Signed in')).toBeInTheDocument();
    expect(screen.getByText('2 min ago · Chrome on macOS')).toBeInTheDocument();
    expect(screen.getByText('30 min ago · Pro · pending')).toBeInTheDocument();
  });

  it('filters by activity type', async () => {
    render(<AdminActivityFeed />);
    await screen.findByText('Signed out');
    fireEvent.click(screen.getByRole('button', { name: 'Request' }));
    expect(screen.getByText('Budi requested an account')).toBeInTheDocument();
    expect(screen.queryByText('Signed out')).not.toBeInTheDocument();
    expect(screen.queryByText('Signed in')).not.toBeInTheDocument();
  });

  it('says which migration is missing', async () => {
    vi.mocked(fetchActivity).mockResolvedValue({
      activity: [],
      available: { logins: true, logouts: false, requests: true },
    });
    render(<AdminActivityFeed />);
    expect(await screen.findByText(/sign-outs \(20261024000008\)/)).toBeInTheDocument();
    expect(screen.getByText('No activity yet')).toBeInTheDocument();
  });
});
