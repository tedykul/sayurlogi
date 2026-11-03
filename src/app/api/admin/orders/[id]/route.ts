import { NextRequest, NextResponse } from "next/server";
import { updateOrderStatus, getOrderById, type OrderStatus } from "@/lib/orders";
import { verifyAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/audit";
import { notifyOrderStatusChanged } from "@/lib/wa-notification";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ id: string }>;
}

const VALID_STATUSES: OrderStatus[] = [
  "pending", "confirmed", "preparing", "out_for_delivery", "delivered", "cancelled",
];

// GET /api/admin/orders/[id] — get single order by internal ID
export async function GET(_req: NextRequest, { params }: Params) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }
  try {
    const { id } = await params;
    const order = await getOrderById(id);
    if (!order) {
      return NextResponse.json({ success: false, message: "Order tidak ditemukan." }, { status: 404 });
    }
    return NextResponse.json({ success: true, order });
  } catch (err: any) {
    console.error("[api/admin/orders/[id]] GET error:", err);
    return NextResponse.json({ success: false, message: "Server error." }, { status: 500 });
  }
}

// PUT /api/admin/orders/[id] — update order status
// Body: { status: OrderStatus }
export async function PUT(req: NextRequest, { params }: Params) {
  if (!(await verifyAdmin())) {
    await logAdminAction({ action: "unauthorized_attempt", target: "order:update", success: false });
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }
  try {
    const { id } = await params;
    const body = await req.json();
    const newStatus = body.status as OrderStatus;

    if (!newStatus || !VALID_STATUSES.includes(newStatus)) {
      return NextResponse.json(
        { success: false, message: `Status tidak valid. Pilihan: ${VALID_STATUSES.join(", ")}` },
        { status: 422 }
      );
    }

    const existing = await getOrderById(id);
    if (!existing) {
      return NextResponse.json({ success: false, message: "Order tidak ditemukan." }, { status: 404 });
    }

    const order = await updateOrderStatus(id, newStatus);
    await logAdminAction({
      action: "update",
      target: `order:${order.trackingId}:status:${newStatus}`,
      success: true,
    });

    // WhatsApp notification (best-effort, non-blocking). Sends
    // status-change message to customer if WA enabled.
    notifyOrderStatusChanged(id, newStatus).catch((err) => {
      console.warn("[admin/orders] WA notify failed (non-blocking):", err.message);
    });

    return NextResponse.json({ success: true, order });
  } catch (err: any) {
    console.error("[api/admin/orders/[id]] PUT error:", err);
    return NextResponse.json({ success: false, message: "Server error." }, { status: 500 });
  }
}
