import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/audit";
import { listReviewsForAdmin, moderateReview, type ReviewStatus } from "@/lib/reviews";

export const dynamic = "force-dynamic";

// ============================================================
// GET /api/admin/reviews — list all reviews (admin).
// ============================================================
// Query: ?status=pending|published|rejected (optional filter)
// ============================================================

export async function GET(req: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }
  try {
    const url = new URL(req.url);
    const statusParam = url.searchParams.get("status");
    const status: ReviewStatus | undefined =
      statusParam === "pending" || statusParam === "published" || statusParam === "rejected"
        ? statusParam
        : undefined;

    const reviews = await listReviewsForAdmin({ status, limit: 200 });

    // Aggregate counts per status for the admin UI tabs.
    const counts = await db.orderReview.groupBy({
      by: ["status"],
      _count: { status: true },
    });
    const countMap: Record<string, number> = {};
    counts.forEach((c) => {
      countMap[c.status] = c._count.status;
    });

    return NextResponse.json({ success: true, reviews, counts: countMap });
  } catch (err) {
    console.error("[api/admin/reviews] GET error:", err);
    return NextResponse.json({ success: false, message: "Server error." }, { status: 500 });
  }
}

// ============================================================
// POST /api/admin/reviews — bulk not used; placeholder for
// future actions. Kept for API symmetry.
// ============================================================
export async function POST() {
  return NextResponse.json({ success: false, message: "Not implemented." }, { status: 405 });
}
