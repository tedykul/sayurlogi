import crypto from "node:crypto";
import {
  getMidtransConfig,
  midtransSnapBaseUrl,
  isMidtransEnabled,
} from "@/lib/integration-config";
import { db } from "@/lib/db";

// ============================================================
// Midtrans Snap API client — create transaction + webhook verify.
// ============================================================
// Flow:
//   1. Customer checkout → POST /api/payments/midtrans/create
//      → createSnapTransaction() → returns snap_token + redirect_url
//   2. Customer pays via Snap.js (frontend opens redirect_url)
//   3. Midtrans sends webhook → POST /api/payments/midtrans/webhook
//      → verifyWebhookSignature() → update Payment + Order status
//
// Auth: Basic Auth with serverKey: (Base64). Server key is the
//   only secret; client key is public (used by Snap.js on frontend).
//
// Signature: Midtrans signs webhook with SHA512 of
//   orderId + statusCode + grossAmount + serverKey. We verify
//   before trusting the payload.
// ============================================================

export interface SnapTransactionPayload {
  transaction_details: {
    order_id: string;
    gross_amount: number;
  };
  customer_details?: {
    first_name?: string;
    email?: string;
    phone?: string;
    billing_address?: {
      address?: string;
      city?: string;
      phone?: string;
    };
  };
  item_details?: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
  }>;
  enabled_payments?: string[];
  callbacks?: {
    finish?: string;
  };
  expiry?: {
    unit: "minute" | "hour" | "day";
    duration: number;
  };
}

export interface SnapTransactionResult {
  token: string;
  redirect_url: string;
  transaction_status?: string;
}

// ============================================================
// createSnapTransaction — POST /snap/v1/transactions
// ============================================================
// Returns { token, redirect_url } on success. The frontend uses
// token with Snap.js (snap.pay(token)) or redirects to
// redirect_url for hosted payment page.
//
// Returns null if Midtrans disabled or call fails (caller falls
// back to mock payment).
// ============================================================

export async function createSnapTransaction(
  payload: SnapTransactionPayload
): Promise<SnapTransactionResult | null> {
  const enabled = await isMidtransEnabled();
  if (!enabled) return null;

  const config = await getMidtransConfig();
  if (!config.serverKey) return null;

  const url = midtransSnapBaseUrl(config.environment);
  const auth = Buffer.from(`${config.serverKey}:`).toString("base64");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text();
      console.error("[midtrans] Snap API error:", res.status, errText.substring(0, 300));
      return null;
    }

    const json = await res.json();
    if (!json.token || !json.redirect_url) {
      console.error("[midtrans] Snap API missing token/redirect_url:", json);
      return null;
    }

    return {
      token: json.token,
      redirect_url: json.redirect_url,
      transaction_status: json.transaction_status,
    };
  } catch (err: any) {
    console.error("[midtrans] createSnapTransaction failed:", err.message);
    return null;
  }
}

// ============================================================
// verifyWebhookSignature — SHA512(orderId + statusCode + grossAmount + serverKey)
// ============================================================
// Midtrans sends `signature_key` in webhook payload. We recompute
// the expected signature and compare. If mismatch → reject (don't
// trust the payload, could be spoofed).
// ============================================================

export async function verifyWebhookSignature(opts: {
  orderId: string;
  statusCode: string;
  grossAmount: string;
  signatureKey: string;
}): Promise<boolean> {
  const config = await getMidtransConfig();
  if (!config.serverKey) return false;

  const expected = crypto
    .createHash("sha512")
    .update(`${opts.orderId}${opts.statusCode}${opts.grossAmount}${config.serverKey}`)
    .digest("hex");

  // Constant-time compare to prevent timing attacks
  if (expected.length !== opts.signatureKey.length) return false;
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(opts.signatureKey, "hex")
    );
  } catch {
    return false;
  }
}

// ============================================================
// getTransactionStatus — GET /v2/{orderId}/status
// ============================================================
// Used to verify payment status on-demand (e.g., when customer
// returns from Snap redirect, before showing success page).
// ============================================================

export async function getTransactionStatus(
  orderId: string
): Promise<Record<string, unknown> | null> {
  const enabled = await isMidtransEnabled();
  if (!enabled) return null;

  const config = await getMidtransConfig();
  if (!config.serverKey) return null;

  // Note: /v2/ status endpoint (different from Snap /snap/v1/)
  const baseUrl =
    config.environment === "production"
      ? "https://api.midtrans.com"
      : "https://api.sandbox.midtrans.com";
  const url = `${baseUrl}/v2/${encodeURIComponent(orderId)}/status`;
  const auth = Buffer.from(`${config.serverKey}:`).toString("base64");

  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${auth}`,
      },
    });
    if (!res.ok) {
      console.error("[midtrans] status API error:", res.status);
      return null;
    }
    return await res.json();
  } catch (err: any) {
    console.error("[midtrans] getTransactionStatus failed:", err.message);
    return null;
  }
}

// ============================================================
// mapMidtransStatus — convert Midtrans transaction_status to
// our Payment.status + Order.status.
// ============================================================
// Midtrans statuses:
//   pending    → payment pending, order pending
//   settlement → payment success, order confirmed
//   capture    → credit card captured (same as settlement for our purpose)
//   deny       → payment denied, order cancelled
//   expire     → payment expired, order cancelled
//   cancel     → payment cancelled, order cancelled
//   refund     → payment refunded, order cancelled
//   partial_refund → partial refund, order stays delivered
// ============================================================

export function mapMidtransStatus(
  midtransStatus: string
): { paymentStatus: string; orderStatus: string } {
  switch (midtransStatus) {
    case "settlement":
    case "capture":
      return { paymentStatus: "paid", orderStatus: "confirmed" };
    case "pending":
      return { paymentStatus: "pending", orderStatus: "pending" };
    case "deny":
    case "expire":
    case "cancel":
    case "refund":
      return { paymentStatus: "failed", orderStatus: "cancelled" };
    case "partial_refund":
      return { paymentStatus: "partial_refund", orderStatus: "delivered" };
    default:
      return { paymentStatus: "pending", orderStatus: "pending" };
  }
}

// ============================================================
// updatePaymentFromWebhook — sync Payment + Order from webhook.
// ============================================================
// Idempotent: if Payment already in target status, no-op. Updates
// Payment.status + paidAt + Order.status. Returns true if updated,
// false if not found / no change.
// ============================================================

export async function updatePaymentFromWebhook(opts: {
  orderId: string;
  midtransStatus: string;
  transactionId?: string;
}): Promise<boolean> {
  const { paymentStatus, orderStatus } = mapMidtransStatus(opts.midtransStatus);

  // Find payment by orderId (our Order.id stored in Midtrans order_id)
  // Note: Payment model has orderId but no relation back to Order
  // (one-directional). We query separately.
  const payment = await db.payment.findFirst({
    where: { orderId: opts.orderId },
  });
  if (!payment) {
    console.warn("[midtrans] webhook: payment not found for orderId:", opts.orderId);
    return false;
  }

  // Idempotency: skip if already in target status
  if (payment.status === paymentStatus) {
    return true;
  }

  // Update Payment
  await db.payment.update({
    where: { id: payment.id },
    data: {
      status: paymentStatus,
      paidAt: paymentStatus === "paid" ? new Date() : null,
    },
  });

  // Fetch order separately (no relation on Payment)
  const order = await db.order.findUnique({
    where: { id: payment.orderId },
    select: { id: true, status: true },
  });

  // Update Order status (only if it makes sense — don't downgrade
  // a delivered order back to confirmed on settlement)
  if (order && order.status !== orderStatus) {
    const skipDowngrade =
      orderStatus === "confirmed" &&
      (order.status === "out_for_delivery" || order.status === "delivered");
    if (!skipDowngrade) {
      await db.order.update({
        where: { id: order.id },
        data: { status: orderStatus },
      });
    }
  }

  return true;
}
