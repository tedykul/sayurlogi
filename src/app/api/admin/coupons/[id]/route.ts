import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

// ============================================================
// GET /api/admin/coupons/[id] — single coupon + usage list.
// ============================================================

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }
  try {
    const { id } = await params;
    const coupon = await db.coupon.findUnique({
      where: { id },
      include: {
        usages: { orderBy: { usedAt: "desc" }, take: 50 },
      },
    });
    if (!coupon) {
      return NextResponse.json({ success: false, message: "Kupon tidak ditemukan." }, { status: 404 });
    }
    return NextResponse.json({ success: true, coupon });
  } catch (err) {
    console.error("[api/admin/coupons/[id]] GET error:", err);
    return NextResponse.json({ success: false, message: "Server error." }, { status: 500 });
  }
}

// ============================================================
// PUT /api/admin/coupons/[id] — update coupon fields.
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

    const existing = await db.coupon.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, message: "Kupon tidak ditemukan." }, { status: 404 });
    }

    // Build update payload from provided fields only.
    const data: Record<string, unknown> = {};
    if (typeof body.code === "string") {
      const code = body.code.trim().toUpperCase();
      if (!code) {
        return NextResponse.json({ success: false, message: "Kode tidak boleh kosong." }, { status: 400 });
      }
      // uniqueness check (excluding self)
      const clash = await db.coupon.findUnique({ where: { code } });
      if (clash && clash.id !== id) {
        return NextResponse.json({ success: false, message: "Kode sudah dipakai kupon lain." }, { status: 409 });
      }
      data.code = code;
    }
    if (typeof body.type === "string" && ["percent", "fixed", "free_shipping"].includes(body.type)) {
      data.type = body.type;
    }
    if (typeof body.value === "number") data.value = Math.max(0, Math.floor(body.value));
    if (typeof body.minOrder === "number") data.minOrder = Math.max(0, Math.floor(body.minOrder));
    if (typeof body.maxUsage === "number") data.maxUsage = Math.max(0, Math.floor(body.maxUsage));
    if (typeof body.maxPerUser === "number") data.maxPerUser = Math.max(0, Math.floor(body.maxPerUser));
    if (typeof body.active === "boolean") data.active = body.active;
    if (typeof body.scopeType === "string") data.scopeType = body.scopeType;
    if (body.scopeValue === null || typeof body.scopeValue === "string") data.scopeValue = body.scopeValue || null;
    if (body.note === null || typeof body.note === "string") data.note = body.note;
    if (body.startsAt === null || typeof body.startsAt === "string") {
      data.startsAt = body.startsAt ? new Date(body.startsAt) : null;
    }
    if (body.expiresAt === null || typeof body.expiresAt === "string") {
      data.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
    }

    const coupon = await db.coupon.update({ where: { id }, data });
    await logAdminAction({
      action: "coupon_update",
      target: `coupon:${coupon.code}`,
      success: true,
    });
    return NextResponse.json({ success: true, coupon });
  } catch (err) {
    console.error("[api/admin/coupons/[id]] PUT error:", err);
    return NextResponse.json({ success: false, message: "Server error." }, { status: 500 });
  }
}

// ============================================================
// DELETE /api/admin/coupons/[id] — delete coupon.
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
    const existing = await db.coupon.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, message: "Kupon tidak ditemukan." }, { status: 404 });
    }
    await db.coupon.delete({ where: { id } });
    await logAdminAction({
      action: "coupon_delete",
      target: `coupon:${existing.code}`,
      success: true,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[api/admin/coupons/[id]] DELETE error:", err);
    return NextResponse.json({ success: false, message: "Server error." }, { status: 500 });
  }
}
