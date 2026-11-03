import { db } from "@/lib/db";

// ============================================================
// Reviews — per-order customer review with moderation.
// ============================================================
// Grocery model: one review per order (not per product). Customer
// can submit only after the order is delivered. Admin moderates
// (pending → published | rejected) before the review shows on
// the storefront. An optional admin reply can be attached.
//
// Sub-ratings (1-5, optional): freshness, delivery, packing.
// ============================================================

export type ReviewStatus = "pending" | "published" | "rejected";

export interface OrderReview {
  id: string;
  orderId: string;
  trackingId: string;
  customerName: string;
  rating: number;
  freshnessRating: number | null;
  deliveryRating: number | null;
  packingRating: number | null;
  title: string | null;
  comment: string | null;
  status: ReviewStatus;
  adminReply: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

export interface ReviewAggregate {
  average: number;
  count: number;
  /// Count per star (1-5). Index 0 = 1 star.
  distribution: number[];
  /// Average of each sub-rating (null if no data).
  freshnessAvg: number | null;
  deliveryAvg: number | null;
  packingAvg: number | null;
}

export interface SubmitReviewInput {
  trackingId: string;
  rating: number;
  title?: string;
  comment?: string;
  freshnessRating?: number;
  deliveryRating?: number;
  packingRating?: number;
}

// ============================================================
// Submit — create a review for an order.
// ============================================================
// Validates: order exists + delivered, no existing review, rating
// 1-5, sub-ratings (if provided) 1-5. Returns the new review
// (status pending) or throws with a user-friendly message.
// ============================================================

export async function submitReview(input: SubmitReviewInput): Promise<OrderReview> {
  const trackingId = input.trackingId.trim().toUpperCase();
  if (!trackingId) {
    throw new Error("Tracking ID diperlukan.");
  }
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    throw new Error("Rating harus 1-5.");
  }
  for (const [k, v] of [
    ["freshnessRating", input.freshnessRating],
    ["deliveryRating", input.deliveryRating],
    ["packingRating", input.packingRating],
  ] as const) {
    if (v !== undefined && v !== null) {
      if (!Number.isInteger(v) || v < 1 || v > 5) {
        throw new Error(`${k} harus 1-5.`);
      }
    }
  }

  const order = await db.order.findUnique({ where: { trackingId } });
  if (!order) {
    throw new Error("Pesanan tidak ditemukan. Periksa Tracking ID Anda.");
  }
  if (order.status !== "delivered") {
    throw new Error("Pesanan belum selesai. Anda bisa review setelah pesanan diterima.");
  }

  const existing = await db.orderReview.findUnique({ where: { orderId: order.id } });
  if (existing) {
    throw new Error("Pesanan ini sudah pernah direview.");
  }

  const review = await db.orderReview.create({
    data: {
      orderId: order.id,
      trackingId: order.trackingId,
      customerName: order.customerName,
      rating: input.rating,
      freshnessRating: input.freshnessRating ?? null,
      deliveryRating: input.deliveryRating ?? null,
      packingRating: input.packingRating ?? null,
      title: input.title?.trim() || null,
      comment: input.comment?.trim() || null,
      status: "pending",
    },
  });

  return serialize(review);
}

// ============================================================
// Get review by order ID (for "already reviewed?" checks).
// ============================================================

export async function getReviewByOrderId(orderId: string): Promise<OrderReview | null> {
  const row = await db.orderReview.findUnique({ where: { orderId } });
  return row ? serialize(row) : null;
}

// ============================================================
// Get review by tracking ID.
// ============================================================

export async function getReviewByTrackingId(trackingId: string): Promise<OrderReview | null> {
  const row = await db.orderReview.findFirst({
    where: { trackingId: trackingId.toUpperCase().trim() },
  });
  return row ? serialize(row) : null;
}

// ============================================================
// Public: published reviews (for storefront) + aggregate rating.
// ============================================================

export async function getPublishedReviews(limit = 12): Promise<OrderReview[]> {
  const rows = await db.orderReview.findMany({
    where: { status: "published" },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: limit,
  });
  return rows.map(serialize);
}

export async function getReviewAggregate(): Promise<ReviewAggregate> {
  const rows = await db.orderReview.findMany({
    where: { status: "published" },
    select: { rating: true, freshnessRating: true, deliveryRating: true, packingRating: true },
  });

  if (rows.length === 0) {
    return {
      average: 0,
      count: 0,
      distribution: [0, 0, 0, 0, 0],
      freshnessAvg: null,
      deliveryAvg: null,
      packingAvg: null,
    };
  }

  const sum = rows.reduce((s, r) => s + r.rating, 0);
  const distribution = [0, 0, 0, 0, 0];
  rows.forEach((r) => {
    if (r.rating >= 1 && r.rating <= 5) distribution[r.rating - 1]++;
  });

  const avgOrNull = (arr: number[]): number | null =>
    arr.length === 0 ? null : Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 10) / 10;

  return {
    average: Math.round((sum / rows.length) * 10) / 10,
    count: rows.length,
    distribution,
    freshnessAvg: avgOrNull(rows.map((r) => r.freshnessRating).filter((v): v is number => v !== null)),
    deliveryAvg: avgOrNull(rows.map((r) => r.deliveryRating).filter((v): v is number => v !== null)),
    packingAvg: avgOrNull(rows.map((r) => r.packingRating).filter((v): v is number => v !== null)),
  };
}

// ============================================================
// Admin: list all reviews with optional status filter.
// ============================================================

export async function listReviewsForAdmin(opts: {
  status?: ReviewStatus;
  limit?: number;
} = {}): Promise<OrderReview[]> {
  const rows = await db.orderReview.findMany({
    where: opts.status ? { status: opts.status } : undefined,
    orderBy: { createdAt: "desc" },
    take: opts.limit ?? 100,
  });
  return rows.map(serialize);
}

// ============================================================
// Admin: moderate a review (publish / reject + optional reply).
// ============================================================

export async function moderateReview(
  id: string,
  opts: { status: ReviewStatus; adminReply?: string | null }
): Promise<OrderReview> {
  const existing = await db.orderReview.findUnique({ where: { id } });
  if (!existing) {
    throw new Error("Review tidak ditemukan.");
  }
  const updated = await db.orderReview.update({
    where: { id },
    data: {
      status: opts.status,
      adminReply: opts.adminReply !== undefined ? opts.adminReply : existing.adminReply,
      publishedAt: opts.status === "published" ? new Date() : null,
    },
  });
  return serialize(updated);
}

// ============================================================
// Helpers
// ============================================================

function serialize(row: {
  id: string;
  orderId: string;
  trackingId: string;
  customerName: string;
  rating: number;
  freshnessRating: number | null;
  deliveryRating: number | null;
  packingRating: number | null;
  title: string | null;
  comment: string | null;
  status: string;
  adminReply: string | null;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
}): OrderReview {
  return {
    id: row.id,
    orderId: row.orderId,
    trackingId: row.trackingId,
    customerName: row.customerName,
    rating: row.rating,
    freshnessRating: row.freshnessRating,
    deliveryRating: row.deliveryRating,
    packingRating: row.packingRating,
    title: row.title,
    comment: row.comment,
    status: normalizeStatus(row.status),
    adminReply: row.adminReply,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    publishedAt: row.publishedAt?.toISOString() ?? null,
  };
}

function normalizeStatus(s: string): ReviewStatus {
  if (s === "pending" || s === "published" || s === "rejected") return s;
  return "pending";
}
