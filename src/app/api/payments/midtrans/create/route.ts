import { NextRequest, NextResponse } from "next/server";
import { createSnapTransaction } from "@/lib/midtrans";
import { isMidtransEnabled } from "@/lib/integration-config";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// ============================================================
// POST /api/payments/midtrans/create
// ============================================================
// Called by the storefront after checkout (when Midtrans enabled).
// Creates a Snap transaction at Midtrans → returns snap_token +
// redirect_url. The frontend uses snap_token with Snap.js
// (snap.pay(token)) or redirects to redirect_url.
//
// Body: { orderId, amount, customer?, items? }
//   orderId   — our Order.id (stored in Midtrans order_id for
//               webhook reconciliation)
//   amount    — gross amount in IDR (int)
//   customer  — { first_name, email, phone, address, city }
//   items     — [{ id, name, price, quantity }] for item_details
//
// Response: { success, token, redirect_url } or
//           { success: false, message } (caller falls back to mock)
// ============================================================

export async function POST(req: NextRequest) {
  try {
    const enabled = await isMidtransEnabled();
    if (!enabled) {
      return NextResponse.json(
        { success: false, message: "Midtrans tidak aktif. Gunakan mock payment." },
        { status: 503 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const orderId = typeof body.orderId === "string" ? body.orderId : "";
    const amount = typeof body.amount === "number" ? Math.floor(body.amount) : 0;

    if (!orderId || amount <= 0) {
      return NextResponse.json(
        { success: false, message: "orderId dan amount wajib diisi." },
        { status: 400 }
      );
    }

    // Verify the order exists + amount matches
    const order = await db.order.findUnique({
      where: { id: orderId },
      select: { id: true, trackingId: true, total: true, customerName: true, customerEmail: true, customerPhone: true, customerAddress: true, customerCity: true, itemsJson: true },
    });
    if (!order) {
      return NextResponse.json(
        { success: false, message: "Pesanan tidak ditemukan." },
        { status: 404 }
      );
    }
    if (amount !== order.total) {
      return NextResponse.json(
        { success: false, message: "Amount tidak sesuai dengan total pesanan." },
        { status: 400 }
      );
    }

    // Build Snap payload
    // Use trackingId as Midtrans order_id (shorter, customer-facing)
    // but include our internal orderId in callbacks for reconciliation.
    // Midtrans order_id must be unique per transaction. We suffix with
    // timestamp to allow retry if customer re-attempts payment.
    const midtransOrderId = `${order.trackingId}-${Date.now()}`;

    const customer = body.customer || {};
    const items = Array.isArray(body.items) ? body.items : [];

    // If items not provided, parse from order.itemsJson
    const itemDetails =
      items.length > 0
        ? items
        : (() => {
            try {
              const parsed = JSON.parse(order.itemsJson) as Array<{
                product: { id: string; name: string; price: number };
                quantity: number;
              }>;
              return parsed.map((i) => ({
                id: i.product.id,
                name: i.product.name,
                price: i.product.price,
                quantity: i.quantity,
              }));
            } catch {
              return [];
            }
          })();

    const snapPayload = {
      transaction_details: {
        order_id: midtransOrderId,
        gross_amount: amount,
      },
      customer_details: {
        first_name: customer.first_name || order.customerName,
        email: customer.email || order.customerEmail || undefined,
        phone: customer.phone || order.customerPhone || undefined,
        billing_address: {
          address: customer.address || order.customerAddress || undefined,
          city: customer.city || order.customerCity || undefined,
          phone: customer.phone || order.customerPhone || undefined,
        },
      },
      item_details: itemDetails,
      // Enable all common payment methods (customer chooses in Snap)
      enabled_payments: [
        "credit_card",
        "mandiri_clickpay",
        "cimb_clicks",
        "bca_klikbca",
        "bca_klikpay",
        "bri_epay",
        "echannel",
        "permata_va",
        "bca_va",
        "bni_va",
        "bri_va",
        "other_va",
        "gopay",
        "shopeepay",
        "indomaret",
        "alfamart",
        "akulaku",
        "qris",
      ],
      expiry: {
        unit: "hour",
        duration: 24,
      },
    };

    const result = await createSnapTransaction(snapPayload);
    if (!result) {
      return NextResponse.json(
        { success: false, message: "Gagal membuat transaksi Midtrans. Coba lagi." },
        { status: 502 }
      );
    }

    // Store midtransOrderId on Payment row for webhook reconciliation.
    // Find the payment linked to this order.
    await db.payment.updateMany({
      where: { orderId: order.id },
      data: {
        // We reuse vaNumber field to store midtrans order_id (since
        // Payment schema is gateway-agnostic). A cleaner approach
        // would add a `gatewayOrderId` field, but that's a migration.
        vaNumber: midtransOrderId,
        paymentUrl: result.redirect_url,
      },
    });

    return NextResponse.json({
      success: true,
      token: result.token,
      redirect_url: result.redirect_url,
      midtrans_order_id: midtransOrderId,
    });
  } catch (err: any) {
    console.error("[api/payments/midtrans/create] error:", err);
    return NextResponse.json(
      { success: false, message: "Server error." },
      { status: 500 }
    );
  }
}
