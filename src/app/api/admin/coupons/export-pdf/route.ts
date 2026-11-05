import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { generateQRCodeDataURL, markCouponPrinted } from "@/lib/coupon-service";
import { formatIDR } from "@/lib/mock-data";

export const dynamic = "force-dynamic";

// ============================================================
// GET  /api/admin/coupons/export-pdf?ids=id1,id2,id3
// POST /api/admin/coupons/export-pdf   { ids: string[] }
// ============================================================
// Returns a printable HTML page with multiple coupon cards +
// QR codes. Admin opens it in a new tab and uses Ctrl+P → Save
// as PDF. Each QR encodes the share URL (/?coupon=CODE).
//
// Side-effect: increments printedCount + sets printedAt for
// every coupon in the batch (best-effort).
// ============================================================

function parseIds(req: NextRequest): string[] {
  // GET: read ?ids=id1,id2 (comma-separated)
  const url = new URL(req.url);
  const idsParam = url.searchParams.get("ids") || "";
  if (idsParam) {
    return idsParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

async function buildPdf(ids: string[]): Promise<NextResponse> {
  if (ids.length === 0) {
    return NextResponse.json(
      { success: false, message: "Pilih minimal 1 kupon." },
      { status: 400 }
    );
  }

  const coupons = await db.coupon.findMany({
    where: { id: { in: ids } },
    orderBy: { code: "asc" },
  });

  if (coupons.length === 0) {
    return NextResponse.json(
      { success: false, message: "Kupon tidak ditemukan." },
      { status: 404 }
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // Generate QR codes for all coupons in parallel
  const couponsWithQR = await Promise.all(
    coupons.map(async (c) => {
      const shareUrl = `${baseUrl}/?coupon=${c.code}`;
      const qrDataUrl = await generateQRCodeDataURL(shareUrl);
      return { ...c, shareUrl, qrDataUrl };
    })
  );

  // Mark all as printed (best-effort, non-blocking)
  markCouponPrinted(coupons.map((c) => c.code)).catch(() => {});

  const cards = couponsWithQR
    .map((c) => {
      const discountText =
        c.type === "percent"
          ? `${c.value}% OFF`
          : c.type === "fixed"
            ? `${formatIDR(c.value)} OFF`
            : "GRATIS ONGKIR";
      return `<div class="coupon-card">
  <div class="coupon-header">
    <h1>🌿 SayurLogi</h1>
    <p>Kupon Diskon</p>
  </div>
  <div class="coupon-body">
    <div class="discount">${discountText}</div>
    <div class="code">${c.code}</div>
    ${c.minOrder > 0 ? `<p class="min-order">Min. belanja ${formatIDR(c.minOrder)}</p>` : ""}
    ${c.expiresAt ? `<p class="expires">s/d ${new Date(c.expiresAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>` : ""}
    <div class="qr"><img src="${c.qrDataUrl}" alt="QR" /></div>
  </div>
  <div class="coupon-footer">SayurLogi</div>
</div>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<title>Export Kupon — SayurLogi</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, sans-serif; background: #f0fdf4; padding: 20px; display: flex; flex-wrap: wrap; gap: 16px; justify-content: center; }
  .coupon-card { width: 300px; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08); border: 2px dashed #16a34a; page-break-inside: avoid; }
  .coupon-header { background: #16a34a; color: white; padding: 16px; text-align: center; }
  .coupon-header h1 { font-size: 18px; font-weight: 800; }
  .coupon-header p { font-size: 11px; opacity: 0.9; margin-top: 2px; }
  .coupon-body { padding: 20px; text-align: center; }
  .discount { font-size: 28px; font-weight: 900; color: #16a34a; margin: 4px 0; }
  .code { font-size: 16px; font-weight: 700; font-family: monospace; background: #f0fdf4; padding: 6px 14px; border-radius: 6px; display: inline-block; margin: 6px 0; letter-spacing: 1px; }
  .min-order, .expires { font-size: 10px; color: #64748b; }
  .qr { margin: 12px auto; }
  .qr img { width: 140px; height: 140px; }
  .coupon-footer { border-top: 1px solid #e2e8f0; padding: 8px; text-align: center; font-size: 9px; color: #94a3b8; }
  @media print { body { background: white; padding: 0; } .coupon-card { box-shadow: none; } }
</style>
</head>
<body>
${cards}
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function GET(req: NextRequest) {
  const auth = await verifyAuth();
  if (!auth) {
    return NextResponse.json(
      { success: false, message: "Unauthorized." },
      { status: 401 }
    );
  }
  try {
    const ids = parseIds(req);
    return await buildPdf(ids);
  } catch (err: any) {
    console.error("[api/admin/coupons/export-pdf] GET error:", err);
    return NextResponse.json(
      { success: false, message: "Server error." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await verifyAuth();
  if (!auth) {
    return NextResponse.json(
      { success: false, message: "Unauthorized." },
      { status: 401 }
    );
  }
  try {
    const body = await req.json().catch(() => ({}));
    const ids: string[] = Array.isArray(body.ids) ? body.ids : [];
    return await buildPdf(ids);
  } catch (err: any) {
    console.error("[api/admin/coupons/export-pdf] POST error:", err);
    return NextResponse.json(
      { success: false, message: "Server error." },
      { status: 500 }
    );
  }
}
