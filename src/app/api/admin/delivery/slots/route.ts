import { NextResponse } from "next/server";
import { listSlotsForAdmin, isSchedulingEnabled } from "@/lib/delivery-slots";
import { verifyAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

// ============================================================
// GET /api/admin/delivery/slots — admin list (all slots, incl closed)
// ============================================================

export async function GET(req: Request) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }
  try {
    const url = new URL(req.url);
    const dateFilter = url.searchParams.get("date") || undefined;
    const slots = await listSlotsForAdmin({ dateFilter });
    const enabled = await isSchedulingEnabled();
    return NextResponse.json({ success: true, slots, enabled });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: "Server error." }, { status: 500 });
  }
}
