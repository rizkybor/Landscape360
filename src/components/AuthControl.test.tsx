
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthControl } from './AuthControl';
import { useSurveyStore } from '../store/useSurveyStore';
import { useMapStore } from '../store/useMapStore';
import { useOfflineStore } from '../store/useOfflineStore';
import { submitAccountRequest } from '../lib/accountRequests';

// Mocks
vi.mock('../store/useSurveyStore');
vi.mock('../store/useMapStore');
vi.mock('../store/useOfflineStore');
vi.mock('../lib/accountRequests', () => ({
  submitAccountRequest: vi.fn(() => Promise.resolve({ ok: true })),
  listAccountRequests: vi.fn(() => Promise.resolve({ requests: [], pendingCount: 0 })),
}));
vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: null } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
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

  it('submits an account request from the Request Account form', async () => {
    (useSurveyStore as any).mockReturnValue({
      user: null,
      setUser: vi.fn(),
      loadSavedSurveys: vi.fn(),
    });

    render(<AuthControl />);
    fireEvent.click(screen.getByText(/Sign In \/ Register/i));
    fireEvent.click(screen.getByRole('button', { name: 'Request Account' }));

    const form = document.body.querySelector('form')!;
    const [email, fullName, organization] = Array.from(
      form.querySelectorAll<HTMLInputElement>('input:not([name="website"])'),
    );
    fireEvent.change(email, { target: { value: 'budi@example.com' } });
    fireEvent.change(fullName, { target: { value: 'Budi Santoso' } });
    fireEvent.change(organization, { target: { value: 'Makopala UBL' } });
    fireEvent.submit(form);

    await waitFor(() =>
      expect(submitAccountRequest).toHaveBeenCalledWith({
        email: 'budi@example.com',
        fullName: 'Budi Santoso',
        organization: 'Makopala UBL',
        phone: undefined,
        requestedPlan: 'Free',
        message: undefined,
        website: '',
      }),
    );
    expect(await screen.findByText(/Request sent/)).toBeInTheDocument();
  });

  // Note: Testing the Modal opening requires interaction which is covered in other E2E-like tests or simple click tests.
  // Here we assume the modal logic works and focus on content if we were to render the modal directly.
});
