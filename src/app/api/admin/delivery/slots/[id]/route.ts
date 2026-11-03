import { NextRequest, NextResponse } from "next/server";
import { setSlotClosed, setSlotMaxOrders } from "@/lib/delivery-slots";
import { verifyAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

// ============================================================
// PUT /api/admin/delivery/slots/[id] — close/open + set maxOrders
// ============================================================
// Body: { closed?: boolean, maxOrders?: number }
// ============================================================

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    if (typeof body.closed === "boolean") {
      await setSlotClosed(id, body.closed);
      await logAdminAction({
        action: "delivery_slot_update",
        target: `slot:${id}`,
        success: true,
        detail: `closed=${body.closed}`,
      });
    }
    if (typeof body.maxOrders === "number") {
      await setSlotMaxOrders(id, body.maxOrders);
      await logAdminAction({
        action: "delivery_slot_update",
        target: `slot:${id}`,
        success: true,
        detail: `maxOrders=${body.maxOrders}`,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message || "Server error." }, { status: 500 });
  }
}
