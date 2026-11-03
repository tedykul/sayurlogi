import { NextRequest, NextResponse } from "next/server";
import { getPublishedReviews, getReviewAggregate } from "@/lib/reviews";

export const dynamic = "force-dynamic";

// ============================================================
// GET /api/reviews — public published reviews + aggregate.
// ============================================================
// Query params:
//   limit (default 12, max 50)
//   aggregate=true (include aggregate rating in response)
//
// Returns { success, reviews, aggregate? }
// ============================================================

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const limitParam = parseInt(url.searchParams.get("limit") || "12", 10);
    const limit = Math.max(1, Math.min(50, isNaN(limitParam) ? 12 : limitParam));
    const includeAggregate = url.searchParams.get("aggregate") !== "false";

    const reviews = await getPublishedReviews(limit);
    const aggregate = includeAggregate ? await getReviewAggregate() : undefined;

    return NextResponse.json({ success: true, reviews, aggregate });
  } catch {
    return NextResponse.json({ success: false, message: "Server error." }, { status: 500 });
  }
}
