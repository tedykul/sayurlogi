import { NextRequest, NextResponse } from "next/server";
import { validateCoupon, type CartLine } from "@/lib/coupon-service";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

// ============================================================
// POST /api/coupons/[code]/validate
// Body: { lines: CartLine[], customer?: {email, phone}, shippingFee?: number }
// Returns: { valid, reason?, discount, freeShipping, coupon }
// Rate limited: 10 req/min/IP (anti brute-force).
// ============================================================

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;

    // Rate limit: 10 req per minute per IP
    const h = await headers();
    const ip = getClientIp(h);
    const rl = rateLimit(`coupon-validate:${ip}`, 10, 60_000);
    if (!rl.ok) {
      return NextResponse.json(
        { success: false, message: "Terlalu banyak percobaan. Coba lagi nanti." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const lines: CartLine[] = Array.isArray(body.lines) ? body.lines : [];
    const customer = body.customer ?? {};
    const shippingFee = typeof body.shippingFee === "number" ? body.shippingFee : 0;

    if (lines.length === 0) {
      return NextResponse.json(
        { success: false, message: "Keranjang kosong." },
        { status: 400 }
      );
    }

    const result = await validateCoupon(code, lines, customer, shippingFee);

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("[api/coupons/validate] error:", err);
    return NextResponse.json(
      { success: false, message: "Server error." },
      { status: 500 }
    );
  }
}
