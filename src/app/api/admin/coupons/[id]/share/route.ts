import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import {
  buildShareUrl,
  buildWhatsAppShareUrl,
  trackCouponShare,
} from "@/lib/coupon-service";
import { logAdminAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ id: string }>;
}

// ============================================================
// POST /api/admin/coupons/[id]/share
// ============================================================
// Body: { baseUrl? }
// Returns: { shareUrl, whatsappUrl, code }
//
// Side-effect: increments shareCount + logs audit action.
// The admin UI opens `whatsappUrl` (wa.me/?text=...) in a new
// tab so the admin can pick a recipient.
// ============================================================

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await verifyAuth();
  if (!auth) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const baseUrl =
      (typeof body.baseUrl === "string" && body.baseUrl) ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";

    const coupon = await db.coupon.findUnique({
      where: { id },
      select: {
        code: true,
        type: true,
        value: true,
        expiresAt: true,
        minOrder: true,
      },
    });

    if (!coupon) {
      return NextResponse.json(
        { success: false, message: "Kupon tidak ditemukan." },
        { status: 404 }
      );
    }

    const shareUrl = buildShareUrl(coupon.code, baseUrl);
    const whatsappUrl = buildWhatsAppShareUrl({
      code: coupon.code,
      type: coupon.type as "percent" | "fixed" | "free_shipping",
      value: coupon.value,
      expiresAt: coupon.expiresAt,
      minOrder: coupon.minOrder,
      shareUrl,
    });

    // Track share (best-effort, non-blocking)
    trackCouponShare(coupon.code).catch(() => {});
    logAdminAction({
      action: "coupon_share",
      target: `coupon:${coupon.code}`,
      success: true,
      userId: auth.userId,
      userEmail: auth.email,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      shareUrl,
      whatsappUrl,
      code: coupon.code,
    });
  } catch (err: any) {
    console.error("[api/admin/coupons/[id]/share] error:", err);
    return NextResponse.json({ success: false, message: "Server error." }, { status: 500 });
  }
}
