import { useCallback, useEffect, useRef, useState } from "react";
import { EyeOff, Eye, Loader2, MessageSquare, Pencil, Reply, Star, Trash2, X, Check } from "lucide-react";
import { SitePageLayout } from "./SitePageLayout";
import { LoadMoreSentinel } from "./LoadMoreSentinel";
import { AuthControl } from "./AuthControl";
import { useSurveyStore } from "../store/useSurveyStore";
import {
  MAX_REVIEW_LENGTH,
  MIN_REVIEW_LENGTH,
  REVIEWS_PAGE_SIZE,
  deleteMyReview,
  fetchMyReview,
  fetchReviewSummary,
  listReviews,
  replyToReview,
  setReviewHidden,
  submitReview,
  type MyReview,
  type Review,
  type ReviewSummary,
} from "../lib/reviews";

const STAR_LABELS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

const Stars = ({ value, size = 14 }: { value: number; size?: number }) => (
  <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
    {[1, 2, 3, 4, 5].map((n) => (
      <Star
        key={n}
        size={size}
        className={n <= Math.round(value) ? "fill-gold-400 text-gold-400" : "fill-sand-200 text-sand-200"}
      />
    ))}
  </span>
);

const StarInput = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            onClick={() => onChange(n)}
            onMouseEnter={() => setHover(n)}
            className="cursor-pointer p-0.5 transition-transform hover:scale-110"
          >
            <Star size={26} className={n <= shown ? "fill-gold-400 text-gold-400" : "fill-sand-100 text-sand-300"} />
          </button>
        ))}
      </div>
      <span className="text-xs font-bold text-sand-600 w-20">{STAR_LABELS[shown]}</span>
    </div>
  );
};

// Write, edit or delete the signed-in account's review
const MyReviewForm = ({ existing, onChanged }: { existing: MyReview | null; onChanged: () => void }) => {
  const [isEditing, setIsEditing] = useState(!existing);
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [comment, setComment] = useState(existing?.comment ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating < 1) return setError("Choose a rating from 1 to 5 stars");
    if (comment.trim().length < MIN_REVIEW_LENGTH) {
      return setError(`Write at least ${MIN_REVIEW_LENGTH} characters`);
    }
    setIsSaving(true);
    setError(null);
    try {
      await submitReview(rating, comment.trim());
      setIsEditing(false);
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await deleteMyReview();
      setRating(0);
      setComment("");
      setIsEditing(true);
      setConfirmDelete(false);
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  if (existing && !isEditing) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Stars value={existing.rating} />
            <span className="text-[11px] text-sand-500">
              {existing.updatedAt !== existing.createdAt ? `Edited ${formatDate(existing.updatedAt)}` : formatDate(existing.createdAt)}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                setRating(existing.rating);
                setComment(existing.comment);
                setIsEditing(true);
              }}
              className="cursor-pointer flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-sand-100 text-sand-700 text-xs font-bold"
            >
              <Pencil size={12} /> Edit
            </button>
            {confirmDelete ? (
              <>
                <button
                  onClick={handleDelete}
                  disabled={isSaving}
                  className="cursor-pointer px-2.5 py-1.5 rounded-lg bg-brick-600 hover:bg-brick-500 text-white text-xs font-bold disabled:opacity-50"
                >
                  Delete review
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="cursor-pointer p-1.5 rounded-lg hover:bg-sand-100 text-sand-600"
                  title="Cancel"
                >
                  <X size={14} />
                </button>
              </>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="cursor-pointer flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-brick-50 text-brick-600 text-xs font-bold"
              >
                <Trash2 size={12} /> Delete
              </button>
            )}
          </div>
        </div>
        <p className="text-sm text-sand-700 whitespace-pre-wrap break-words">{existing.comment}</p>
        {existing.isHidden && (
          <p className="text-[11px] text-brick-600">
            Your review is currently not shown publicly. Contact us if you think this is a mistake.
          </p>
        )}
        {error && <p className="text-[11px] text-brick-600">{error}</p>}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <StarInput value={rating} onChange={setRating} />
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        maxLength={MAX_REVIEW_LENGTH}
        rows={4}
        placeholder="What do you like about Landscape 360, and what could be better?"
        aria-label="Your review"
        className="w-full bg-sand-50 border border-sand-200 rounded-xl px-4 py-3 text-sm text-ink placeholder:text-sand-400 outline-none focus:border-forest-300 focus:ring-1 focus:ring-forest-300 resize-y"
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-sand-500">
          {comment.trim().length}/{MAX_REVIEW_LENGTH} · shown with your first name and last initial
        </span>
        <div className="flex gap-2">
          {existing && (
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="cursor-pointer px-3 py-2 rounded-lg bg-sand-50 hover:bg-sand-100 text-sand-700 text-xs"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={isSaving}
            className="cursor-pointer flex items-center gap-1.5 px-4 py-2 rounded-lg bg-forest-800 hover:bg-forest-700 text-white text-xs font-bold disabled:opacity-50"
          >
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {existing ? "Update review" : "Post review"}
          </button>
        </div>
      </div>
      {error && <p className="text-[11px] text-brick-600">{error}</p>}
    </form>
  );
};

// One review, with the admin's reply and (for the admin) reply/hide controls
const ReviewCard = ({ review, isAdmin, onChanged }: { review: Review; isAdmin: boolean; onChanged: () => void }) => {
  const [isReplying, setIsReplying] = useState(false);
  const [reply, setReply] = useState(review.adminReply ?? "");
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<void>) => {
    setIsBusy(true);
    setError(null);
    try {
      await action();
      setIsReplying(false);
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <article
      className={`p-5 rounded-2xl border ${review.isHidden ? "border-brick-200 bg-brick-50/40" : review.isMine ? "border-gold-200 bg-gold-50/40" : "border-sand-200 bg-white"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full bg-forest-800 text-white flex items-center justify-center text-sm font-bold shrink-0">
            {review.authorName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-ink truncate flex items-center gap-2">
              {review.authorName}
              {review.isMine && <span className="text-[9px] px-1.5 py-0.5 rounded bg-gold-100 text-gold-700">You</span>}
              {review.isHidden && <span className="text-[9px] px-1.5 py-0.5 rounded bg-brick-100 text-brick-600">Hidden</span>}
            </div>
            <div className="flex items-center gap-2">
              <Stars value={review.rating} size={12} />
              <span className="text-[11px] text-sand-500">
                {formatDate(review.createdAt)}
                {review.updatedAt !== review.createdAt && " · edited"}
              </span>
            </div>
          </div>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setIsReplying((v) => !v)}
              className="cursor-pointer p-1.5 rounded-lg hover:bg-sand-100 text-sand-600 hover:text-ink"
              title={review.adminReply ? "Edit reply" : "Reply"}
            >
              <Reply size={14} />
            </button>
            <button
              onClick={() => run(() => setReviewHidden(review.id, !review.isHidden))}
              disabled={isBusy}
              className="cursor-pointer p-1.5 rounded-lg hover:bg-sand-100 text-sand-600 hover:text-ink disabled:opacity-50"
              title={review.isHidden ? "Show publicly" : "Hide from the public"}
            >
              {review.isHidden ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>
          </div>
        )}
      </div>

      <p className="mt-3 text-sm text-sand-700 leading-relaxed whitespace-pre-wrap break-words">{review.comment}</p>

      {review.adminReply && !isReplying && (
        <div className="mt-4 ml-4 pl-4 border-l-2 border-forest-300">
          <div className="text-[11px] font-bold text-forest-700 flex items-center gap-1.5">
            <MessageSquare size={12} /> Reply from Landscape 360
            {review.adminReplyAt && <span className="font-normal text-sand-500">· {formatDate(review.adminReplyAt)}</span>}
          </div>
          <p className="text-sm text-sand-700 mt-1 whitespace-pre-wrap break-words">{review.adminReply}</p>
        </div>
      )}

      {isAdmin && isReplying && (
        <div className="mt-4 space-y-2">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            maxLength={MAX_REVIEW_LENGTH}
            rows={3}
            autoFocus
            placeholder="Write a public reply as Landscape 360"
            aria-label="Reply"
            className="w-full bg-sand-50 border border-sand-200 rounded-xl px-3 py-2 text-sm text-ink outline-none focus:border-forest-300 resize-y"
          />
          <div className="flex justify-end gap-2">
            {review.adminReply && (
              <button
                onClick={() => run(() => replyToReview(review.id, ""))}
                disabled={isBusy}
                className="cursor-pointer px-3 py-1.5 rounded-lg hover:bg-brick-50 text-brick-600 text-xs font-bold disabled:opacity-50"
              >
                Remove reply
              </button>
            )}
            <button
              onClick={() => setIsReplying(false)}
              className="cursor-pointer px-3 py-1.5 rounded-lg bg-sand-50 hover:bg-sand-100 text-sand-700 text-xs"
            >
              Cancel
            </button>
            <button
              onClick={() => run(() => replyToReview(review.id, reply))}
              disabled={isBusy || !reply.trim()}
              className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-forest-800 hover:bg-forest-700 text-white text-xs font-bold disabled:opacity-50"
            >
              {isBusy ? <Loader2 size={12} className="animate-spin" /> : <Reply size={12} />} Post reply
            </button>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-[11px] text-brick-600">{error}</p>}
    </article>
  );
};

export const ReviewsPage = () => {
  const { user, isAdmin } = useSurveyStore();
  const userId = user?.id ?? null;

  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [filter, setFilter] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [myReview, setMyReview] = useState<MyReview | null>(null);
  const [myReviewLoaded, setMyReviewLoaded] = useState(false);

  // The filter a response belongs to; pages for an older filter are dropped
  const filterRef = useRef(filter);
  const loadingMoreRef = useRef(false);

  const load = useCallback(async () => {
    filterRef.current = filter;
    setIsLoading(true);
    setError(null);
    try {
      const [s, list, mine] = await Promise.all([
        fetchReviewSummary(),
        listReviews(filter, 0),
        userId ? fetchMyReview() : Promise.resolve(null),
      ]);
      setSummary(s);
      setReviews(list);
      setHasMore(list.length === REVIEWS_PAGE_SIZE);
      setMyReview(mine);
      setMyReviewLoaded(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [filter, userId]);

  useEffect(() => {
    load();
    // isAdmin changes what the list contains (hidden reviews)
  }, [load, isAdmin]);

  // Next page, loaded as the list is scrolled to its end (or with the button)
  const loadMore = async () => {
    if (!hasMore || loadingMoreRef.current || isLoading) return;
    const requested = filter;
    loadingMoreRef.current = true;
    setIsLoadingMore(true);
    try {
      const next = await listReviews(requested, reviews.length);
      if (filterRef.current !== requested) return;
      setReviews((prev) => {
        // Offsets can overlap when reviews are added meanwhile
        const seen = new Set(prev.map((r) => r.id));
        return [...prev, ...next.filter((r) => !seen.has(r.id))];
      });
      setHasMore(next.length === REVIEWS_PAGE_SIZE);
    } catch (err) {
      if (filterRef.current === requested) setError((err as Error).message);
    } finally {
      loadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  };

  const maxCount = summary ? Math.max(1, ...Object.values(summary.counts)) : 1;

  return (
    <SitePageLayout
      title="Reviews"
      subtitle="What explorers say about Landscape 360"
      icon={Star}
      path="/reviews"
      seoDescription="Read reviews of Landscape 360 from hikers, climbers and outdoor teams, and share your own experience."
      headerAction={<AuthControl />}
    >
      <div className="grid md:grid-cols-[260px_1fr] gap-8">
        {/* Summary */}
        <aside className="space-y-4">
          <div className="p-5 rounded-2xl border border-sand-200 bg-sand-50 text-center">
            <div className="text-5xl font-bold text-ink">{summary ? summary.average.toFixed(1) : "–"}</div>
            <div className="mt-2 flex justify-center">
              <Stars value={summary?.average ?? 0} size={18} />
            </div>
            <div className="text-xs text-sand-500 mt-2">
              {summary ? `${summary.total} review${summary.total === 1 ? "" : "s"}` : "Loading..."}
            </div>
          </div>
          {summary && (
            <div className="space-y-1.5">
              {([5, 4, 3, 2, 1] as const).map((n) => (
                <button
                  key={n}
                  onClick={() => setFilter(filter === n ? null : n)}
                  className={`cursor-pointer w-full flex items-center gap-2 px-2 py-1 rounded-lg text-xs transition-colors ${filter === n ? "bg-gold-50 ring-1 ring-gold-300" : "hover:bg-sand-50"}`}
                  aria-pressed={filter === n}
                  title={filter === n ? "Show all reviews" : `Show ${n}-star reviews`}
                >
                  <span className="w-8 text-right font-bold text-sand-700">{n}★</span>
                  <span className="flex-1 h-2 bg-sand-200 rounded-full overflow-hidden">
                    <span
                      className="block h-full bg-gold-400 rounded-full"
                      style={{ width: `${(summary.counts[n] / maxCount) * 100}%` }}
                    />
                  </span>
                  <span className="w-6 text-left text-sand-500">{summary.counts[n]}</span>
                </button>
              ))}
            </div>
          )}
        </aside>

        <div className="space-y-6 min-w-0">
          {/* Write a review */}
          <section className="p-5 rounded-2xl border border-forest-200 bg-forest-50/40">
            <h2 className="text-sm font-bold text-ink mb-3">{myReview ? "Your review" : "Write a review"}</h2>
            {!user ? (
              <p className="text-sm text-sand-600">
                Only Landscape 360 account holders can write a review. Use{" "}
                <strong>Sign In / Register</strong> at the top of this page to sign in, or request
                an account there.
              </p>
            ) : !myReviewLoaded ? (
              <div className="flex items-center gap-2 text-xs text-sand-500">
                <Loader2 size={14} className="animate-spin" /> Loading...
              </div>
            ) : (
              <MyReviewForm key={myReview?.updatedAt ?? "new"} existing={myReview} onChanged={load} />
            )}
          </section>

          {/* List */}
          <section className="space-y-3" aria-live="polite">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-ink">
                {filter ? `${filter}-star reviews` : "All reviews"}
              </h2>
              {filter && (
                <button onClick={() => setFilter(null)} className="cursor-pointer text-xs text-forest-700 hover:underline">
                  Show all
                </button>
              )}
            </div>

            {error && (
              <div className="p-3 rounded-xl border border-brick-200 bg-brick-50 text-xs text-brick-600">{error}</div>
            )}

            {isLoading && reviews.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-sand-500">
                <Loader2 size={16} className="animate-spin" /> Loading reviews...
              </div>
            ) : reviews.length === 0 ? (
              <div className="py-12 text-center text-sm text-sand-500">
                {filter ? "No reviews with this rating yet." : "No reviews yet. Be the first to share your experience!"}
              </div>
            ) : (
              reviews.map((r) => <ReviewCard key={`${r.id}-${r.updatedAt}-${r.adminReplyAt}-${r.isHidden}`} review={r} isAdmin={isAdmin} onChanged={load} />)
            )}

            {hasMore && !isLoading && <LoadMoreSentinel onVisible={loadMore} disabled={isLoadingMore} />}
            {hasMore && (
              <div className="flex justify-center pt-2">
                <button
                  onClick={loadMore}
                  disabled={isLoadingMore}
                  className="cursor-pointer flex items-center gap-2 px-4 py-2 rounded-xl border border-sand-200 hover:bg-sand-50 text-sm font-bold text-sand-700 disabled:opacity-50"
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Loading more reviews...
                    </>
                  ) : (
                    "Load more reviews"
                  )}
                </button>
              </div>
            )}
          </section>
        </div>
      </div>
    </SitePageLayout>
  );
};
