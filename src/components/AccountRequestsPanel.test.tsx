import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AccountRequestsPanel } from './AccountRequestsPanel';
import {
  listAccountRequests,
  approveAccountRequest,
  rejectAccountRequest,
  type AccountRequest,
} from '../lib/accountRequests';

vi.mock('../lib/accountRequests', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/accountRequests')>();
  return {
    ...actual,
    listAccountRequests: vi.fn(),
    approveAccountRequest: vi.fn(),
    rejectAccountRequest: vi.fn(),
    deleteAccountRequest: vi.fn(),
  };
});

vi.mock('../lib/supabaseClient', () => ({ supabase: {} }));

const pendingRequest: AccountRequest = {
  id: 'req-1',
  email: 'budi@example.com',
  fullName: 'Budi Santoso',
  organization: 'Makopala UBL',
  phone: '0812',
  requestedPlan: 'Pro',
  message: 'Untuk pendakian',
  status: 'pending',
  adminNote: null,
  userId: null,
  reviewedAt: null,
  createdAt: '2026-10-24T00:00:00.000Z',
};

describe('AccountRequestsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listAccountRequests).mockResolvedValue({ requests: [pendingRequest], pendingCount: 1 });
    vi.mocked(approveAccountRequest).mockResolvedValue({ ok: true, userId: 'user-1' });
    vi.mocked(rejectAccountRequest).mockResolvedValue({ ok: true });
  });

  it('reports the newest pending request so the notification can be cleared', async () => {
    const onSeen = vi.fn();
    vi.mocked(listAccountRequests).mockResolvedValue({
      requests: [
        { ...pendingRequest, id: 'old', createdAt: '2026-10-23T08:00:00.000001+00:00' },
        { ...pendingRequest, id: 'new', createdAt: '2026-10-24T09:15:00.123456+00:00' },
      ],
      pendingCount: 2,
    });
    render(<AccountRequestsPanel onClose={vi.fn()} onSeen={onSeen} />);
    await waitFor(() => expect(onSeen).toHaveBeenCalledWith('2026-10-24T09:15:00.123456+00:00'));

    // Other tabs do not count as having seen the pending requests
    onSeen.mockClear();
    fireEvent.click(screen.getByText('Approved'));
    await waitFor(() => expect(listAccountRequests).toHaveBeenCalledWith('approved'));
    expect(onSeen).not.toHaveBeenCalled();
  });

  it('lists pending requests and reports the pending count', async () => {
    const onPendingCountChange = vi.fn();
    render(<AccountRequestsPanel onClose={vi.fn()} onPendingCountChange={onPendingCountChange} />);

    expect(await screen.findByText('Budi Santoso')).toBeInTheDocument();
    expect(screen.getByText('budi@example.com')).toBeInTheDocument();
    expect(screen.getByText('Untuk pendakian')).toBeInTheDocument();
    expect(listAccountRequests).toHaveBeenCalledWith('pending');
    expect(onPendingCountChange).toHaveBeenCalledWith(1);
  });

  it('approves with the requested plan and a generated password, then shows the login details', async () => {
    render(<AccountRequestsPanel onClose={vi.fn()} />);
    fireEvent.click(await screen.findByText('Approve'));

    const password = (screen.getByPlaceholderText(/Password \(min 8 chars\)/) as HTMLInputElement).value;
    expect(password).toHaveLength(12);

    fireEvent.click(screen.getByText('Create Account'));

    await waitFor(() =>
      expect(approveAccountRequest).toHaveBeenCalledWith({
        id: 'req-1',
        password,
        plan: 'Pro',
        role: 'pengguna360',
        displayName: 'Budi Santoso',
      }),
    );
    expect(await screen.findByText('Account created')).toBeInTheDocument();
    expect(screen.getByText(`Password: ${password}`)).toBeInTheDocument();
  });

  it('rejects with an optional note', async () => {
    render(<AccountRequestsPanel onClose={vi.fn()} />);
    fireEvent.click(await screen.findByTitle('Reject request'));
    fireEvent.change(screen.getByPlaceholderText(/Reason/), { target: { value: 'Duplicate' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Reject' }));

    await waitFor(() => expect(rejectAccountRequest).toHaveBeenCalledWith('req-1', 'Duplicate'));
  });

  it('loads other statuses from the tabs', async () => {
    render(<AccountRequestsPanel onClose={vi.fn()} />);
    await screen.findByText('Budi Santoso');
    fireEvent.click(screen.getByText('Approved'));

    await waitFor(() => expect(listAccountRequests).toHaveBeenCalledWith('approved'));
  });
});
