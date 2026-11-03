import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createPayment, type PaymentMethod } from "@/lib/payments";

export const dynamic = "force-dynamic";

// POST /api/payments/create
// Body: { orderId: string, method: "cod" | "transfer" | "ewallet" }
// Creates payment record + returns VA number / payment URL (mock).
export async function POST(req: NextRequest) {
  try {
    const { orderId, method } = await req.json();
    if (!orderId || !method) {
      return NextResponse.json(
        { success: false, message: "orderId dan method diperlukan." },
        { status: 400 }
      );
    }
    if (!["cod", "transfer", "ewallet"].includes(method)) {
      return NextResponse.json(
        { success: false, message: "Method tidak valid." },
        { status: 422 }
      );
    }

    // Get order to verify + get trackingId + total
    const order = await db.order.findUnique({ where: { id: orderId } });
    if (!order) {
      return NextResponse.json(
        { success: false, message: "Order tidak ditemukan." },
        { status: 404 }
      );
    }

    const result = await createPayment(
      orderId,
      order.trackingId,
      method as PaymentMethod,
      order.total
    );

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (err: any) {
    console.error("[api/payments/create] error:", err);
    return NextResponse.json(
      { success: false, message: "Server error." },
      { status: 500 }
    );
  }
}
