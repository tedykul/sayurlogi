import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { generateQRCodeDataURL, markCouponPrinted } from "@/lib/coupon-service";
import { formatIDR } from "@/lib/mock-data";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ id: string }>;
}

// ============================================================
// POST /api/admin/coupons/[id]/pdf
// ============================================================
// Returns HTML page with coupon + QR code (printable as PDF).
// Admin opens in new tab, then Ctrl+P → Save as PDF.
// ============================================================

export async function POST(_req: NextRequest, { params }: Params) {
  const auth = await verifyAuth();
  if (!auth) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const coupon = await db.coupon.findUnique({ where: { id } });

    if (!coupon) {
      return NextResponse.json(
        { success: false, message: "Kupon tidak ditemukan." },
        { status: 404 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const shareUrl = `${baseUrl}/?coupon=${coupon.code}`;
    const qrDataUrl = await generateQRCodeDataURL(shareUrl);

    // Mark as printed
    markCouponPrinted([coupon.code]).catch(() => {});

    // Return printable HTML
    const discountText =
      coupon.type === "percent"
        ? `${coupon.value}% OFF`
        : coupon.type === "fixed"
          ? `Rp${coupon.value.toLocaleString("id-ID")} OFF`
          : "GRATIS ONGKIR";

    const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<title>Kupon ${coupon.code} — SayurLogi</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, sans-serif; background: #f0fdf4; padding: 20px; display: flex; justify-content: center; }
  .coupon-card {
    width: 350px; background: white; border-radius: 16px; overflow: hidden;
    box-shadow: 0 4px 24px rgba(0,0,0,0.1); border: 2px dashed #16a34a;
  }
  .coupon-header { background: #16a34a; color: white; padding: 20px; text-align: center; }
  .coupon-header h1 { font-size: 20px; font-weight: 800; }
  .coupon-header p { font-size: 12px; opacity: 0.9; margin-top: 4px; }
  .coupon-body { padding: 24px; text-align: center; }
  .discount { font-size: 32px; font-weight: 900; color: #16a34a; margin: 8px 0; }
  .code { font-size: 18px; font-weight: 700; font-family: monospace; background: #f0fdf4; padding: 8px 16px; border-radius: 8px; display: inline-block; margin: 8px 0; letter-spacing: 1px; }
  .qr { margin: 16px auto; }
  .qr img { width: 160px; height: 160px; }
  .instructions { font-size: 11px; color: #64748b; margin-top: 12px; line-height: 1.5; }
  .coupon-footer { border-top: 1px solid #e2e8f0; padding: 12px; text-align: center; font-size: 10px; color: #94a3b8; }
  @media print { body { background: white; padding: 0; } .coupon-card { box-shadow: none; border: 1px solid #16a34a; } }
</style>
</head>
<body>
  <div class="coupon-card">
    <div class="coupon-header">
      <h1>🌿 SayurLogi</h1>
      <p>Kupon Diskon Spesial</p>
    </div>
    <div class="coupon-body">
      <div class="discount">${discountText}</div>
      <div class="code">${coupon.code}</div>
      ${coupon.minOrder > 0 ? `<p style="font-size:11px;color:#64748b;">Min. belanja ${formatIDR(coupon.minOrder)}</p>` : ""}
      ${coupon.expiresAt ? `<p style="font-size:11px;color:#64748b;">Berlaku s/d ${new Date(coupon.expiresAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>` : ""}
      <div class="qr"><img src="${qrDataUrl}" alt="QR Code" /></div>
      <p class="instructions">
        Scan QR code di atas atau kunjungi:<br>
        <strong>${shareUrl}</strong><br><br>
        Kupon otomatis diterapkan saat Anda membuka link.
      </p>
    </div>
    <div class="coupon-footer">
      SayurLogi — Sayur & Buah Segar • sayurlogi.id
    </div>
  </div>
</body>
</html>`;

    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (err: any) {
    console.error("[api/admin/coupons/[id]/pdf] error:", err);
    return NextResponse.json({ success: false, message: "Server error." }, { status: 500 });
  }
}
