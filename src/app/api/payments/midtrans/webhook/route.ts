import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature, updatePaymentFromWebhook } from "@/lib/midtrans";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// ============================================================
// POST /api/payments/midtrans/webhook
// ============================================================
// Midtrans notification endpoint. Called by Midtrans server on
// every transaction status change (pending → settlement, expire,
// deny, etc). MUST respond 200 quickly (Midtrans retries on non-2xx).
//
// Security: verify signature_key (SHA512 of orderId + statusCode +
// grossAmount + serverKey) before trusting payload. Reject with
// 401 if mismatch (could be spoofed).
//
// Idempotent: if Payment already in target status, no-op.
//
// Setup: set this URL in Midtrans dashboard → Settings →
// Notification URLs → "Payment Notification URL"
//   https://yourdomain.com/api/payments/midtrans/webhook
// ============================================================

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      order_id: midtransOrderId,
      transaction_status: transactionStatus,
      status_code: statusCode,
      gross_amount: grossAmount,
      signature_key: signatureKey,
      transaction_id: transactionId,
    } = body as Record<string, string | undefined>;

    if (!midtransOrderId || !statusCode || !grossAmount || !signatureKey) {
      return NextResponse.json(
        { success: false, message: "Missing required fields." },
        { status: 400 }
      );
    }

    // Verify signature (security — don't trust unverified payload)
    const valid = await verifyWebhookSignature({
      orderId: midtransOrderId,
      statusCode,
      grossAmount,
      signatureKey,
    });
    if (!valid) {
      console.warn("[midtrans/webhook] invalid signature, rejecting:", midtransOrderId);
      return NextResponse.json(
        { success: false, message: "Invalid signature." },
        { status: 401 }
      );
    }

    // midtransOrderId format: "{trackingId}-{timestamp}"
    // Extract our internal orderId by looking up Payment.vaNumber
    // (we stored midtransOrderId there in /create)
    const payment = await db.payment.findFirst({
      where: { vaNumber: midtransOrderId },
      select: { orderId: true },
    });
    if (!payment) {
      console.warn("[midtrans/webhook] payment not found for midtransOrderId:", midtransOrderId);
      // Still return 200 so Midtrans doesn't retry — but log warning
      return NextResponse.json({ success: true, message: "Payment not found (no-op)." });
    }

    await updatePaymentFromWebhook({
      orderId: payment.orderId,
      midtransStatus: transactionStatus || "pending",
      transactionId,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[midtrans/webhook] error:", err);
    // Return 500 so Midtrans retries (transient error)
    return NextResponse.json(
      { success: false, message: "Server error." },
      { status: 500 }
    );
  }
}
