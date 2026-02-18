import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AuthControl } from './AuthControl';
import { useSurveyStore } from '../store/useSurveyStore';
import { supabase } from '../lib/supabaseClient';

// Mock Store
vi.mock('../store/useSurveyStore');

// Mock Supabase
vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      updateUser: vi.fn()
    }
  }
}));

describe('AuthControl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useSurveyStore as any).mockReturnValue({
      user: null,
      setUser: vi.fn(),
      loadSavedSurveys: vi.fn(),
      subscriptionStatus: 'Free'
    });
  });

  it('should render Login button when not logged in', () => {
    render(<AuthControl />);
    expect(screen.getByText(/Sign In \/ Register/i)).toBeInTheDocument();
  });

  it('should open modal on click', () => {
    render(<AuthControl />);
    fireEvent.click(screen.getByText(/Sign In \/ Register/i));
    expect(screen.getByText(/Welcome Back/i)).toBeInTheDocument();
  });

  it('should render User Menu when logged in', () => {
    (useSurveyStore as any).mockReturnValue({
      user: { email: 'test@example.com', user_metadata: { full_name: 'Test User' } },
      setUser: vi.fn(),
      loadSavedSurveys: vi.fn(),
      subscriptionStatus: 'Pro',
      savedSurveys: []
    });

    render(<AuthControl />);
    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.queryByText(/Sign In/i)).not.toBeInTheDocument();
  });

  it('should show logout button in menu', () => {
    (useSurveyStore as any).mockReturnValue({
      user: { email: 'test@example.com' },
      setUser: vi.fn(),
      loadSavedSurveys: vi.fn(),
      subscriptionStatus: 'Pro',
      savedSurveys: []
    });

    render(<AuthControl />);
    
    // Open menu
    fireEvent.click(screen.getByRole('button')); 
    
    expect(screen.getByText(/Sign Out/i)).toBeInTheDocument();
  });

  it('should call signOut on logout click', async () => {
    (useSurveyStore as any).mockReturnValue({
      user: { email: 'test@example.com' },
      setUser: vi.fn(),
      loadSavedSurveys: vi.fn(),
      subscriptionStatus: 'Pro',
      savedSurveys: []
    });

    render(<AuthControl />);
    fireEvent.click(screen.getByRole('button')); // Open menu
    
    const logoutBtn = screen.getByText(/Sign Out/i);
    fireEvent.click(logoutBtn);

    expect(supabase.auth.signOut).toHaveBeenCalled();
  });
});
