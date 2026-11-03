import { NextRequest, NextResponse } from "next/server";
import { validateCoupon } from "@/lib/coupons";

export const dynamic = "force-dynamic";

// ============================================================
// POST /api/coupon/validate
// ============================================================
// Customer-facing: check a coupon code against the current cart
// + customer info BEFORE checkout. Does NOT redeem (no usage
// increment). Returns discount + freeShipping flag so the UI
// can update the order summary.
//
// Body: { code, subtotal, email?, phone?, items? }
//   items: [{ itemCode, category }] for scope checks
//
// Response: { valid, message, discountAmount, freeShipping, couponCode }
// ============================================================

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const code = typeof body.code === "string" ? body.code : "";
    const subtotal = typeof body.subtotal === "number" ? body.subtotal : 0;
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() || null : null;
    const phone = typeof body.phone === "string" ? body.phone.trim() || null : null;
    const items: Array<{ itemCode?: string; category?: string }> = Array.isArray(body.items)
      ? body.items
      : [];

    if (!code) {
      return NextResponse.json(
        { valid: false, message: "Kode kupon kosong.", discountAmount: 0, freeShipping: false },
        { status: 400 }
      );
    }
    if (subtotal <= 0) {
      return NextResponse.json(
        { valid: false, message: "Subtotal tidak valid.", discountAmount: 0, freeShipping: false },
        { status: 400 }
      );
    }

    const result = await validateCoupon(code, { subtotal, email, phone, items });

    return NextResponse.json({
      valid: result.valid,
      message: result.message,
      discountAmount: result.discountAmount,
      freeShipping: result.freeShipping,
      couponCode: result.coupon?.code ?? null,
      type: result.coupon?.type ?? null,
    });
  } catch {
    return NextResponse.json(
      { valid: false, message: "Server error.", discountAmount: 0, freeShipping: false },
      { status: 500 }
    );
  }
}
