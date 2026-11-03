import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { verifyPayment, getPaymentByOrderId } from "@/lib/payments";
import { notifyPaymentVerified } from "@/lib/wa-notification";
import { logAdminAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ id: string }>;
}

// ============================================================
// POST /api/admin/orders/[id]/verify-payment
// ============================================================
// Admin manually confirms payment for an order. Used when Midtrans
// is disabled (manual verification flow). Customer clicked "Saya
// Sudah Bayar" → payment.status = "pending_verification" → admin
// checks bank mutation → clicks "Konfirmasi Pembayaran" in
// dashboard → this endpoint marks payment as "paid" + order as
// "confirmed" + sends WA to customer.
//
// Body: (none — orderId from URL params)
// Returns: { success, message, orderId, paymentId }
// ============================================================

export async function POST(_req: NextRequest, { params }: Params) {
  if (!(await verifyAdmin())) {
    return NextResponse.json(
      { success: false, message: "Unauthorized." },
      { status: 401 }
    );
  }

  try {
    const { id: orderId } = await params;

    // Find payment linked to this order
    const payment = await getPaymentByOrderId(orderId);
    if (!payment) {
      return NextResponse.json(
        { success: false, message: "Payment tidak ditemukan untuk order ini." },
        { status: 404 }
      );
    }

    // Verify payment (marks paid + updates order status)
    const result = await verifyPayment(payment.id);
    if (!result.success) {
      return NextResponse.json({ success: false, message: result.message }, { status: 400 });
    }

    // Send WA notification to customer (best-effort, non-blocking)
    notifyPaymentVerified(orderId).catch((err) => {
      console.warn("[verify-payment] WA notifyPaymentVerified failed:", err.message);
    });

    // Audit log
    await logAdminAction({
      action: "update",
      target: `order:${orderId}:payment-verified`,
      success: true,
    });

    return NextResponse.json({
      success: true,
      message: "Pembayaran dikonfirmasi. Customer akan dapat notifikasi WA.",
      orderId,
      paymentId: payment.id,
    });
  } catch (err: any) {
    console.error("[api/admin/orders/[id]/verify-payment] error:", err);
    return NextResponse.json(
      { success: false, message: "Server error." },
      { status: 500 }
    );
  }
}
