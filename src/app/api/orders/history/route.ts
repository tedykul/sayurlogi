import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/orders/history?email=xxx atau ?phone=xxx
// Public endpoint — customer can see their order history by email or phone.
// No auth required (email/phone is the "key" — same as tracking ID pattern).
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email")?.trim().toLowerCase();
    const phone = searchParams.get("phone")?.trim();

    if (!email && !phone) {
      return NextResponse.json(
        { success: false, message: "Email atau telepon diperlukan." },
        { status: 400 }
      );
    }

    const where: { OR: Array<Record<string, unknown>> } = { OR: [] };
    if (email) where.OR.push({ customerEmail: { contains: email } });
    if (phone) where.OR.push({ customerPhone: { contains: phone } });

    const orders = await db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        trackingId: true,
        customerName: true,
        status: true,
        total: true,
        itemsJson: true,
        deliveryMethod: true,
        paymentMethod: true,
        createdAt: true,
        estimatedDelivery: true,
      },
    });

    if (orders.length === 0) {
      return NextResponse.json({
        success: true,
        orders: [],
        message: "Belum ada pesanan ditemukan dengan data tersebut.",
      });
    }

    // Parse itemsJson for each order
    const parsedOrders = orders.map((o) => ({
      ...o,
      items: JSON.parse(o.itemsJson),
      itemsJson: undefined,
    }));

    return NextResponse.json({
      success: true,
      orders: parsedOrders,
      total: parsedOrders.length,
    });
  } catch (err: any) {
    console.error("[api/orders/history] error:", err);
    return NextResponse.json(
      { success: false, message: "Server error." },
      { status: 500 }
    );
  }
}
