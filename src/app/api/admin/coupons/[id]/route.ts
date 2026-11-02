import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyAdmin, unauthorizedResponse } from "@/lib/admin-auth";
import type { CouponType } from "@/lib/coupon-service";

export const dynamic = "force-dynamic";

const VALID_TYPES: CouponType[] = ["percent", "fixed", "free_shipping"];

// ============================================================
// PATCH /api/admin/coupons/[id] — update coupon fields.
// Body: partial coupon fields. code is immutable (use delete+create).
// ============================================================

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyAdmin())) return unauthorizedResponse();
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const existing = await db.coupon.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, message: "Kupon tidak ditemukan." },
        { status: 404 }
      );
    }

    // Build update data — only fields present in body, validated.
    const data: Record<string, unknown> = {};

    if (typeof body.type === "string") {
      if (!VALID_TYPES.includes(body.type as CouponType)) {
        return NextResponse.json(
          { success: false, message: "Tipe kupon tidak valid." },
          { status: 400 }
        );
      }
      data.type = body.type;
    }
    if (typeof body.value === "number") {
      const v = Math.max(0, Math.floor(body.value));
      if (data.type === "percent" || (data.type === undefined && existing.type === "percent")) {
        if (v < 1 || v > 100) {
          return NextResponse.json(
            { success: false, message: "Persen diskon harus 1-100." },
            { status: 400 }
          );
        }
      }
      data.value = v;
    }
    if (typeof body.minOrder === "number") data.minOrder = Math.max(0, Math.floor(body.minOrder));
    if (typeof body.maxUsage === "number") data.maxUsage = Math.max(0, Math.floor(body.maxUsage));
    if (typeof body.maxPerUser === "number") data.maxPerUser = Math.max(0, Math.floor(body.maxPerUser));
    if (typeof body.active === "boolean") data.active = body.active;
    if (typeof body.scopeType === "string") data.scopeType = body.scopeType;
    if (body.scopeValue !== undefined) {
      data.scopeValue = typeof body.scopeValue === "string" && body.scopeValue ? body.scopeValue : null;
    }
    if (typeof body.note === "string") data.note = body.note;
    if (typeof body.description === "string") data.description = body.description;
    if (body.startsAt !== undefined) {
      data.startsAt = body.startsAt ? new Date(body.startsAt) : null;
    }
    if (body.expiresAt !== undefined) {
      data.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { success: false, message: "Tidak ada field untuk diupdate." },
        { status: 400 }
      );
    }

    const coupon = await db.coupon.update({ where: { id }, data });
    return NextResponse.json({ success: true, coupon });
  } catch (err) {
    console.error("[api/admin/coupons/[id]] PATCH error:", err);
    return NextResponse.json(
      { success: false, message: "Server error." },
      { status: 500 }
    );
  }
}

// ============================================================
// DELETE /api/admin/coupons/[id] — delete coupon.
// Cascades to CouponUsage (per schema onDelete: Cascade).
// ============================================================

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyAdmin())) return unauthorizedResponse();
  try {
    const { id } = await params;
    const existing = await db.coupon.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, message: "Kupon tidak ditemukan." },
        { status: 404 }
      );
    }
    await db.coupon.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[api/admin/coupons/[id]] DELETE error:", err);
    return NextResponse.json(
      { success: false, message: "Server error." },
      { status: 500 }
    );
  }
}
