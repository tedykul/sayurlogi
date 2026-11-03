import { NextRequest, NextResponse } from "next/server";
import { getOrderByTrackingId } from "@/lib/orders";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ trackingId: string }>;
}

// GET /api/orders/[trackingId]
// Public endpoint — customer can track order by tracking ID.
// No auth required (tracking ID is the "key" — 6 chars, hard to guess).
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { trackingId } = await params;
    if (!trackingId || trackingId.length < 4) {
      return NextResponse.json(
        { success: false, message: "Tracking ID tidak valid." },
        { status: 400 }
      );
    }

    const order = await getOrderByTrackingId(trackingId);
    if (!order) {
      return NextResponse.json(
        { success: false, message: "Pesanan tidak ditemukan. Cek kembali tracking ID kamu." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      order,
    });
  } catch (err: any) {
    console.error("[api/orders/[trackingId]] error:", err);
    return NextResponse.json(
      { success: false, message: "Server error." },
      { status: 500 }
    );
  }
}
