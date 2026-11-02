import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyAdmin, unauthorizedResponse } from "@/lib/admin-auth";
import { renderSingleCouponPdf } from "@/lib/coupon-pdf";

export const dynamic = "force-dynamic";

// ============================================================
// GET /api/admin/coupons/[id]/pdf — single coupon PDF (HTML).
// Returns text/html — open in new tab, browser prints/saves PDF.
// ============================================================

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyAdmin())) return unauthorizedResponse();
  try {
    const { id } = await params;
    const origin = new URL(req.url).origin;

    const html = await renderSingleCouponPdf(id, origin);
    return new NextResponse(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error.";
    console.error("[api/admin/coupons/[id]/pdf] error:", err);
    return NextResponse.json(
      { success: false, message: msg },
      { status: 500 }
    );
  }
}

// Also support POST (some browsers block window.open with GET
// requiring auth header — POST with body is more flexible).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyAdmin())) return unauthorizedResponse();
  try {
    const { id } = await params;
    const origin = new URL(req.url).origin;

    const html = await renderSingleCouponPdf(id, origin);
    return new NextResponse(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error.";
    console.error("[api/admin/coupons/[id]/pdf] POST error:", err);
    return NextResponse.json(
      { success: false, message: msg },
      { status: 500 }
    );
  }
}
