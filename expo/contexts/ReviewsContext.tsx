import createContextHook from '@nkzw/create-context-hook';
import { useState, useCallback, useMemo, useEffect } from 'react';
import { auth, callable } from '@/lib/firebase';

export interface CustomerReview {
  id: string;
  orderId: string;
  publicOrderId: string;
  vendorId: string;
  vendorName: string;
  stars: number;
  feedback?: string;
  itemRatings?: Record<string, 'good' | 'bad'>;
  /** Absent for real vendor data — a vendor must never see when a rating was
   * submitted, not even to the month, since with few enough orders in a
   * period the timing alone can identify the customer. Present only on the
   * seeded demo/mock reviews below, which are not real privacy-sensitive data. */
  submittedAt?: string;
  orderReference: string;
  /** Privacy-safe display reference shown to vendors. Never exposes real order ID. */
  reviewRef: string;
  /** Whether the vendor has opened/read this review */
  readByVendor: boolean;
}

export interface VendorRatingStats {
  average: number;
  total: number;
  breakdown: { stars: number; count: number; percentage: number }[];
}

const seedReviews: CustomerReview[] = [
  {
    id: 'r1',
    orderId: 'seed-1',
    publicOrderId: 'spicyrest-28471',
    vendorId: 'v1',
    vendorName: 'Spicy Restaurant',
    stars: 5,
    orderReference: '#2847',
    reviewRef: 'R-7F2K',
    readByVendor: false,
    submittedAt: new Date(2025, 9, 28).toISOString(),
  },
  {
    id: 'r2',
    orderId: 'seed-2',
    publicOrderId: 'spicyrest-28321',
    vendorId: 'v1',
    vendorName: 'Spicy Restaurant',
    stars: 4,
    feedback: 'Great service, but the delivery was a bit slow.',
    orderReference: '#2832',
    reviewRef: 'R-91XA',
    readByVendor: false,
    submittedAt: new Date(2025, 9, 25).toISOString(),
  },
  {
    id: 'r3',
    orderId: 'seed-3',
    publicOrderId: 'spicyrest-28191',
    vendorId: 'v1',
    vendorName: 'Spicy Restaurant',
    stars: 5,
    orderReference: '#2819',
    reviewRef: 'R-3QPL',
    readByVendor: false,
    submittedAt: new Date(2025, 9, 22).toISOString(),
  },
  {
    id: 'r4',
    orderId: 'seed-4',
    publicOrderId: 'spicyrest-28031',
    vendorId: 'v1',
    vendorName: 'Spicy Restaurant',
    stars: 5,
    feedback: 'Everything was perfect!',
    orderReference: '#2803',
    reviewRef: 'R-M5BJ',
    readByVendor: true,
    submittedAt: new Date(2025, 9, 20).toISOString(),
  },
  {
    id: 'r5',
    orderId: 'seed-5',
    publicOrderId: 'spicyrest-27911',
    vendorId: 'v1',
    vendorName: 'Spicy Restaurant',
    stars: 4,
    orderReference: '#2791',
    reviewRef: 'R-4NW8',
    readByVendor: true,
    submittedAt: new Date(2025, 9, 18).toISOString(),
  },
  {
    id: 'r6',
    orderId: 'seed-6',
    publicOrderId: 'spicyrest-27761',
    vendorId: 'v1',
    vendorName: 'Spicy Restaurant',
    stars: 5,
    orderReference: '#2776',
    reviewRef: 'R-C2HE',
    readByVendor: true,
    submittedAt: new Date(2025, 9, 15).toISOString(),
  },
  {
    id: 'r7',
    orderId: 'seed-7',
    publicOrderId: 'spicyrest-27641',
    vendorId: 'v1',
    vendorName: 'Spicy Restaurant',
    stars: 5,
    feedback: 'Amazing quality and fast service.',
    orderReference: '#2764',
    reviewRef: 'R-8VT6',
    readByVendor: true,
    submittedAt: new Date(2025, 8, 12).toISOString(),
  },
  {
    id: 'r8',
    orderId: 'seed-8',
    publicOrderId: 'spicyrest-27511',
    vendorId: 'v1',
    vendorName: 'Spicy Restaurant',
    stars: 3,
    feedback: 'Order was okay but could be improved.',
    orderReference: '#2751',
    reviewRef: 'R-KD3R',
    readByVendor: true,
    submittedAt: new Date(2025, 8, 10).toISOString(),
  },
  {
    id: 'r9',
    orderId: 'seed-9',
    publicOrderId: 'spicyrest-27381',
    vendorId: 'v1',
    vendorName: 'Spicy Restaurant',
    stars: 5,
    orderReference: '#2738',
    reviewRef: 'R-2LP9',
    readByVendor: true,
    submittedAt: new Date(2025, 8, 8).toISOString(),
  },
  {
    id: 'r10',
    orderId: 'seed-10',
    publicOrderId: 'spicyrest-27251',
    vendorId: 'v1',
    vendorName: 'Spicy Restaurant',
    stars: 4,
    orderReference: '#2725',
    reviewRef: 'R-5GX1',
    readByVendor: true,
    submittedAt: new Date(2025, 8, 5).toISOString(),
  },
  {
    id: 'r11',
    orderId: 'seed-11',
    publicOrderId: 'spicyrest-27121',
    vendorId: 'v1',
    vendorName: 'Spicy Restaurant',
    stars: 5,
    orderReference: '#2712',
    reviewRef: 'R-9JM4',
    readByVendor: true,
    submittedAt: new Date(2025, 7, 30).toISOString(),
  },
  {
    id: 'r12',
    orderId: 'seed-12',
    publicOrderId: 'spicyrest-26991',
    vendorId: 'v1',
    vendorName: 'Spicy Restaurant',
    stars: 5,
    feedback: 'Excellent experience overall.',
    orderReference: '#2699',
    reviewRef: 'R-BF7Z',
    readByVendor: true,
    submittedAt: new Date(2025, 7, 28).toISOString(),
  },
];

function computeStats(reviews: CustomerReview[]): VendorRatingStats {
  if (reviews.length === 0) {
    return {
      average: 0,
      total: 0,
      breakdown: [5, 4, 3, 2, 1].map((s) => ({ stars: s, count: 0, percentage: 0 })),
    };
  }
  const total = reviews.length;
  const sum = reviews.reduce((acc, r) => acc + r.stars, 0);
  const average = Math.round((sum / total) * 10) / 10;
  const breakdown = [5, 4, 3, 2, 1].map((s) => {
    const count = reviews.filter((r) => r.stars === s).length;
    return { stars: s, count, percentage: Math.round((count / total) * 100) };
  });
  return { average, total, breakdown };
}

/** Generate a privacy-safe review ref for newly submitted reviews */
export function generateReviewRef(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = 'R-';
  for (let i = 0; i < 4; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

interface VendorFacingRatingResponse {
  ratingId: string;
  displayId: string;
  stars: number;
  privateFeedback: string | null;
  hasPrivateFeedback: boolean;
  readByVendor: boolean;
}

/**
 * Maps the vendor-facing projection getVendorRatings returns onto the local
 * CustomerReview shape this screen set already uses. orderId/publicOrderId/
 * vendorName/submittedAt are intentionally blank — the backend never sends
 * any of them to a vendor client (that is the whole point of the projection:
 * a vendor can see that they were rated, not which order or customer it came
 * from, or when), and nothing in these screens should read those fields for
 * the vendor's own ratings view.
 */
function fromBackendRating(r: VendorFacingRatingResponse, vendorId: string): CustomerReview {
  return {
    id: r.ratingId,
    orderId: '',
    publicOrderId: '',
    vendorId,
    vendorName: '',
    stars: r.stars,
    feedback: r.privateFeedback ?? undefined,
    orderReference: '',
    reviewRef: r.displayId,
    readByVendor: r.readByVendor,
  };
}

/**
 * 'checking' / 'loading' — a signed-in vendor's real ratings haven't
 * resolved yet. 'error' — the real fetch failed. Vendor-own screens must
 * treat all three as "not ready" and never fall through to seedReviews,
 * which would otherwise silently show a vendor twelve fake five-star
 * reviews with no indication they aren't real. 'not_vendor' / 'ready' are
 * the two states where `reviews` is trustworthy to render — the former for
 * the public storefront view (fixtures are the intended content there),
 * the latter for a vendor's own real data.
 */
export type RatingsStatus = 'checking' | 'loading' | 'ready' | 'error' | 'not_vendor';

export const [ReviewsProvider, useReviews] = createContextHook(() => {
  const [reviews, setReviews] = useState<CustomerReview[]>(seedReviews);
  const [realRatingsVendorId, setRealRatingsVendorId] = useState<string | null>(null);
  const [ratingsStatus, setRatingsStatus] = useState<RatingsStatus>('checking');

  /**
   * Live-ish load of the signed-in vendor's own ratings.
   *
   * getVendorRatings has been deployed since Phase 4 and nothing called it —
   * this screen showed twelve fixture reviews for "Spicy Restaurant" to every
   * vendor, seeded once and never touched again, regardless of whether that
   * vendor had ever received a real rating.
   *
   * Only fetched for a real signed-in vendor; a customer viewing another
   * vendor's storefront reviews (a different, public-facing screen) keeps
   * reading the local fixtures below, since getVendorRatings is vendor-only
   * by design and cannot serve that view.
   */
  useEffect(() => {
    const unsubscribe = auth.onIdTokenChanged(async (user) => {
      if (!user) {
        setRealRatingsVendorId(null);
        setRatingsStatus('not_vendor');
        return;
      }
      const token = await user.getIdTokenResult();
      const vendorId = token.claims.vendorId as string | undefined;
      const role = token.claims.role as string | undefined;
      if (!vendorId || role !== 'vendor') {
        setRealRatingsVendorId(null);
        setRatingsStatus('not_vendor');
        return;
      }

      setRatingsStatus('loading');
      try {
        const getRatings = callable<Record<string, never>, { success: true; ratings: VendorFacingRatingResponse[] }>(
          'getVendorRatings',
        );
        const res = await getRatings({});
        setReviews(res.data.ratings.map((r) => fromBackendRating(r, vendorId)));
        setRealRatingsVendorId(vendorId);
        setRatingsStatus('ready');
      } catch (error) {
        console.error('[ReviewsContext] getVendorRatings failed:', error);
        setRatingsStatus('error');
      }
    });
    return unsubscribe;
  }, []);

  const submitReview = useCallback((review: CustomerReview) => {
    console.log('[ReviewsContext] Submitting review:', review.id, 'stars:', review.stars);
    setReviews((prev) => [review, ...prev]);
  }, []);

  const markReviewRead = useCallback((id: string) => {
    // getVendorRatings marks every unread rating as read the moment the
    // vendor fetches the list — by the time `reviews` holds real data, the
    // backend has already flipped this. Kept as a local optimistic update
    // for the seed/fixture path so the demo behaviour is unchanged.
    setReviews((prev) =>
      prev.map((r) => (r.id === id && !r.readByVendor ? { ...r, readByVendor: true } : r))
    );
  }, []);

  const getVendorReviews = useCallback(
    (vendorId: string): CustomerReview[] => {
      if (realRatingsVendorId) return reviews;
      return reviews.filter((r) => r.vendorId === vendorId);
    },
    [reviews, realRatingsVendorId]
  );

  const getReviewById = useCallback(
    (id: string): CustomerReview | undefined => {
      return reviews.find((r) => r.id === id);
    },
    [reviews]
  );

  const getVendorRatingStats = useCallback(
    (vendorId: string): VendorRatingStats => {
      const scoped = realRatingsVendorId ? reviews : reviews.filter((r) => r.vendorId === vendorId);
      return computeStats(scoped);
    },
    [reviews, realRatingsVendorId]
  );

  const hasReviewForOrder = useCallback(
    (orderId: string): boolean => {
      return reviews.some((r) => r.orderId === orderId);
    },
    [reviews]
  );

  return useMemo(
    () => ({
      reviews,
      ratingsStatus,
      submitReview,
      markReviewRead,
      getVendorReviews,
      getReviewById,
      getVendorRatingStats,
      hasReviewForOrder,
    }),
    [reviews, ratingsStatus, submitReview, markReviewRead, getVendorReviews, getReviewById, getVendorRatingStats, hasReviewForOrder]
  );
});
