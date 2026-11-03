import { NextRequest, NextResponse } from "next/server";
import { submitReview, getReviewByTrackingId } from "@/lib/reviews";

export const dynamic = "force-dynamic";

// ============================================================
// POST /api/orders/[trackingId]/review
// ============================================================
// Customer submits a review for a delivered order. Validates:
//   - order exists + status = "delivered"
//   - no existing review for this order
//   - rating 1-5, sub-ratings (if provided) 1-5
// Returns the new review (status "pending" until admin moderates).
// ============================================================

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ trackingId: string }> }
) {
  try {
    const { trackingId } = await params;
    const body = await req.json().catch(() => ({}));

    const rating = typeof body.rating === "number" ? Math.floor(body.rating) : 0;
    const title = typeof body.title === "string" ? body.title : undefined;
    const comment = typeof body.comment === "string" ? body.comment : undefined;
    const freshnessRating = typeof body.freshnessRating === "number" ? body.freshnessRating : undefined;
    const deliveryRating = typeof body.deliveryRating === "number" ? body.deliveryRating : undefined;
    const packingRating = typeof body.packingRating === "number" ? body.packingRating : undefined;

    const review = await submitReview({
      trackingId,
      rating,
      title,
      comment,
      freshnessRating,
      deliveryRating,
      packingRating,
    });

    return NextResponse.json({ success: true, review });
  } catch (err: any) {
    const message = err.message || "Gagal submit review.";
    const status = /tidak ditemukan|belum selesai|sudah pernah|diperlukan|harus/.test(message)
      ? 400
      : 500;
    return NextResponse.json({ success: false, message }, { status });
  }
}

// ============================================================
// GET /api/orders/[trackingId]/review
// ============================================================
// Returns the existing review for an order (if any). Used by
// the storefront to decide whether to show the form or a
// "sudah direview" notice.
// ============================================================

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ trackingId: string }> }
) {
  try {
    const { trackingId } = await params;
    const review = await getReviewByTrackingId(trackingId);
    return NextResponse.json({ success: true, review });
  } catch {
    return NextResponse.json({ success: false, message: "Server error." }, { status: 500 });
  }
}
