import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

// ============================================================
// PUT /api/admin/delivery/zones/[id] — update zone
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
    
    const existing = await db.deliveryZone.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, message: "Zona tidak ditemukan." }, { status: 404 });
    }
    
    const data: Record<string, unknown> = {};
    if (typeof body.name === "string" && body.name.trim()) {
      const clash = await db.deliveryZone.findUnique({ where: { name: body.name.trim() } });
      if (clash && clash.id !== id) {
        return NextResponse.json({ success: false, message: "Nama zona sudah dipakai." }, { status: 409 });
      }
      data.name = body.name.trim();
    }
    if (typeof body.fee === "number") data.fee = Math.max(0, Math.floor(body.fee));
    if (typeof body.freeShippingMin === "number") data.freeShippingMin = Math.max(0, Math.floor(body.freeShippingMin));
    if (typeof body.order === "number") data.order = Math.floor(body.order);
    if (typeof body.active === "boolean") data.active = body.active;
    
    const zone = await db.deliveryZone.update({ where: { id }, data });
    
    await logAdminAction({
      action: "delivery_zone_update",
      target: `zone:${zone.name}`,
      success: true,
    });
    
    return NextResponse.json({ success: true, zone });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: "Server error." }, { status: 500 });
  }
}

// ============================================================
// DELETE /api/admin/delivery/zones/[id] — delete zone
// ============================================================

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }
  try {
    const { id } = await params;
    const existing = await db.deliveryZone.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, message: "Zona tidak ditemukan." }, { status: 404 });
    }
    
    await db.deliveryZone.delete({ where: { id } });
    
    await logAdminAction({
      action: "delivery_zone_delete",
      target: `zone:${existing.name}`,
      success: true,
    });
    
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, message: "Server error." }, { status: 500 });
  }
}
