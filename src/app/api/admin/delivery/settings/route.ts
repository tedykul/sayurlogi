import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/audit";
import { getBlockedDates, setBlockedDates } from "@/lib/delivery-slots";

export const dynamic = "force-dynamic";

// ============================================================
// GET /api/admin/delivery/settings — current scheduling config
// ============================================================

export async function GET() {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }
  try {
    const setting = await db.siteSetting.findUnique({
      where: { id: "singleton" },
      select: { deliverySchedulingEnabled: true },
    });
    const blockedDates = await getBlockedDates();
    return NextResponse.json({
      success: true,
      enabled: setting?.deliverySchedulingEnabled ?? false,
      blockedDates,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: "Server error." }, { status: 500 });
  }
}

// ============================================================
// PUT /api/admin/delivery/settings — toggle scheduling + block dates
// ============================================================
// Body: { enabled?: boolean, blockedDates?: string[] }
// ============================================================

export async function PUT(req: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }
  try {
    const body = await req.json().catch(() => ({}));

    if (typeof body.enabled === "boolean") {
      await db.siteSetting.upsert({
        where: { id: "singleton" },
        create: { id: "singleton", deliverySchedulingEnabled: body.enabled },
        update: { deliverySchedulingEnabled: body.enabled },
      });
    }

    if (Array.isArray(body.blockedDates)) {
      await setBlockedDates(body.blockedDates);
    }

    await logAdminAction({
      action: "delivery_settings_update",
      target: "delivery:settings",
      success: true,
      detail: `enabled=${body.enabled ?? "unchanged"}`,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message || "Server error." }, { status: 500 });
  }
}
