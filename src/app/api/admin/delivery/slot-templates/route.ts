import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { getSlotTemplates, setSlotTemplates, type SlotTemplate } from "@/lib/delivery-slots";
import { logAdminAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

// ============================================================
// GET /api/admin/delivery/slot-templates — current templates
// ============================================================

export async function GET() {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }
  try {
    const templates = await getSlotTemplates();
    return NextResponse.json({ success: true, templates });
  } catch {
    return NextResponse.json({ success: false, message: "Server error." }, { status: 500 });
  }
}

// ============================================================
// PUT /api/admin/delivery/slot-templates — save custom templates
// ============================================================
// Body: { templates: [{ startHour, endHour, label }] }
// ============================================================

export async function PUT(req: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const templates: SlotTemplate[] = Array.isArray(body.templates)
      ? body.templates.map((t: any) => ({
          startHour: parseInt(t.startHour, 10),
          endHour: parseInt(t.endHour, 10),
          label: String(t.label || "").trim(),
        })).filter((t: SlotTemplate) =>
          !isNaN(t.startHour) && !isNaN(t.endHour) && t.label &&
          t.startHour >= 0 && t.startHour <= 23 &&
          t.endHour > t.startHour && t.endHour <= 24
        )
      : [];

    await setSlotTemplates(templates);

    await logAdminAction({
      action: "slot_templates_update",
      target: "delivery:slot-templates",
      success: true,
      detail: `${templates.length} templates`,
    });

    return NextResponse.json({ success: true, templates });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: "Server error." }, { status: 500 });
  }
}
