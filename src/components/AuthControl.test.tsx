
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthControl } from './AuthControl';
import { useSurveyStore } from '../store/useSurveyStore';
import { useMapStore } from '../store/useMapStore';
import { useOfflineStore } from '../store/useOfflineStore';
import { fetchAccountRequestSummary, submitAccountRequest } from '../lib/accountRequests';
import { supabase } from '../lib/supabaseClient';

// Mocks
vi.mock('../store/useSurveyStore');
vi.mock('../store/useMapStore');
vi.mock('../store/useOfflineStore');
vi.mock('../lib/accountRequests', () => ({
  submitAccountRequest: vi.fn(() => Promise.resolve({ ok: true })),
  listAccountRequests: vi.fn(() =>
    Promise.resolve({
      requests: [{ id: 'r1', email: 'new@x.com', fullName: 'New Person', organization: 'Org', phone: '0812345678', requestedPlan: 'Free', message: 'Hi', status: 'pending', adminNote: null, userId: null, reviewedAt: null, createdAt: '2026-10-24T09:15:00.123456+00:00' }],
      pendingCount: 1,
    }),
  ),
  fetchAccountRequestSummary: vi.fn(() => Promise.resolve({ pendingCount: 0, newCount: 0 })),
  latestCreatedAt: (requests: { createdAt: string }[]) => requests[0]?.createdAt ?? null,
  generatePassword: () => 'Pass1234word',
}));
vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: null } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      updateUser: vi.fn(() => Promise.resolve({ data: {}, error: null })),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null }))
        }))
      }))
    }))
  }
}));

describe('AuthControl', () => {
  beforeEach(() => {
    (useMapStore as any).mockReturnValue({
      interactionMode: 'default'
    });

    (useOfflineStore as any).mockReturnValue({
      regions: []
    });
  });

  it('should render "Sign In / Register" when not logged in', () => {
    (useSurveyStore as any).mockReturnValue({
      user: null,
      setUser: vi.fn(),
      loadSavedSurveys: vi.fn(),
    });

    render(<AuthControl />);
    expect(screen.getByText(/Sign In \/ Register/i)).toBeInTheDocument();
  });

  it('should render user menu button when logged in', () => {
    (useSurveyStore as any).mockReturnValue({
      user: { email: 'test@example.com', user_metadata: { full_name: 'Test User' } },
      setUser: vi.fn(),
      loadSavedSurveys: vi.fn(),
      savedSurveys: [],
      subscriptionStatus: 'Free',
      userRole: 'pengguna360'
    });

    render(<AuthControl />);
    expect(screen.getByText('Test User')).toBeInTheDocument();
  });

  const openRequestForm = () => {
    (useSurveyStore as any).mockReturnValue({
      user: null,
      setUser: vi.fn(),
      loadSavedSurveys: vi.fn(),
    });
    render(<AuthControl />);
    fireEvent.click(screen.getByText(/Sign In \/ Register/i));
    fireEvent.click(screen.getByRole('button', { name: 'Request Account' }));
    const form = document.body.querySelector('form')!;
    const [email, fullName, organization, phone] = Array.from(
      form.querySelectorAll<HTMLInputElement>('input:not([name="website"])'),
    );
    const message = form.querySelector('textarea')!;
    const plan = form.querySelector('select')!;
    return { form, email, fullName, organization, phone, message, plan };
  };

  it('makes every Request Account field mandatory and only allows the Free plan', () => {
    const { email, fullName, organization, phone, message, plan } = openRequestForm();
    for (const field of [email, fullName, organization, phone, message]) {
      expect(field).toBeRequired();
    }
    expect(plan).toHaveValue('Free');
    const options = Array.from(plan.querySelectorAll('option'));
    expect(options.map((o) => [o.value, o.disabled])).toEqual([
      ['Free', false],
      ['Pro', true],
      ['Enterprise', true],
    ]);
  });

  it('submits an account request from the Request Account form', async () => {
    const { form, email, fullName, organization, phone, message } = openRequestForm();
    fireEvent.change(email, { target: { value: 'budi@example.com' } });
    fireEvent.change(fullName, { target: { value: 'Budi Santoso' } });
    fireEvent.change(organization, { target: { value: 'Makopala UBL' } });
    fireEvent.change(phone, { target: { value: '+62 812 3456 7890' } });
    fireEvent.change(message, { target: { value: 'Untuk pendakian' } });
    fireEvent.submit(form);

    await waitFor(() =>
      expect(submitAccountRequest).toHaveBeenCalledWith({
        email: 'budi@example.com',
        fullName: 'Budi Santoso',
        organization: 'Makopala UBL',
        phone: '+62 812 3456 7890',
        requestedPlan: 'Free',
        message: 'Untuk pendakian',
        website: '',
      }),
    );
    expect(await screen.findByText(/Request sent/)).toBeInTheDocument();
  });

  it('rejects a phone number without 8 to 15 digits', async () => {
    vi.mocked(submitAccountRequest).mockClear();
    const { form, email, fullName, organization, phone, message } = openRequestForm();
    fireEvent.change(email, { target: { value: 'budi@example.com' } });
    fireEvent.change(fullName, { target: { value: 'Budi Santoso' } });
    fireEvent.change(organization, { target: { value: 'Makopala UBL' } });
    fireEvent.change(phone, { target: { value: '0812' } });
    fireEvent.change(message, { target: { value: 'Untuk pendakian' } });
    fireEvent.submit(form);

    expect(await screen.findByText('Phone / WhatsApp number must have 8 to 15 digits')).toBeInTheDocument();
    expect(submitAccountRequest).not.toHaveBeenCalled();
  });

  it('shows a new account request notification to the admin until Account Requests is opened', async () => {
    vi.mocked(fetchAccountRequestSummary).mockResolvedValue({ pendingCount: 3, newCount: 3 });
    (useSurveyStore as any).mockReturnValue({
      user: { id: 'admin', email: 'admin@x.com', user_metadata: { full_name: 'Admin User' } },
      setUser: vi.fn(),
      loadSavedSurveys: vi.fn(),
      savedSurveys: [],
      subscriptionStatus: 'Free',
      userRole: 'pengguna360',
      isAdmin: true,
    });

    render(<AuthControl />);
    expect(await screen.findByLabelText('3 new account requests')).toHaveTextContent('3');

    fireEvent.click(screen.getByText('Admin User'));
    const requestsButton = screen.getByRole('button', { name: /Account Requests/ });
    expect(requestsButton).toHaveTextContent('3 new');

    vi.mocked(fetchAccountRequestSummary).mockResolvedValue({ pendingCount: 3, newCount: 0 });
    fireEvent.click(requestsButton);
    await waitFor(() =>
      expect(supabase.auth.updateUser).toHaveBeenCalledWith({
        data: { account_requests_seen_at: '2026-10-24T09:15:00.123456+00:00' },
      }),
    );
    await waitFor(() => expect(screen.queryByLabelText(/new account requests/)).not.toBeInTheDocument());
  });

  it('shows no request notification to non-admin accounts', async () => {
    vi.mocked(fetchAccountRequestSummary).mockClear();
    (useSurveyStore as any).mockReturnValue({
      user: { id: 'u1', email: 'u1@x.com', user_metadata: { full_name: 'Regular User' } },
      setUser: vi.fn(),
      loadSavedSurveys: vi.fn(),
      savedSurveys: [],
      subscriptionStatus: 'Pro',
      userRole: 'pengguna360',
      isAdmin: false,
    });
    render(<AuthControl />);
    await screen.findByText('Regular User');
    expect(fetchAccountRequestSummary).not.toHaveBeenCalled();
    expect(screen.queryByLabelText(/new account requests/)).not.toBeInTheDocument();
  });

  it.each([
    ['admin@landscape360.app', true],
    ['Admin@Landscape360.app', true],
    ['someone@x.com', false],
  ])('uses the Landscape 360 logo as profile picture for %s: %s', async (email, usesLogo) => {
    (useSurveyStore as any).mockReturnValue({
      user: { id: 'u1', email, user_metadata: { full_name: 'Rizky A Kurniawan' } },
      setUser: vi.fn(),
      loadSavedSurveys: vi.fn(),
      savedSurveys: [],
      subscriptionStatus: 'Free',
      userRole: 'pengguna360',
      isAdmin: false,
    });
    render(<AuthControl />);
    fireEvent.click(await screen.findByText('Rizky A Kurniawan'));

    // Sidebar button and the User Account menu
    expect(screen.queryAllByAltText('Landscape 360')).toHaveLength(usesLogo ? 2 : 0);
    if (!usesLogo) expect(screen.getAllByText('S').length).toBeGreaterThan(0);
  });

  // Note: Testing the Modal opening requires interaction which is covered in other E2E-like tests or simple click tests.
  // Here we assume the modal logic works and focus on content if we were to render the modal directly.
});
