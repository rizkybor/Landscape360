import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useSurveyStore } from './useSurveyStore';
import { supabase } from '../lib/supabaseClient';

// Mock Supabase
vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
    })),
  },
}));

describe('useSurveyStore', () => {
  beforeEach(() => {
    useSurveyStore.setState({
      user: { id: 'test-user', email: 'test@example.com' } as any,
      subscriptionStatus: 'Free',
      savedSurveys: [],
      groups: [],
      currentSurveyId: null,
    });
    vi.clearAllMocks();
  });

  it('should initialize with default values', () => {
    const state = useSurveyStore.getState();
    expect(state.subscriptionStatus).toBe('Free');
    expect(state.savedSurveys).toEqual([]);
  });

  it('should prevent saving new survey if Free limit (2) is reached', async () => {
    // Setup state: Free user with 2 existing surveys
    useSurveyStore.setState({
      subscriptionStatus: 'Free',
      savedSurveys: [
        { id: '1', name: 'S1', updated_at: '2023-01-01' },
        { id: '2', name: 'S2', updated_at: '2023-01-02' }
      ],
      currentSurveyId: null // New survey
    });

    // Mock alert
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const consoleMock = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Attempt to save
    await useSurveyStore.getState().saveCurrentSurvey('New Survey');

    // Assertions
    expect(consoleMock).toHaveBeenCalledWith(expect.stringContaining('Survey limit reached'));
    expect(supabase.from).not.toHaveBeenCalled(); // Should not hit DB

    alertMock.mockRestore();
    consoleMock.mockRestore();
  });

  it('should allow saving new survey if Free limit is NOT reached', async () => {
    // Setup state: Free user with 1 existing survey
    useSurveyStore.setState({
      subscriptionStatus: 'Free',
      savedSurveys: [
        { id: '1', name: 'S1', updated_at: '2023-01-01' }
      ],
      currentSurveyId: null
    });

    // Mock successful insert
    const insertMock = vi.fn().mockResolvedValue({ data: [{ id: 'new-id' }], error: null });
    (supabase.from as any).mockImplementation(() => ({
        insert: vi.fn().mockReturnValue({ select: insertMock }),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
    }));

    // Attempt to save
    await useSurveyStore.getState().saveCurrentSurvey('New Survey');

    // Should proceed
    expect(insertMock).toHaveBeenCalled();
  });

  it('should allow saving EXISTING survey even if limit reached', async () => {
    // Setup state: Free user with 2 existing surveys, currently editing one of them
    useSurveyStore.setState({
      subscriptionStatus: 'Free',
      savedSurveys: [
        { id: '1', name: 'S1', updated_at: '2023-01-01' },
        { id: '2', name: 'S2', updated_at: '2023-01-02' }
      ],
      currentSurveyId: '1' // Editing existing
    });

    // Mock update chain: update() -> eq() -> select()
    const selectMock = vi.fn().mockResolvedValue({ data: [{ id: '1' }], error: null });
    const eqMock = vi.fn().mockReturnValue({ select: selectMock });
    const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
    
    (supabase.from as any).mockImplementation(() => ({
        update: updateMock,
        // Fallbacks
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
    }));

    // Attempt to save
    await useSurveyStore.getState().saveCurrentSurvey('Updated Name');

    // Should proceed
    expect(updateMock).toHaveBeenCalled();
  });

  it('should enforce Pro limit (4)', async () => {
    useSurveyStore.setState({
      subscriptionStatus: 'Pro',
      savedSurveys: Array(4).fill({ id: 'x', name: 'x', updated_at: 'x' }),
      currentSurveyId: null
    });

    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const consoleMock = vi.spyOn(console, 'error').mockImplementation(() => {});

    await useSurveyStore.getState().saveCurrentSurvey('New');

    expect(consoleMock).toHaveBeenCalledWith(expect.stringContaining('Survey limit reached'));
    
    alertMock.mockRestore();
    consoleMock.mockRestore();
  });
});
