import { supabase } from './supabaseClient';

// Public reviews (RPCs in 20261024000007_reviews.sql). Reading works without an account;
// writing needs one; replying and hiding are admin only. Authors appear as "Rizky A.".

export const MIN_REVIEW_LENGTH = 10;
export const MAX_REVIEW_LENGTH = 2000;
export const REVIEWS_PAGE_SIZE = 20;

export interface Review {
  id: string;
  rating: number;
  comment: string;
  authorName: string;
  authorOrganization: string | null; // shown next to the name when the reviewer set one
  isMine: boolean;
  isHidden: boolean;
  adminReply: string | null;
  adminReplyAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewSummary {
  total: number;
  average: number;
  counts: Record<1 | 2 | 3 | 4 | 5, number>;
}

export interface MyReview {
  id: string;
  rating: number;
  comment: string;
  isHidden: boolean;
  adminReply: string | null;
  createdAt: string;
  updatedAt: string;
}

const fail = (error: { message: string } | null) => {
  if (error) throw new Error(error.message);
};

export const listReviews = async (rating: number | null, offset = 0): Promise<Review[]> => {
  const { data, error } = await supabase.rpc('list_reviews', {
    p_rating: rating,
    p_limit: REVIEWS_PAGE_SIZE,
    p_offset: offset,
  });
  fail(error);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    rating: Number(r.rating),
    comment: r.comment as string,
    authorName: r.author_name as string,
    // Absent until the review organization migration (20261024000011) has been run
    authorOrganization: (r.author_organization as string | null | undefined) ?? null,
    isMine: r.is_mine === true,
    isHidden: r.is_hidden === true,
    adminReply: (r.admin_reply as string | null) ?? null,
    adminReplyAt: (r.admin_reply_at as string | null) ?? null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  }));
};

export const fetchReviewSummary = async (): Promise<ReviewSummary> => {
  const { data, error } = await supabase.rpc('review_summary');
  fail(error);
  const row = ((data ?? []) as Record<string, number | string>[])[0] ?? {};
  return {
    total: Number(row.total ?? 0),
    average: Number(row.average ?? 0),
    counts: {
      1: Number(row.stars_1 ?? 0),
      2: Number(row.stars_2 ?? 0),
      3: Number(row.stars_3 ?? 0),
      4: Number(row.stars_4 ?? 0),
      5: Number(row.stars_5 ?? 0),
    },
  };
};

export const fetchMyReview = async (): Promise<MyReview | null> => {
  const { data, error } = await supabase.rpc('my_review');
  fail(error);
  const r = ((data ?? []) as Record<string, unknown>[])[0];
  if (!r) return null;
  return {
    id: r.id as string,
    rating: Number(r.rating),
    comment: r.comment as string,
    isHidden: r.is_hidden === true,
    adminReply: (r.admin_reply as string | null) ?? null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
};

export const submitReview = async (rating: number, comment: string) => {
  const { error } = await supabase.rpc('submit_review', { p_rating: rating, p_comment: comment });
  fail(error);
};

export const deleteMyReview = async () => {
  const { error } = await supabase.rpc('delete_my_review');
  fail(error);
};

// Admin only (the database rejects everyone else)
export const replyToReview = async (reviewId: string, reply: string) => {
  const { error } = await supabase.rpc('admin_reply_review', { p_review_id: reviewId, p_reply: reply });
  fail(error);
};

export const setReviewHidden = async (reviewId: string, hidden: boolean) => {
  const { error } = await supabase.rpc('admin_set_review_hidden', { p_review_id: reviewId, p_hidden: hidden });
  fail(error);
};
