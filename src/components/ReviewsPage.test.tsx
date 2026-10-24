import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { ReviewsPage } from './ReviewsPage';
import { useSurveyStore } from '../store/useSurveyStore';
import * as api from '../lib/reviews';
import type { Review } from '../lib/reviews';

vi.mock('../store/useSurveyStore', () => ({ useSurveyStore: vi.fn() }));
vi.mock('./AuthControl', () => ({ AuthControl: () => <button>Sign In / Register</button> }));
vi.mock('../lib/reviews', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/reviews')>();
  return {
    ...actual,
    listReviews: vi.fn(),
    fetchReviewSummary: vi.fn(),
    fetchMyReview: vi.fn(),
    submitReview: vi.fn(),
    deleteMyReview: vi.fn(),
    replyToReview: vi.fn(),
    setReviewHidden: vi.fn(),
  };
});

const review = (overrides: Partial<Review> = {}): Review => ({
  id: 'r1',
  rating: 5,
  comment: 'Offline maps saved my trip!',
  authorName: 'Budi W.',
  isMine: false,
  isHidden: false,
  adminReply: null,
  adminReplyAt: null,
  createdAt: '2026-10-20T10:00:00Z',
  updatedAt: '2026-10-20T10:00:00Z',
  ...overrides,
});

const signedInAs = (user: { id: string } | null, isAdmin = false) =>
  vi.mocked(useSurveyStore).mockReturnValue({ user, isAdmin } as unknown as ReturnType<typeof useSurveyStore>);

const renderPage = () =>
  render(
    <HelmetProvider>
      <MemoryRouter>
        <ReviewsPage />
      </MemoryRouter>
    </HelmetProvider>,
  );

describe('ReviewsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.fetchReviewSummary).mockResolvedValue({ total: 2, average: 4.5, counts: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 1 } });
    vi.mocked(api.listReviews).mockResolvedValue([
      review({ adminReply: 'Thank you, Budi!', adminReplyAt: '2026-10-21T10:00:00Z' }),
      review({ id: 'r2', rating: 4, authorName: 'Siti A.', comment: 'Great contour lines.' }),
    ]);
    vi.mocked(api.fetchMyReview).mockResolvedValue(null);
    vi.mocked(api.submitReview).mockResolvedValue();
    vi.mocked(api.replyToReview).mockResolvedValue();
  });

  it('shows reviews and replies to visitors without an account, but no review form', async () => {
    signedInAs(null);
    renderPage();
    expect(await screen.findByText('Offline maps saved my trip!')).toBeInTheDocument();
    expect(screen.getByText('4.5')).toBeInTheDocument();
    expect(screen.getByText('Thank you, Budi!')).toBeInTheDocument();
    expect(screen.getByText(/Only Landscape 360 account holders can write a review/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Your review')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Reply')).not.toBeInTheDocument();
    expect(api.fetchMyReview).not.toHaveBeenCalled();
  });

  it('lets an account holder post a review', async () => {
    signedInAs({ id: 'u1' });
    renderPage();
    fireEvent.click(await screen.findByRole('radio', { name: '4 stars' }));
    fireEvent.change(screen.getByLabelText('Your review'), { target: { value: 'Very helpful for planning hikes.' } });
    fireEvent.click(screen.getByRole('button', { name: /Post review/ }));
    await waitFor(() => expect(api.submitReview).toHaveBeenCalledWith(4, 'Very helpful for planning hikes.'));
  });

  it('validates the rating and length before posting', async () => {
    signedInAs({ id: 'u1' });
    renderPage();
    fireEvent.change(await screen.findByLabelText('Your review'), { target: { value: 'Too short' } });
    fireEvent.click(screen.getByRole('button', { name: /Post review/ }));
    expect(await screen.findByText('Choose a rating from 1 to 5 stars')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: '5 stars' }));
    fireEvent.click(screen.getByRole('button', { name: /Post review/ }));
    expect(await screen.findByText('Write at least 10 characters')).toBeInTheDocument();
    expect(api.submitReview).not.toHaveBeenCalled();
  });

  it('shows the account holder their own review with edit and delete', async () => {
    signedInAs({ id: 'u1' });
    vi.mocked(api.fetchMyReview).mockResolvedValue({
      id: 'mine', rating: 3, comment: 'Good but needs more POIs.', isHidden: false, adminReply: null,
      createdAt: '2026-10-22T10:00:00Z', updatedAt: '2026-10-22T10:00:00Z',
    });
    renderPage();
    expect(await screen.findByText('Your review')).toBeInTheDocument();
    expect(screen.getByText('Good but needs more POIs.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Edit/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Delete/ })).toBeInTheDocument();
  });

  it('only the admin can reply', async () => {
    signedInAs({ id: 'u1' }, false);
    const { unmount } = renderPage();
    await screen.findByText('Great contour lines.');
    expect(screen.queryByTitle('Reply')).not.toBeInTheDocument();
    unmount();

    signedInAs({ id: 'admin' }, true);
    renderPage();
    const card = (await screen.findByText('Great contour lines.')).closest('article')!;
    fireEvent.click(within(card).getByTitle('Reply'));
    fireEvent.change(within(card).getByLabelText('Reply'), { target: { value: 'Thanks, Siti!' } });
    fireEvent.click(within(card).getByRole('button', { name: /Post reply/ }));
    await waitFor(() => expect(api.replyToReview).toHaveBeenCalledWith('r2', 'Thanks, Siti!'));
    expect(within(card).getByTitle('Hide from the public')).toBeInTheDocument();
  });

  it('filters by stars', async () => {
    signedInAs(null);
    renderPage();
    await screen.findByText('Offline maps saved my trip!');
    fireEvent.click(screen.getByTitle('Show 4-star reviews'));
    await waitFor(() => expect(api.listReviews).toHaveBeenLastCalledWith(4, 0));
  });
});

describe('ReviewsPage long lists', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signedInAs(null);
    vi.mocked(api.fetchReviewSummary).mockResolvedValue({ total: 25, average: 4, counts: { 1: 0, 2: 0, 3: 0, 4: 25, 5: 0 } });
    vi.mocked(api.fetchMyReview).mockResolvedValue(null);
    // A full first page, then a second page that overlaps it by one review
    const firstPage = Array.from({ length: api.REVIEWS_PAGE_SIZE }, (_, i) =>
      review({ id: `p1-${i}`, authorName: `Reviewer ${i}.` }),
    );
    const secondPage = [firstPage[19], review({ id: 'p2-0', authorName: 'Last One.' })];
    vi.mocked(api.listReviews).mockImplementation(async (_rating, offset = 0) => (offset === 0 ? firstPage : secondPage));
    // The end of the list is "on screen" as soon as it is watched
    vi.stubGlobal(
      'IntersectionObserver',
      vi.fn(function (this: unknown, callback: IntersectionObserverCallback) {
        return {
          observe: () => callback([{ isIntersecting: true } as IntersectionObserverEntry], this as IntersectionObserver),
          disconnect: vi.fn(),
        };
      }),
    );
  });

  it('loads the next page when the list is scrolled to its end, without duplicates', async () => {
    renderPage();
    expect(await screen.findByText('Last One.')).toBeInTheDocument();
    expect(api.listReviews).toHaveBeenLastCalledWith(null, api.REVIEWS_PAGE_SIZE);
    expect(screen.getAllByText('Reviewer 19.')).toHaveLength(1);
    // The second page was short, so there is nothing more to load
    expect(screen.queryByRole('button', { name: /Load more reviews/ })).not.toBeInTheDocument();
  });
});
