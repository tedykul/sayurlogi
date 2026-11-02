import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyAdmin, unauthorizedResponse } from "@/lib/admin-auth";
import { trackCouponShare, buildWhatsAppShareUrl, buildShareUrl, type CouponType } from "@/lib/coupon-service";

export const dynamic = "force-dynamic";

// ============================================================
// POST /api/admin/coupons/[id]/share — increment shareCount + return share URLs.
// Returns: { shareUrl, whatsappUrl }
// ============================================================

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyAdmin())) return unauthorizedResponse();
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const baseUrl = typeof body.baseUrl === "string" ? body.baseUrl : "";

    const coupon = await db.coupon.findUnique({ where: { id } });
    if (!coupon) {
      return NextResponse.json(
        { success: false, message: "Kupon tidak ditemukan." },
        { status: 404 }
      );
    }

    // Resolve base URL (env > request body > fallback)
    const origin = baseUrl || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const shareUrl = buildShareUrl(coupon.code, origin);
    const whatsappUrl = buildWhatsAppShareUrl({
      code: coupon.code,
      type: coupon.type as CouponType,
      value: coupon.value,
      expiresAt: coupon.expiresAt,
      minOrder: coupon.minOrder,
      shareUrl,
    });

    await trackCouponShare(coupon.code);

    return NextResponse.json({
      success: true,
      shareUrl,
      whatsappUrl,
    });
  } catch (err) {
    console.error("[api/admin/coupons/[id]/share] error:", err);
    return NextResponse.json(
      { success: false, message: "Server error." },
      { status: 500 }
    );
  }
}
