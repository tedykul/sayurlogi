import { NextRequest, NextResponse } from "next/server";
import { createSalesOrder } from "@/lib/erpnext";
import { createOrder } from "@/lib/orders";
import { createPayment } from "@/lib/payments";
import { estimateDelivery } from "@/lib/delivery";
import { syncAllFromErpnext } from "@/lib/erpnext-sync";
import { validateCoupon, redeemCoupon } from "@/lib/coupons";
import { verifyCustomerAuth } from "@/lib/customer-auth";
import { notifyOrderCreated, notifyAdminNewOrder } from "@/lib/wa-notification";
import { db } from "@/lib/db";
import { calculateShipping } from "@/lib/delivery-zones";
import { bookSlot, isSchedulingEnabled } from "@/lib/delivery-slots";
import type { CheckoutPayload } from "@/types/grocery";

export const dynamic = "force-dynamic";

// ============================================================
// POST /api/checkout
// ============================================================
// Creates Sales Order in ERPNext (or mock) + Order record in
// Prisma for tracking. Optional couponCode is validated server-
// side; on success the discount is applied and the coupon is
// redeemed (usage incremented) AFTER the order is created.
// Returns trackingId for customer.
// ============================================================

export async function POST(req: NextRequest) {
  try {
    const payload: CheckoutPayload = await req.json();

    // basic validation
    if (!payload.customer?.name || !payload.customer?.phone || !payload.customer?.address) {
      return NextResponse.json(
        { success: false, message: "Nama, telepon, dan alamat wajib diisi." },
        { status: 400 }
      );
    }
    if (!payload.items?.length) {
      return NextResponse.json(
        { success: false, message: "Keranjang belanja kosong." },
        { status: 400 }
      );
    }

    // 0. Validate cart items against DB — remove stale/unpublished
    //    products (e.g. items deleted from ERPNext but still in cart).
    //    This prevents "Item not found" errors from ERPNext during
    //    Sales Order creation. Recalculate subtotal from valid items only.
    const cartItemCodes = payload.items.map((i) => i.product.itemCode).filter(Boolean);
    const validProducts = cartItemCodes.length > 0
      ? await db.product.findMany({
          where: { itemCode: { in: cartItemCodes }, published: true },
          select: { itemCode: true, price: true, name: true },
        })
      : [];
    const validProductMap = new Map(validProducts.map((p) => [p.itemCode, p]));

    // Filter payload.items: keep only those that exist + are published in DB
    const originalItemCount = payload.items.length;
    payload.items = payload.items.filter((i) => {
      const dbProduct = validProductMap.get(i.product.itemCode);
      if (!dbProduct) return false; // stale item — remove from cart
      // Update price from DB (in case cart has stale price)
      i.product.price = dbProduct.price;
      return true;
    });

    if (payload.items.length === 0) {
      return NextResponse.json(
        { success: false, message: "Produk di keranjang tidak tersedia lagi. Silakan refresh halaman dan pilih produk lain." },
        { status: 400 }
      );
    }

    // Reject items with invalid price (0 or undefined)
    const invalidPriceItems = payload.items.filter((i) => !i.product.price || i.product.price <= 0);
    if (invalidPriceItems.length > 0) {
      return NextResponse.json(
        { success: false, message: "Ada produk dengan harga tidak valid (Rp 0). Hapus dari keranjang dan coba lagi." },
        { status: 400 }
      );
    }

    const removedCount = originalItemCount - payload.items.length;
    const removedWarning = removedCount > 0
      ? ` (${removedCount} produk tidak tersedia telah dihapus dari pesanan)`
      : "";

    // 1. Calculate subtotal + shipping
    const subtotal = payload.items.reduce(
      (sum, i) => sum + i.product.price * i.quantity,
      0
    );
    const FREE_SHIPPING_THRESHOLD = 50000;
    // Shipping calculation: use zone-based for "delivery", 0 for pickup/gojek
    const baseFreeShipping =
      subtotal >= FREE_SHIPPING_THRESHOLD || payload.deliveryMethod === "pickup";
    const baseShipping = baseFreeShipping ? 0 : 9000;

    // 2. Validate coupon (if provided). Re-run server-side even
    //    though the UI already validated — never trust the client.
    let discount = 0;
    let couponCode: string | null = null;
    let couponId: string | null = null;
    let freeShipping = baseFreeShipping;

    if (payload.couponCode) {
      const result = await validateCoupon(payload.couponCode, {
        subtotal,
        email: payload.customer.email || null,
        phone: payload.customer.phone || null,
        items: payload.items.map((i) => ({
          itemCode: i.product.itemCode,
          category: i.product.category,
        })),
      });
      if (!result.valid) {
        return NextResponse.json(
          { success: false, message: `Kupon tidak valid: ${result.message}` },
          { status: 400 }
        );
      }
      discount = result.discountAmount;
      freeShipping = baseFreeShipping || result.freeShipping;
      couponCode = result.coupon?.code ?? payload.couponCode.toUpperCase();
      couponId = result.coupon?.id ?? null;
    }

    // Calculate shipping: zone-based for delivery, 0 for pickup/gojek
    const shipping = await calculateShipping({
      method: payload.deliveryMethod,
      zoneId: payload.deliveryZoneId,
      subtotal,
      defaultFee: baseShipping,
    });
    // Apply coupon free shipping if applicable
    const finalShipping = freeShipping ? 0 : shipping;
    const total = Math.max(0, subtotal - discount + finalShipping);

    // 3. Create Sales Order in ERPNext (or mock). Pass discount
    //    so ERPNext SO carries the reduced grand total.
    const erpResult = await createSalesOrder({
      customerName: payload.customer.name,
      email: payload.customer.email,
      phone: payload.customer.phone,
      address: payload.customer.address,
      city: payload.customer.city,
      notes: payload.customer.notes,
      items: payload.items.map((i) => ({
        itemCode: i.product.itemCode,
        qty: i.quantity,
        rate: i.product.price,
      })),
      deliveryMethod: payload.deliveryMethod,
      paymentMethod: payload.paymentMethod,
      discount,
    });

    if (!erpResult.success) {
      return NextResponse.json(erpResult, { status: 500 });
    }

    // 4. Estimate delivery time (default fallback)
    const estimate = estimateDelivery(payload.deliveryMethod);

    // 5. Resolve customer account (if logged in). Guest checkout
    //    still works (customerId stays null).
    const customerAuth = await verifyCustomerAuth();

    // 5b. Book delivery slot (if scheduling enabled + slot provided).
    //     Pickup orders don't need a slot. Falls back to default
    //     estimate if scheduling disabled or no slot selected.
    let deliverySlotId: string | null = null;
    let deliverySlotLabel: string | null = null;
    let estimatedDelivery = estimate.earliestDate.toISOString();

    if (payload.deliveryMethod === "delivery" && payload.deliverySlotId) {
      const schedulingEnabled = await isSchedulingEnabled();
      if (schedulingEnabled) {
        try {
          const slot = await bookSlot(payload.deliverySlotId);
          deliverySlotId = slot.id;
          deliverySlotLabel = slot.displayLabel;
          // Override estimatedDelivery with slot's end hour on slot's date
          const slotDate = new Date(slot.date + "T00:00:00");
          slotDate.setHours(slot.endHour, 0, 0, 0);
          estimatedDelivery = slotDate.toISOString();
        } catch (err: any) {
          return NextResponse.json(
            { success: false, message: `Slot tidak valid: ${err.message}` },
            { status: 400 }
          );
        }
      }
    }

    // 6. Create Order record in Prisma for tracking
    const order = await createOrder({
      customerName: payload.customer.name,
      customerEmail: payload.customer.email,
      customerPhone: payload.customer.phone,
      customerAddress: payload.customer.address,
      customerCity: payload.customer.city,
      customerNotes: payload.customer.notes,
      items: payload.items,
      subtotal,
      shipping: finalShipping,
      discount,
      couponCode,
      total,
      deliveryMethod: payload.deliveryMethod,
      paymentMethod: payload.paymentMethod,
      erpSalesOrderName: erpResult.salesOrderName,
      estimatedDelivery,
      customerId: customerAuth?.customerId,
      deliverySlotId,
      deliverySlotLabel,
      // Store delivery method + zone info in customerNotes if gojek
      customerNotes: payload.deliveryMethod === "gojek" && payload.customer.notes
        ? `[GOJEK] ${payload.customer.notes}`
        : payload.customer.notes,
    });

    // 7. Redeem coupon (best-effort, after order success).
    //    Increments usedCount + inserts CouponUsage for anti-abuse.
    if (couponId && couponCode) {
      redeemCoupon({
        couponId,
        code: couponCode,
        orderId: order.id,
        email: payload.customer.email || null,
        phone: payload.customer.phone || null,
        discount,
      }).catch((err) => {
        console.warn("[checkout] redeemCoupon failed (non-blocking):", err.message);
      });
    }

    // 7. Create payment record (mock gateway)
    const payment = await createPayment(
      order.id,
      order.trackingId,
      payload.paymentMethod,
      total
    );

    // 8. WhatsApp notification (best-effort, non-blocking). Sends
    //    order-created message to customer if WA enabled.
    notifyOrderCreated(order.id).catch((err) => {
      console.warn("[checkout] WA notifyOrderCreated failed (non-blocking):", err.message);
    });

    // 8b. WhatsApp notification to admin (best-effort, non-blocking).
    //     Fires only if admin phone configured (IntegrationConfig.wa_admin_phone).
    notifyAdminNewOrder(order.id).catch((err) => {
      console.warn("[checkout] WA notifyAdminNewOrder failed (non-blocking):", err.message);
    });

    // 9. Sync product stock from ERPNext (non-blocking, background)
    if (!erpResult.mock) {
      syncAllFromErpnext()
        .then((result) => {
          console.log(`[checkout] Post-checkout sync: ${result.synced} products updated`);
        })
        .catch((err) => {
          console.warn("[checkout] Post-checkout sync failed (non-blocking):", err.message);
        });
    }

    return NextResponse.json({
      success: true,
      message: erpResult.message + removedWarning,
      salesOrderName: erpResult.salesOrderName,
      trackingId: order.trackingId,
      orderId: order.id,
      paymentId: payment.success ? payment.paymentId : undefined,
      payment: payment.success ? {
        method: payment.method,
        status: payment.status,
        amount: payment.amount,
        vaNumber: payment.vaNumber,
        vaBank: payment.vaBank,
        paymentUrl: payment.paymentUrl,
        ewalletProvider: payment.ewalletProvider,
        message: payment.message,
      } : undefined,
      mock: erpResult.mock,
      pricing: {
        subtotal,
        discount,
        shipping,
        total,
        couponCode,
      },
      estimatedDelivery: {
        dateLabel: estimate.dateLabel,
        timeWindow: estimate.timeWindow,
        sameDay: estimate.sameDay,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message || "Server error" },
      { status: 500 }
    );
  }
}
