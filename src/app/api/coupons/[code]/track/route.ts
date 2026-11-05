import { NextRequest, NextResponse } from "next/server";
import { trackCouponClick } from "@/lib/coupon-service";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ code: string }>;
}

// ============================================================
// POST /api/coupons/[code]/track
// ============================================================
// Increments clickCount when ?coupon=CODE link is opened.
// Best-effort: never fails, always returns 200.
// ============================================================

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { code } = await params;
    await trackCouponClick(code);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: true }); // silent fail
  }
}
