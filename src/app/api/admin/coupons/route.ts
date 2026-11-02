import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyAdmin, unauthorizedResponse } from "@/lib/admin-auth";
import { generateCode, type CouponType } from "@/lib/coupon-service";

export const dynamic = "force-dynamic";

// ============================================================
// GET /api/admin/coupons — list all coupons (newest first).
// Returns: { coupons: Coupon[] with _count.usages }
// ============================================================

export async function GET() {
  if (!(await verifyAdmin())) return unauthorizedResponse();
  try {
    const coupons = await db.coupon.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { usages: true } } },
    });
    return NextResponse.json({ success: true, coupons });
  } catch (err) {
    console.error("[api/admin/coupons] GET error:", err);
    return NextResponse.json(
      { success: false, message: "Server error." },
      { status: 500 }
    );
  }
}

// ============================================================
// POST /api/admin/coupons — create a single coupon.
// Body: { code?, type, value, minOrder, maxUsage, maxPerUser,
//         startsAt?, expiresAt?, active, scopeType, scopeValue?,
//         note?, description? }
// If code omitted → auto-generate (PREFIX + 6 chars).
// ============================================================

const VALID_TYPES: CouponType[] = ["percent", "fixed", "free_shipping"];

export async function POST(req: NextRequest) {
  if (!(await verifyAdmin())) return unauthorizedResponse();
  try {
    const body = await req.json().catch(() => ({}));

    const type = typeof body.type === "string" ? (body.type as CouponType) : "";
    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json(
        { success: false, message: "Tipe kupon tidak valid." },
        { status: 400 }
      );
    }

    const value = typeof body.value === "number" ? Math.max(0, Math.floor(body.value)) : 0;
    if (type === "percent" && (value < 1 || value > 100)) {
      return NextResponse.json(
        { success: false, message: "Persen diskon harus 1-100." },
        { status: 400 }
      );
    }

    const minOrder = typeof body.minOrder === "number" ? Math.max(0, Math.floor(body.minOrder)) : 0;
    const maxUsage = typeof body.maxUsage === "number" ? Math.max(0, Math.floor(body.maxUsage)) : 0;
    const maxPerUser = typeof body.maxPerUser === "number" ? Math.max(0, Math.floor(body.maxPerUser)) : 1;

    // Code: explicit or auto-generated. Retry on collision (rare).
    let code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
    if (!code) {
      const prefix = typeof body.prefix === "string" ? body.prefix.trim().toUpperCase() : "";
      for (let attempt = 0; attempt < 5; attempt++) {
        const candidate = generateCode(prefix);
        const exists = await db.coupon.findUnique({ where: { code: candidate } });
        if (!exists) {
          code = candidate;
          break;
        }
      }
      if (!code) {
        return NextResponse.json(
          { success: false, message: "Gagal membuat kode unik. Coba lagi." },
          { status: 500 }
        );
      }
    }

    const existing = await db.coupon.findUnique({ where: { code } });
    if (existing) {
      return NextResponse.json(
        { success: false, message: "Kode kupon sudah ada." },
        { status: 409 }
      );
    }

    const scopeType = typeof body.scopeType === "string" ? body.scopeType : "all";
    const scopeValue =
      typeof body.scopeValue === "string" && body.scopeValue ? body.scopeValue : null;

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
        scopeType,
        scopeValue,
        note: typeof body.note === "string" ? body.note : null,
        description: typeof body.description === "string" ? body.description : null,
      },
    });

    return NextResponse.json({ success: true, coupon });
  } catch (err) {
    console.error("[api/admin/coupons] POST error:", err);
    return NextResponse.json(
      { success: false, message: "Server error." },
      { status: 500 }
    );
  }
}
