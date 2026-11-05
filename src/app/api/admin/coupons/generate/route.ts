import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/admin-auth";
import { batchGenerateCoupons } from "@/lib/coupon-service";
import { logAdminAction } from "@/lib/audit";
import type { CouponType } from "@/lib/coupons";

export const dynamic = "force-dynamic";

// ============================================================
// POST /api/admin/coupons/generate
// ============================================================
// Body: { prefix, count, type, value, minOrder?, maxUsage?,
//         maxPerUser?, expiresAt?, scopeType?, scopeValue?,
//         note?, description? }
// Returns: { success, created, codes }
// ============================================================

export async function POST(req: NextRequest) {
  const auth = await verifyAuth();
  if (!auth) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));

    const prefix = typeof body.prefix === "string" ? body.prefix.slice(0, 10) : "";
    const count = Math.min(Math.max(parseInt(body.count, 10) || 1, 1), 100);

    if (!body.type || !["percent", "fixed", "free_shipping"].includes(body.type)) {
      return NextResponse.json({ success: false, message: "Type tidak valid." }, { status: 400 });
    }

    const result = await batchGenerateCoupons({
      prefix,
      count,
      type: body.type as CouponType,
      value: parseInt(body.value, 10) || 0,
      minOrder: body.minOrder ? parseInt(body.minOrder, 10) : 0,
      maxUsage: body.maxUsage ? parseInt(body.maxUsage, 10) : 0,
      maxPerUser: body.maxPerUser ? parseInt(body.maxPerUser, 10) : 1,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      scopeType: body.scopeType || "all",
      scopeValue: body.scopeValue || null,
      note: body.note || null,
      description: body.description || null,
    });

    await logAdminAction({
      action: "create",
      target: `coupons:batch:${result.codes.length}`,
      success: true,
      userId: auth.userId,
      userEmail: auth.email,
    });

    return NextResponse.json({
      success: true,
      created: result.created,
      codes: result.codes,
      message: `${result.created} kupon berhasil dibuat dengan prefix ${prefix}.`,
    });
  } catch (err: any) {
    console.error("[api/admin/coupons/generate] error:", err);
    return NextResponse.json({ success: false, message: "Server error." }, { status: 500 });
  }
}
