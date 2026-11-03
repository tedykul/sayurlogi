import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { getBiteshipSettings, saveBiteshipSettings } from "@/lib/biteship";
import { logAdminAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

// ============================================================
// GET /api/admin/delivery/biteship-settings
// ============================================================

export async function GET() {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }
  try {
    const settings = await getBiteshipSettings();
    return NextResponse.json({ success: true, settings });
  } catch {
    return NextResponse.json({ success: false, message: "Server error." }, { status: 500 });
  }
}

// ============================================================
// PUT /api/admin/delivery/biteship-settings
// ============================================================

export async function PUT(req: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }
  try {
    const body = await req.json().catch(() => ({}));

    await saveBiteshipSettings({
      apiKey: typeof body.apiKey === "string" ? body.apiKey : undefined,
      apiUrl: typeof body.apiUrl === "string" ? body.apiUrl : undefined,
    });

    await logAdminAction({
      action: "biteship_settings_update",
      target: "delivery:biteship-settings",
      success: true,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: "Server error." }, { status: 500 });
  }
}
