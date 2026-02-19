
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuthControl } from './AuthControl';
import { useSurveyStore } from '../store/useSurveyStore';
import { useMapStore } from '../store/useMapStore';
import { useOfflineStore } from '../store/useOfflineStore';

// Mocks
vi.mock('../store/useSurveyStore');
vi.mock('../store/useMapStore');
vi.mock('../store/useOfflineStore');
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

  // Note: Testing the Modal opening requires interaction which is covered in other E2E-like tests or simple click tests.
  // Here we assume the modal logic works and focus on content if we were to render the modal directly.
});
