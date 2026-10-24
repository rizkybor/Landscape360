import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { UserManagementPanel } from './UserManagementPanel';
import {
  fetchLoginHistory,
  listUsers,
  updateUser,
  updatePlanStorageLimits,
  type ManagedUser,
} from '../lib/adminUsers';

vi.mock('../lib/adminUsers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/adminUsers')>();
  return {
    ...actual,
    listUsers: vi.fn(),
    createUser: vi.fn(),
    updateUser: vi.fn(),
    deleteUser: vi.fn(),
    updatePlanStorageLimits: vi.fn(),
    fetchLoginHistory: vi.fn(),
  };
});
vi.mock('../lib/supabaseClient', () => ({ supabase: {} }));

const MB = 1024 * 1024;

const user = (overrides: Partial<ManagedUser>): ManagedUser => ({
  id: 'u1',
  email: 'pro@x.com',
  displayName: 'Pro User',
  plan: 'Pro',
  role: 'pengguna360',
  isAdmin: false,
  createdAt: '2026-01-01T00:00:00Z',
  lastSignInAt: null,
  storage: {
    usedBytes: 95 * MB,
    limitBytes: 100 * MB,
    overrideMb: null,
    breakdown: { tracks: 80 * MB, locations: 5 * MB, surveys: 10 * MB, basemaps: 0 },
  },
  ...overrides,
});

const users = [
  user({}),
  user({ id: 'admin', email: 'admin@x.com', isAdmin: true, storage: { usedBytes: 2 * MB, limitBytes: null, overrideMb: null, breakdown: { tracks: 0, locations: 2 * MB, surveys: 0, basemaps: 0 } } }),
  user({ id: 'u2', email: 'big@x.com', plan: 'Enterprise', storage: { usedBytes: 300 * MB, limitBytes: 2048 * MB, overrideMb: 2048, breakdown: { tracks: 300 * MB, locations: 0, surveys: 0, basemaps: 0 } } }),
];

const rowOf = (email: string) => screen.getByText(email).closest('.rounded-xl') as HTMLElement;

describe('UserManagementPanel storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listUsers).mockResolvedValue({
      users,
      planStorageLimits: { Free: 10, Pro: 100, Enterprise: 1024 },
    });
    vi.mocked(updateUser).mockResolvedValue({ ok: true });
    vi.mocked(updatePlanStorageLimits).mockResolvedValue({ ok: true });
  });

  it('shows usage per account, the total, custom limits and unlimited admins', async () => {
    render(<UserManagementPanel currentUserId="admin" onClose={vi.fn()} />);
    expect(await screen.findByText('95.0 MB / 100.0 MB')).toBeInTheDocument();
    expect(screen.getByText(/397.0 MB cloud storage used/)).toBeInTheDocument();
    expect(within(rowOf('big@x.com')).getByText('custom')).toBeInTheDocument();
    expect(within(rowOf('admin@x.com')).getByText('2.00 MB / Unlimited')).toBeInTheDocument();
    expect(within(rowOf('admin@x.com')).queryByTitle('Storage limit')).not.toBeInTheDocument();
  });

  it('sorts by storage used', async () => {
    render(<UserManagementPanel currentUserId="admin" onClose={vi.fn()} />);
    await screen.findByText('pro@x.com');
    fireEvent.change(screen.getByTitle('Sort users'), { target: { value: 'storage' } });
    const emails = screen.getAllByText(/@x\.com$/).map((el) => el.textContent);
    expect(emails).toEqual(['big@x.com', 'pro@x.com', 'admin@x.com']);
  });

  it('filters by plan, role and accounts near their storage limit', async () => {
    vi.mocked(listUsers).mockResolvedValue({
      users: [...users, user({ id: 'u3', email: 'mon@x.com', plan: 'Free', role: 'monitor360', storage: null })],
      planStorageLimits: { Free: 10, Pro: 100, Enterprise: 1024 },
    });
    render(<UserManagementPanel currentUserId="admin" onClose={vi.fn()} />);
    await screen.findByText('pro@x.com');
    const emails = () => screen.getAllByText(/@x\.com$/).map((el) => el.textContent);

    fireEvent.change(screen.getByLabelText('Filter by plan'), { target: { value: 'Enterprise' } });
    expect(emails()).toEqual(['big@x.com']);
    expect(screen.getByText('1 of 4')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    fireEvent.change(screen.getByLabelText('Filter by role'), { target: { value: 'monitor360' } });
    expect(emails()).toEqual(['mon@x.com']);

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    fireEvent.click(screen.getByRole('button', { name: 'Near storage limit' }));
    expect(emails()).toEqual(['pro@x.com']);

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(emails()).toHaveLength(4);
    expect(screen.queryByRole('button', { name: 'Reset' })).not.toBeInTheDocument();
  });

  it('sets and clears a custom limit for one account', async () => {
    render(<UserManagementPanel currentUserId="admin" onClose={vi.fn()} />);
    await screen.findByText('pro@x.com');

    fireEvent.click(within(rowOf('pro@x.com')).getByTitle('Storage limit'));
    fireEvent.change(screen.getByLabelText('Custom storage limit in MB'), { target: { value: '250' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ id: 'u1', storageLimitMb: 250 }));

    fireEvent.click(within(rowOf('big@x.com')).getByTitle('Storage limit'));
    expect(screen.getByLabelText('Custom storage limit in MB')).toHaveValue(2048);
    fireEvent.click(screen.getByRole('button', { name: 'Use plan limit' }));
    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ id: 'u2', storageLimitMb: null }));
  });

  it('edits the default limit of each plan', async () => {
    render(<UserManagementPanel currentUserId="admin" onClose={vi.fn()} />);
    await screen.findByText('pro@x.com');
    fireEvent.click(screen.getByRole('button', { name: 'Storage' }));

    expect(screen.getByLabelText('Free storage limit in MB')).toHaveValue(10);
    fireEvent.change(screen.getByLabelText('Free storage limit in MB'), { target: { value: '25' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Limits/ }));

    await waitFor(() =>
      expect(updatePlanStorageLimits).toHaveBeenCalledWith({ Free: 25, Pro: 100, Enterprise: 1024 }),
    );
  });

  it('hides storage controls until the storage migration has been run', async () => {
    vi.mocked(listUsers).mockResolvedValue({ users: users.map((u) => ({ ...u, storage: null })), planStorageLimits: null });
    render(<UserManagementPanel currentUserId="admin" onClose={vi.fn()} />);
    await screen.findByText('pro@x.com');
    expect(screen.getByRole('button', { name: 'Storage' })).toBeDisabled();
    expect(screen.queryByTitle('Storage limit')).not.toBeInTheDocument();
    expect(screen.queryByText(/cloud storage used/)).not.toBeInTheDocument();
  });
});

describe('UserManagementPanel email and login history', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listUsers).mockResolvedValue({
      users: [user({ lastSignInAt: '2026-10-24T08:30:00Z' })],
      planStorageLimits: { Free: 10, Pro: 100, Enterprise: 1024 },
    });
  });

  it('prepares an email from a template and opens it in Gmail', async () => {
    render(<UserManagementPanel currentUserId="admin" onClose={vi.fn()} />);
    await screen.findByText('pro@x.com');
    fireEvent.click(screen.getByTitle('Send email'));

    expect(screen.getByLabelText('Recipient')).toHaveValue('pro@x.com');
    fireEvent.change(screen.getByTitle('Template'), { target: { value: 'plan' } });
    expect(screen.getByLabelText('Subject')).toHaveValue('Your plan is now Pro');
    expect((screen.getByLabelText('Message') as HTMLTextAreaElement).value).toMatch(/^Hello Pro User,/);

    const link = screen.getByRole('link', { name: /Open in Gmail/ });
    expect(link).toHaveAttribute('target', '_blank');
    const url = new URL(link.getAttribute('href')!);
    expect(url.origin + url.pathname).toBe('https://mail.google.com/mail/');
    expect(url.searchParams.get('view')).toBe('cm');
    expect(url.searchParams.get('to')).toBe('pro@x.com');
    expect(url.searchParams.get('su')).toBe('Your plan is now Pro');
    expect(url.searchParams.get('body')).toMatch(/^Hello Pro User,\n\nYour Landscape 360 account has been updated/);
  });

  it('keeps edits to the subject and message in the Gmail link', async () => {
    render(<UserManagementPanel currentUserId="admin" onClose={vi.fn()} />);
    await screen.findByText('pro@x.com');
    fireEvent.click(screen.getByTitle('Send email'));
    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Jadwal & info' } });
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Halo,\nsampai jumpa?' } });

    const url = new URL(screen.getByRole('link', { name: /Open in Gmail/ }).getAttribute('href')!);
    expect(url.searchParams.get('su')).toBe('Jadwal & info');
    expect(url.searchParams.get('body')).toBe('Halo,\nsampai jumpa?');
  });

  it('shows the login history with device and time', async () => {
    vi.mocked(fetchLoginHistory).mockResolvedValue({
      available: true,
      logins: [
        { id: 2, userAgent: 'Mozilla/5.0 (iPhone) AppleWebKit Version/17.0 Safari/604.1', signedInAt: '2026-10-24T08:30:00Z' },
        { id: 1, userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/120.0 Safari/537.36', signedInAt: '2026-10-20T01:00:00Z' },
      ],
    });
    render(<UserManagementPanel currentUserId="admin" onClose={vi.fn()} />);
    await screen.findByText('pro@x.com');
    fireEvent.click(screen.getByTitle('Login history'));

    expect(fetchLoginHistory).toHaveBeenCalledWith('u1');
    expect(await screen.findByText(/Safari on iPhone/)).toBeInTheDocument();
    expect(screen.getByText(/Chrome on Windows/)).toBeInTheDocument();
    expect(screen.getByText(/Last sign-in:/)).toBeInTheDocument();
  });

  it('explains when login history is not enabled yet', async () => {
    vi.mocked(fetchLoginHistory).mockResolvedValue({ available: false, logins: [] });
    render(<UserManagementPanel currentUserId="admin" onClose={vi.fn()} />);
    await screen.findByText('pro@x.com');
    fireEvent.click(screen.getByTitle('Login history'));
    expect(await screen.findByText(/Login history is not enabled yet/)).toBeInTheDocument();
  });
});
