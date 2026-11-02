import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSalesOrder, isErpnextConfigured } from "@/lib/erpnext";
import {
  validateCoupon,
  recordCouponUsage,
  type CartLine,
} from "@/lib/coupon-service";

export const dynamic = "force-dynamic";

// ============================================================
// POST /api/checkout — place an order.
// ============================================================
// Body: {
//   items: [{productId, quantity}],
//   customer: {name, email?, phone, address},
//   couponCode?: string,
//   shippingFee: number,
// }
//
// Flow:
//   1. Validate items + stock against local DB (synced from ERPNext).
//   2. Validate + apply coupon (if provided).
//   3. Create local Order row (snapshot of cart + customer + totals).
//   4. Record coupon usage (atomic, idempotent via orderId).
//   5. Push to ERPNext (createSalesOrder) — creates Customer +
//      Address + Sales Order + Delivery Note. Coupon discount is
//      sent as discount_amount on the Sales Order (Grand Total).
//      Non-blocking: order succeeds even if ERPNext push fails
//      (admin can reconcile manually). The SO name is stored on
//      the local Order for traceability.
//   6. Decrement local stock (mirror of ERPNext Delivery Note).
//
// Returns: { orderId, total, discount, couponApplied, erpOrderName }
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

    // Validate required customer fields.
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

    // Fetch products to build cart lines + verify stock.
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

    // Apply coupon if provided.
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

    // Create local order.
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

    // Record coupon usage (idempotent via orderId check).
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

    // Push to ERPNext (non-blocking — order already saved locally).
    // Creates Customer + Address + Sales Order + Delivery Note.
    // Coupon discount sent as discount_amount on Grand Total.
    let erpOrderName: string | null = null;
    let erpMessage = "";
    if (isErpnextConfigured()) {
      try {
        const erpItems = lines
          .map((l) => {
            const p = productMap.get(l.productId);
            // itemCode is required for ERPNext items; skip lines
            // whose product has no itemCode (seed/demo products).
            if (!p?.itemCode) return null;
            return { itemCode: p.itemCode, qty: l.quantity, rate: l.price };
          })
          .filter((x): x is { itemCode: string; qty: number; rate: number } => x !== null);

        const erpResult = await createSalesOrder({
          customerName: customer.name,
          email: customer.email || "",
          phone: customer.phone,
          address: customer.address || "",
          city: customer.city || "",
          notes: appliedCouponCode
            ? `Coupon: ${appliedCouponCode} (discount Rp${discount.toLocaleString("id-ID")})`
            : undefined,
          items: erpItems,
          deliveryMethod: body.deliveryMethod || "delivery",
          paymentMethod: body.paymentMethod || "cod",
          discount,
        });

        if (erpResult.success && erpResult.salesOrderName) {
          erpOrderName = erpResult.salesOrderName;
          erpMessage = erpResult.message;
          // Persist SO name for traceability.
          await db.order.update({
            where: { id: order.id },
            data: { erpOrderName, status: "submitted" },
          });
        } else {
          erpMessage = erpResult.message;
          console.warn("[checkout] ERPNext push failed (order still saved locally):", erpMessage);
        }
      } catch (err: any) {
        erpMessage = `ERPNext push error: ${err.message}`;
        console.error("[checkout] ERPNext push error:", err);
      }
    } else {
      erpMessage = "Mode mock — ERPNext belum dikonfigurasi. Pesanan tersimpan lokal.";
    }

    // Decrement local stock (mirror of ERPNext Delivery Note).
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
      erpOrderName,
      erpNext: isErpnextConfigured(),
      message: erpMessage || undefined,
    });
  } catch (err) {
    console.error("[api/checkout] error:", err);
    return NextResponse.json(
      { success: false, message: "Server error." },
      { status: 500 }
    );
  }
}
