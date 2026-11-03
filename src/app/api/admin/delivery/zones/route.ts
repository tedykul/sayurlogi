import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

// ============================================================
// GET /api/admin/delivery/zones — all zones (incl inactive)
// ============================================================

export async function GET() {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }
  try {
    const zones = await db.deliveryZone.findMany({
      orderBy: [{ order: "asc" }, { name: "asc" }],
    });
    return NextResponse.json({ success: true, zones });
  } catch {
    return NextResponse.json({ success: false, message: "Server error." }, { status: 500 });
  }
}

// ============================================================
// POST /api/admin/delivery/zones — create new zone
// ============================================================

export async function POST(req: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ success: false, message: "Nama zona wajib diisi." }, { status: 400 });
    }
    
    const existing = await db.deliveryZone.findUnique({ where: { name } });
    if (existing) {
      return NextResponse.json({ success: false, message: "Nama zona sudah ada." }, { status: 409 });
    }
    
    const zone = await db.deliveryZone.create({
      data: {
        name,
        fee: typeof body.fee === "number" ? Math.max(0, Math.floor(body.fee)) : 0,
        freeShippingMin: typeof body.freeShippingMin === "number" ? Math.max(0, Math.floor(body.freeShippingMin)) : 0,
        order: typeof body.order === "number" ? Math.floor(body.order) : 0,
        active: body.active !== false,
      },
    });
    
    await logAdminAction({
      action: "delivery_zone_create",
      target: `zone:${name}`,
      success: true,
    });
    
    return NextResponse.json({ success: true, zone });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: "Server error." }, { status: 500 });
  }
}
