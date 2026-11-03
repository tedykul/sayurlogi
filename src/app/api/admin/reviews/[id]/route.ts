import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/audit";
import { moderateReview, type ReviewStatus } from "@/lib/reviews";

export const dynamic = "force-dynamic";

// ============================================================
// PUT /api/admin/reviews/[id] — moderate a review.
// ============================================================
// Body: { status: "published" | "rejected" | "pending",
//         adminReply?: string | null }
//
// Sets publishedAt when status becomes "published", clears it
// otherwise. adminReply is optional (pass null to clear).
// ============================================================

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const status: ReviewStatus | undefined =
      body.status === "published" || body.status === "rejected" || body.status === "pending"
        ? body.status
        : undefined;
    if (!status) {
      return NextResponse.json({ success: false, message: "Status tidak valid." }, { status: 400 });
    }

    const adminReply =
      body.adminReply === null || typeof body.adminReply === "string"
        ? body.adminReply
        : undefined;

    const review = await moderateReview(id, { status, adminReply });

    await logAdminAction({
      action: "review_moderate",
      target: `review:${id}`,
      success: true,
      detail: `status=${status}`,
    });

    return NextResponse.json({ success: true, review });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message || "Server error." },
      { status: 500 }
    );
  }
}

// ============================================================
// DELETE — not supported (reviews are retained for audit).
// Use status "rejected" to hide a review from the storefront.
// ============================================================
export async function DELETE() {
  return NextResponse.json(
    { success: false, message: "Review tidak bisa dihapus. Set status 'rejected' untuk sembunyikan." },
    { status: 405 }
  );
}
