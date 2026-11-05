import { NextRequest, NextResponse } from "next/server";
import { validateCoupon } from "@/lib/coupons";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ code: string }>;
}

// ============================================================
// POST /api/coupons/[code]/validate
// ============================================================
// Customer-facing: validate a coupon code against the current
// cart + customer BEFORE checkout. Does NOT redeem (no usage
// increment). Returns the full coupon object + computed discount
// so the UI can apply it to the cart immediately.
//
// Body: {
//   lines?: Array<{ itemCode?, category?, price, quantity }>,
//   items?: Array<{ itemCode?, category? }>,   // alternative shape
//   subtotal?: number,                         // optional, computed from lines if absent
//   shippingFee?: number,                      // informational (free_shipping discount = shippingFee)
//   email?: string,
//   phone?: string
// }
//
// Response: { valid, reason, discount, freeShipping, coupon? }
// ============================================================

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { code } = await params;
    const body = await req.json().catch(() => ({}));

    // Accept both `lines` (with price/qty) and `items` (scope-only).
    // Prefer `lines` so we can compute subtotal when not provided.
    const lines: Array<{
      itemCode?: string;
      category?: string;
      price?: number;
      quantity?: number;
    }> = Array.isArray(body.lines) ? body.lines : [];

    const items: Array<{ itemCode?: string; category?: string }> =
      Array.isArray(body.items) ? body.items : [];

    // Build the items list for scope checks (category/product).
    // Merge lines + items, preferring lines (they carry richer data).
    const scopeItems = [
      ...lines.map((l) => ({ itemCode: l.itemCode, category: l.category })),
      ...items,
    ];

    // Compute subtotal from lines if not provided explicitly.
    const subtotal =
      typeof body.subtotal === "number" && body.subtotal > 0
        ? body.subtotal
        : lines.reduce(
            (sum, l) => sum + (Number(l.price) || 0) * (Number(l.quantity) || 0),
            0
          );

    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() || null : null;
    const phone =
      typeof body.phone === "string" ? body.phone.trim() || null : null;

    const result = await validateCoupon(code, {
      subtotal,
      email,
      phone,
      items: scopeItems,
    });

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
      { valid: false, reason: "Server error.", discount: 0, freeShipping: false },
      { status: 500 }
    );
  }
}
