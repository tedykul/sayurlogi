import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

// ============================================================
// GET /api/admin/coupons — list all coupons (newest first).
// ============================================================

export async function GET() {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }
  try {
    const coupons = await db.coupon.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { usages: true } } },
    });
    return NextResponse.json({ success: true, coupons });
  } catch (err) {
    console.error("[api/admin/coupons] GET error:", err);
    return NextResponse.json({ success: false, message: "Server error." }, { status: 500 });
  }
}

// ============================================================
// POST /api/admin/coupons — create a new coupon.
// ============================================================
// Body: { code, type, value, minOrder, maxUsage, maxPerUser,
//         startsAt?, expiresAt?, active, scopeType, scopeValue?,
//         note? }
//
// code is uppercased + trimmed. type must be one of:
// percent | fixed | free_shipping.
// ============================================================

export async function POST(req: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
    const type = typeof body.type === "string" ? body.type : "";
    const value = typeof body.value === "number" ? Math.max(0, Math.floor(body.value)) : 0;
    const minOrder = typeof body.minOrder === "number" ? Math.max(0, Math.floor(body.minOrder)) : 0;
    const maxUsage = typeof body.maxUsage === "number" ? Math.max(0, Math.floor(body.maxUsage)) : 0;
    const maxPerUser = typeof body.maxPerUser === "number" ? Math.max(0, Math.floor(body.maxPerUser)) : 1;

    if (!code) {
      return NextResponse.json({ success: false, message: "Kode kupon wajib diisi." }, { status: 400 });
    }
    if (!["percent", "fixed", "free_shipping"].includes(type)) {
      return NextResponse.json({ success: false, message: "Tipe kupon tidak valid." }, { status: 400 });
    }
    if (type === "percent" && (value < 1 || value > 100)) {
      return NextResponse.json({ success: false, message: "Persen diskon harus 1-100." }, { status: 400 });
    }

    const existing = await db.coupon.findUnique({ where: { code } });
    if (existing) {
      return NextResponse.json({ success: false, message: "Kode kupon sudah ada." }, { status: 409 });
    }

    const coupon = await db.coupon.create({
      data: {
        code,
        type,
        value,
        minOrder,
        maxUsage,
        maxPerUser,
        startsAt: body.startsAt ? new Date(body.startsAt) : null,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        active: body.active !== false,
        scopeType: typeof body.scopeType === "string" ? body.scopeType : "all",
        scopeValue: typeof body.scopeValue === "string" && body.scopeValue ? body.scopeValue : null,
        note: typeof body.note === "string" ? body.note : null,
      },
    });

    await logAdminAction({
      action: "coupon_create",
      target: `coupon:${code}`,
      success: true,
      detail: `type=${type} value=${value}`,
    });

    return NextResponse.json({ success: true, coupon });
  } catch (err) {
    console.error("[api/admin/coupons] POST error:", err);
    return NextResponse.json({ success: false, message: "Server error." }, { status: 500 });
  }
}
