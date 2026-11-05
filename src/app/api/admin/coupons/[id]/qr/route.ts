import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import {
  buildShareUrl,
  generateQRCodeDataURL,
} from "@/lib/coupon-service";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ id: string }>;
}

// ============================================================
// GET /api/admin/coupons/[id]/qr
// ============================================================
// Lightweight: returns { code, shareUrl, qrDataUrl } so the
// admin UI can show an inline QR preview inside a Dialog
// without loading the full printable PDF HTML.
//
// The QR encodes the absolute share URL (/?coupon=CODE) so
// scanning it on a phone opens the storefront and auto-applies
// the coupon.
// ============================================================

export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await verifyAuth();
  if (!auth) {
    return NextResponse.json(
      { success: false, message: "Unauthorized." },
      { status: 401 }
    );
  }

  try {
    const { id } = await params;
    const coupon = await db.coupon.findUnique({
      where: { id },
      select: { code: true },
    });

    if (!coupon) {
      return NextResponse.json(
        { success: false, message: "Kupon tidak ditemukan." },
        { status: 404 }
      );
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const shareUrl = buildShareUrl(coupon.code, baseUrl);
    const qrDataUrl = await generateQRCodeDataURL(shareUrl);

    return NextResponse.json({
      success: true,
      code: coupon.code,
      shareUrl,
      qrDataUrl,
    });
  } catch (err: any) {
    console.error("[api/admin/coupons/[id]/qr] error:", err);
    return NextResponse.json(
      { success: false, message: "Server error." },
      { status: 500 }
    );
  }
}
