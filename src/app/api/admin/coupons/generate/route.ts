import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyAdmin, unauthorizedResponse } from "@/lib/admin-auth";
import { generateCode, type CouponType } from "@/lib/coupon-service";

export const dynamic = "force-dynamic";

// ============================================================
// POST /api/admin/coupons/generate — batch generate coupons.
// Body: {
//   count: number (1-200),
//   prefix?: string,
//   type: "percent"|"fixed"|"free_shipping",
//   value: number,
//   minOrder?: number,
//   maxUsage?: number,
//   maxPerUser?: number,
//   expiresAt?: string (ISO),
//   description?: string,
//   note?: string,
// }
// Returns: { batchId, coupons: Coupon[] }
// ============================================================

const VALID_TYPES: CouponType[] = ["percent", "fixed", "free_shipping"];

export async function POST(req: NextRequest) {
  if (!(await verifyAdmin())) return unauthorizedResponse();
  try {
    const body = await req.json().catch(() => ({}));

    const count = typeof body.count === "number" ? Math.floor(body.count) : 0;
    if (count < 1 || count > 200) {
      return NextResponse.json(
        { success: false, message: "Jumlah kupon harus 1-200." },
        { status: 400 }
      );
    }

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
    const prefix = typeof body.prefix === "string" ? body.prefix.trim().toUpperCase().slice(0, 6) : "";
    const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
    const description = typeof body.description === "string" ? body.description : null;
    const note = typeof body.note === "string" ? body.note : null;

    // Generate unique codes (retry on collision)
    const codes: string[] = [];
    const used = new Set<string>();
    let attempts = 0;
    while (codes.length < count && attempts < count * 10) {
      attempts++;
      const candidate = generateCode(prefix);
      if (used.has(candidate)) continue;
      // Check DB
      const exists = await db.coupon.findUnique({ where: { code: candidate } });
      if (exists) continue;
      used.add(candidate);
      codes.push(candidate);
    }
    if (codes.length < count) {
      return NextResponse.json(
        { success: false, message: "Gagal membuat kode unik. Coba lagi." },
        { status: 500 }
      );
    }

    const batchId = `batch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Bulk create
    const created = await db.$transaction(
      codes.map((code) =>
        db.coupon.create({
          data: {
            code,
            type,
            value,
            minOrder,
            maxUsage,
            maxPerUser,
            expiresAt,
            active: true,
            scopeType: "all",
            scopeValue: null,
            note,
            description,
            batchId,
          },
        })
      )
    );

    return NextResponse.json({ success: true, batchId, coupons: created });
  } catch (err) {
    console.error("[api/admin/coupons/generate] error:", err);
    return NextResponse.json(
      { success: false, message: "Server error." },
      { status: 500 }
    );
  }
}
