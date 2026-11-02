import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin, unauthorizedResponse } from "@/lib/admin-auth";
import { renderBatchCouponPdf } from "@/lib/coupon-pdf";

export const dynamic = "force-dynamic";

// ============================================================
// POST /api/admin/coupons/export-pdf — batch PDF (HTML).
// Body: { ids: string[] } OR { batchId: string }
// Returns text/html — grid of coupons for print/save-as-PDF.
// ============================================================

export async function POST(req: NextRequest) {
  if (!(await verifyAdmin())) return unauthorizedResponse();
  try {
    const body = await req.json().catch(() => ({}));
    const origin = new URL(req.url).origin;

    let ids: string[] = [];
    if (Array.isArray(body.ids)) {
      ids = body.ids.filter((x: unknown) => typeof x === "string");
    }
    // If batchId given, we'd need to fetch by batchId — pass through
    // to renderer by accepting batchId param too.
    if (ids.length === 0 && typeof body.batchId === "string") {
      // Re-use renderer with a special fetch-by-batchId
      const html = await renderBatchCouponPdfByBatchId(body.batchId, origin);
      return new NextResponse(html, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    if (ids.length === 0) {
      return NextResponse.json(
        { success: false, message: "ids[] atau batchId wajib diisi." },
        { status: 400 }
      );
    }

    const html = await renderBatchCouponPdf(ids, origin);
    return new NextResponse(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error.";
    console.error("[api/admin/coupons/export-pdf] error:", err);
    return NextResponse.json(
      { success: false, message: msg },
      { status: 500 }
    );
  }
}

// ------------------------------------------------------------
// Helper: render batch PDF by batchId (instead of explicit ids).
// ------------------------------------------------------------
import { db } from "@/lib/db";
async function renderBatchCouponPdfByBatchId(batchId: string, origin: string) {
  const coupons = await db.coupon.findMany({
    where: { batchId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (coupons.length === 0) throw new Error("Batch tidak ditemukan.");
  return renderBatchCouponPdf(coupons.map((c) => c.id), origin);
}
