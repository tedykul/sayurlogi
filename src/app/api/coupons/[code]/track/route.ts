import { NextRequest, NextResponse } from "next/server";
import { trackCouponClick } from "@/lib/coupon-service";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

// ============================================================
// POST /api/coupons/[code]/track
// No body required. Increments clickCount (analytics).
// Rate limited: 30 req/min/IP (one click per page-load is enough).
// Always returns 200 to not break storefront UX.
// ============================================================

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;

    const h = await headers();
    const ip = getClientIp(h);
    const rl = rateLimit(`coupon-track:${ip}`, 30, 60_000);
    if (!rl.ok) {
      return NextResponse.json({ success: true }); // silent fail
    }

    await trackCouponClick(code);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: true }); // never break storefront
  }
}
