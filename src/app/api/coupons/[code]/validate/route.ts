import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateCoupon } from "@/lib/coupons";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ code: string }>;
}

// ============================================================
// POST /api/coupons/[code]/validate
// ============================================================
// Body: { lines: CartLine[], shippingFee: number }
// Returns: { valid, reason?, discount, freeShipping, coupon? }
// ============================================================

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { code } = await params;
    const body = await req.json().catch(() => ({}));
    const lines = Array.isArray(body.lines) ? body.lines : [];
    const shippingFee = typeof body.shippingFee === "number" ? body.shippingFee : 0;

    const result = await validateCoupon(
      code,
      lines,
      { email: body.email, phone: body.phone },
      shippingFee
    );

    return NextResponse.json({
      valid: result.valid,
      reason: result.message,
      discount: result.discountAmount,
      freeShipping: result.freeShipping,
      coupon: result.coupon,
    });
  } catch (err: any) {
    console.error("[api/coupons/[code]/validate] error:", err);
    return NextResponse.json(
      { success: false, message: "Server error." },
      { status: 500 }
    );
  }
}
