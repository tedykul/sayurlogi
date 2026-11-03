import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { getMapsSettings, saveMapsSettings } from "@/lib/google-maps";
import { logAdminAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

// ============================================================
// GET /api/admin/delivery/maps-settings
// ============================================================

export async function GET() {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }
  try {
    const settings = await getMapsSettings();
    return NextResponse.json({ success: true, settings });
  } catch {
    return NextResponse.json({ success: false, message: "Server error." }, { status: 500 });
  }
}

// ============================================================
// PUT /api/admin/delivery/maps-settings
// ============================================================
// Body: { apiKey?, storeLat?, storeLng?, baseFare?, perKmRate? }
// ============================================================

export async function PUT(req: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }
  try {
    const body = await req.json().catch(() => ({}));

    await saveMapsSettings({
      apiKey: typeof body.apiKey === "string" ? body.apiKey : undefined,
      storeLat: typeof body.storeLat === "number" ? body.storeLat : undefined,
      storeLng: typeof body.storeLng === "number" ? body.storeLng : undefined,
      baseFare: typeof body.baseFare === "number" ? body.baseFare : undefined,
      perKmRate: typeof body.perKmRate === "number" ? body.perKmRate : undefined,
    });

    await logAdminAction({
      action: "maps_settings_update",
      target: "delivery:maps-settings",
      success: true,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: "Server error." }, { status: 500 });
  }
}
