import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  validateCoupon,
  recordCouponUsage,
  calculateDiscount,
  type CartLine,
  type CouponType,
} from "@/lib/coupon-service";

export const dynamic = "force-dynamic";

// ============================================================
// POST /api/checkout — place an order.
// Body: {
//   items: [{productId, quantity}],
//   customer: {name, email?, phone, address},
//   couponCode?: string,
//   shippingFee: number,
// }
// Returns: { orderId, total, discount, couponApplied }
// ============================================================

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const items: { productId: string; quantity: number }[] = Array.isArray(body.items)
      ? body.items
      : [];
    const customer = body.customer ?? {};
    const couponCode = typeof body.couponCode === "string" ? body.couponCode : "";
    const shippingFee = typeof body.shippingFee === "number" ? body.shippingFee : 0;

    // Validate required customer fields
    if (!customer.name || !customer.phone) {
      return NextResponse.json(
        { success: false, message: "Nama dan nomor HP wajib diisi." },
        { status: 400 }
      );
    }
    if (items.length === 0) {
      return NextResponse.json(
        { success: false, message: "Keranjang kosong." },
        { status: 400 }
      );
    }

    // Fetch products to build cart lines + verify stock
    const products = await db.product.findMany({
      where: { id: { in: items.map((i) => i.productId) } },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    const lines: CartLine[] = [];
    for (const it of items) {
      const p = productMap.get(it.productId);
      if (!p) continue;
      if (p.stock < it.quantity) {
        return NextResponse.json(
          { success: false, message: `Stok ${p.name} tidak cukup.` },
          { status: 400 }
        );
      }
      lines.push({
        productId: p.id,
        name: p.name,
        price: p.price,
        quantity: it.quantity,
        category: p.category,
      });
    }

    const subtotal = lines.reduce((sum, l) => sum + l.price * l.quantity, 0);

    // Apply coupon if provided
    let discount = 0;
    let freeShipping = false;
    let appliedCouponId: string | null = null;
    let appliedCouponCode: string | null = null;

    if (couponCode) {
      const result = await validateCoupon(couponCode, lines, customer, shippingFee);
      if (!result.valid) {
        return NextResponse.json(
          { success: false, message: result.reason || "Kupon tidak valid." },
          { status: 400 }
        );
      }
      discount = result.discount;
      freeShipping = result.freeShipping;
      appliedCouponId = result.coupon?.id ?? null;
      appliedCouponCode = result.coupon?.code ?? null;
    }

    const effectiveShipping = freeShipping ? 0 : shippingFee;
    const total = Math.max(0, subtotal - discount) + effectiveShipping;

    // Create order
    const order = await db.order.create({
      data: {
        itemsJson: JSON.stringify(lines),
        subtotal,
        shipping: effectiveShipping,
        discount,
        total,
        customerName: customer.name,
        customerEmail: customer.email ?? null,
        customerPhone: customer.phone,
        customerAddress: customer.address ?? "",
        couponCode: appliedCouponCode,
        status: "pending",
      },
    });

    // Record coupon usage (idempotent via orderId check)
    if (appliedCouponId && appliedCouponCode) {
      await recordCouponUsage({
        couponId: appliedCouponId,
        code: appliedCouponCode,
        orderId: order.id,
        email: customer.email ?? null,
        phone: customer.phone,
        discount,
      });
    }

    // Decrement stock
    await db.$transaction(
      items.map((it) =>
        db.product.update({
          where: { id: it.productId },
          data: { stock: { decrement: it.quantity } },
        })
      )
    );

    return NextResponse.json({
      success: true,
      orderId: order.id,
      total,
      discount,
      couponApplied: appliedCouponCode,
    });
  } catch (err) {
    console.error("[api/checkout] error:", err);
    return NextResponse.json(
      { success: false, message: "Server error." },
      { status: 500 }
    );
  }
}
