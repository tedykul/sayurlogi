import { NextRequest, NextResponse } from "next/server";
import { requestPaymentVerification } from "@/lib/payments";
import { isMidtransEnabled } from "@/lib/integration-config";
import { notifyPaymentNeedsVerification } from "@/lib/wa-notification";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ paymentId: string }>;
}

// ============================================================
// POST /api/payments/[paymentId]/confirm
// ============================================================
// Called by storefront when customer clicks "Saya Sudah Bayar".
//
// Behavior depends on payment gateway:
//   - Midtrans ENABLED: payment is auto-verified via Midtrans
//     webhook (/api/payments/midtrans/webhook). Customer does NOT
//     need to click this button — but if they do, we return a hint
//     that auto-verify is in progress.
//   - Midtrans DISABLED: mark payment.status = "pending_verification"
//     + WA notify admin "perlu verifikasi pembayaran". Admin must
//     manually verify via dashboard (/api/admin/orders/[id]/verify-payment).
//
// Backward compat: previously this endpoint called simulatePayment
// (auto-marked as paid). That was mock behavior — proper for dev,
// dangerous for production. New behavior is safer (admin verify
// required for manual flow).
// ============================================================

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { paymentId } = await params;

    // If Midtrans enabled, customer doesn't need to click this button.
    // Payment will be auto-verified via Midtrans webhook when they
    // complete the Snap payment flow.
    const midtransEnabled = await isMidtransEnabled();
    if (midtransEnabled) {
      return NextResponse.json({
        success: true,
        message: "Pembayaran akan otomatis terverifikasi via Midtrans setelah Anda selesai membayar. Tidak perlu klik tombol ini.",
        autoVerify: true,
      });
    }

    // Midtrans disabled → manual verification flow
    const result = await requestPaymentVerification(paymentId);
    if (!result.success) {
      return NextResponse.json({ success: false, message: result.message }, { status: 400 });
    }

    // Find orderId for this payment → WA notify admin
    // (requestPaymentVerification doesn't return orderId, so we fetch
    // it via the payment record we just updated)
    // Best-effort: if WA config missing or admin phone not set, this
    // is a no-op (logged as warning).
    // We use a separate fetch to avoid coupling requestPaymentVerification
    // with notification logic.
    try {
      const { db } = await import("@/lib/db");
      const payment = await db.payment.findUnique({
        where: { id: paymentId },
        select: { orderId: true },
      });
      if (payment?.orderId) {
        notifyPaymentNeedsVerification(payment.orderId).catch((err) => {
          console.warn("[payments/confirm] WA notifyPaymentNeedsVerification failed:", err.message);
        });
      }
    } catch (err: any) {
      console.warn("[payments/confirm] failed to fetch orderId for WA notify:", err.message);
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      status: result.status,
      autoVerify: false,
    });
  } catch (err: any) {
    console.error("[api/payments/[paymentId]/confirm] error:", err);
    return NextResponse.json(
      { success: false, message: "Server error." },
      { status: 500 }
    );
  }
}
