import QRCode from "qrcode";
import { db } from "@/lib/db";
import { buildShareUrl, type CouponType } from "@/lib/coupon-service";
import { markCouponPrinted } from "@/lib/coupon-service";

// ============================================================
// Coupon PDF renderer — generates print-ready HTML with QR codes.
// ============================================================
// Returns full HTML document (string) with embedded QR data URLs.
// Open in new tab → window.print() → save as PDF (browser native).
// No external CSS dependencies (inline styles) so output is
// portable and works without internet.
// ============================================================

interface PdfCoupon {
  id: string;
  code: string;
  type: CouponType;
  value: number;
  minOrder: number;
  maxPerUser: number;
  expiresAt: Date | null;
  description: string | null;
}

const BRAND = "SayurLogi";

// ------------------------------------------------------------
// Format discount value for display.
// ------------------------------------------------------------
function formatDiscount(c: PdfCoupon): string {
  if (c.type === "percent") return `Diskon ${c.value}%`;
  if (c.type === "fixed") return `Potongan Rp${c.value.toLocaleString("id-ID")}`;
  if (c.type === "free_shipping") return "Gratis Ongkir";
  return "Diskon";
}

function formatExpiry(d: Date | null): string {
  if (!d) return "Tanpa batas waktu";
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatMinOrder(n: number): string {
  if (n <= 0) return "Tanpa min. belanja";
  return `Min. belanja Rp${n.toLocaleString("id-ID")}`;
}

// ------------------------------------------------------------
// Render a single coupon card HTML (used in single + batch PDF).
// ------------------------------------------------------------
function renderCouponCard(c: PdfCoupon, qrDataUrl: string, shareUrl: string): string {
  return `
    <div class="coupon-card">
      <div class="coupon-head">
        <div class="brand">${BRAND}</div>
        <div class="badge">${c.type === "free_shipping" ? "🚚" : "🎫"}</div>
      </div>
      <div class="discount">${formatDiscount(c)}</div>
      <div class="qr-wrap">
        <img src="${qrDataUrl}" alt="QR ${c.code}" class="qr-img" />
      </div>
      <div class="code-label">Kode Kupon</div>
      <div class="code">${c.code}</div>
      <div class="meta">
        <div>${formatExpiry(c.expiresAt)}</div>
        <div>${formatMinOrder(c.minOrder)}</div>
        ${c.maxPerUser > 0 ? `<div>Berlaku ${c.maxPerUser}× per pelanggan</div>` : ""}
      </div>
      ${c.description ? `<div class="desc">${escapeHtml(c.description)}</div>` : ""}
      <div class="url">${shareUrl.replace(/^https?::\/\//, "")}</div>
      <div class="cut-line">✂ — — — — — — — — — — — — — — — — — — — —</div>
    </div>
  `;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ------------------------------------------------------------
// Shared HTML document wrapper (single or grid layout).
// layout: "single" (1 per page, large) | "grid" (6 per page).
// ------------------------------------------------------------
function renderHtmlDoc(title: string, body: string, layout: "single" | "grid"): string {
  const gridCols = layout === "single" ? "1" : "2";
  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title}</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #1a1a1a;
    margin: 0;
    padding: 0;
    background: #fff;
  }
  .doc-head {
    text-align: center;
    padding: 8px 0 16px;
    border-bottom: 2px solid #16a34a;
    margin-bottom: 16px;
  }
  .doc-head h1 { font-size: 20px; margin: 0; color: #16a34a; }
  .doc-head p { font-size: 11px; color: #666; margin: 4px 0 0; }
  .grid {
    display: grid;
    grid-template-columns: repeat(${gridCols}, 1fr);
    gap: 14px;
  }
  .coupon-card {
    border: 2px dashed #16a34a;
    border-radius: 12px;
    padding: 14px;
    text-align: center;
    page-break-inside: avoid;
    background: linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%);
  }
  .coupon-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }
  .brand { font-weight: 800; font-size: 14px; color: #16a34a; }
  .badge { font-size: 20px; }
  .discount {
    font-size: 22px;
    font-weight: 800;
    color: #15803d;
    margin: 6px 0 10px;
  }
  .qr-wrap { display: flex; justify-content: center; margin: 8px 0; }
  .qr-img { width: 140px; height: 140px; }
  .code-label { font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 1px; }
  .code {
    font-size: 20px;
    font-weight: 800;
    letter-spacing: 2px;
    color: #166534;
    background: #dcfce7;
    padding: 6px 10px;
    border-radius: 6px;
    margin: 4px auto 8px;
    display: inline-block;
    font-family: "Courier New", monospace;
  }
  .meta { font-size: 10px; color: #555; line-height: 1.5; }
  .desc { font-size: 10px; color: #444; margin-top: 6px; font-style: italic; }
  .url { font-size: 9px; color: #888; margin-top: 6px; word-break: break-all; }
  .cut-line { font-size: 10px; color: #aaa; margin-top: 8px; letter-spacing: 2px; }
  @media print {
    .no-print { display: none; }
    body { background: #fff; }
  }
  .no-print {
    position: fixed;
    bottom: 16px;
    right: 16px;
    background: #16a34a;
    color: #fff;
    border: none;
    padding: 10px 18px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(22,163,74,0.3);
  }
</style>
</head>
<body>
  <div class="doc-head">
    <h1>${BRAND} — Kupon Diskon</h1>
    <p>${title} · Dicetak ${new Date().toLocaleString("id-ID")}</p>
  </div>
  <div class="grid">
    ${body}
  </div>
  <button class="no-print" onclick="window.print()">🖨 Cetak / Simpan PDF</button>
  <script>
    // Auto-trigger print dialog after load (optional UX).
    // Disabled by default — user clicks button. Uncomment to auto-print:
    // window.addEventListener('load', () => setTimeout(() => window.print(), 300));
  </script>
</body>
</html>`;
}

// ------------------------------------------------------------
// Generate QR data URL for a coupon share URL.
// ------------------------------------------------------------
async function genQr(shareUrl: string): Promise<string> {
  return QRCode.toDataURL(shareUrl, {
    width: 280,
    margin: 1,
    color: { dark: "#166534", light: "#ffffff" },
    errorCorrectionLevel: "M",
  });
}

// ------------------------------------------------------------
// Render single-coupon PDF HTML.
// ------------------------------------------------------------
export async function renderSingleCouponPdf(couponId: string, origin: string): Promise<string> {
  const c = await db.coupon.findUnique({ where: { id: couponId } });
  if (!c) throw new Error("Coupon not found");

  const shareUrl = buildShareUrl(c.code, origin);
  const qr = await genQr(shareUrl);
  const body = renderCouponCard(
    {
      id: c.id,
      code: c.code,
      type: c.type as CouponType,
      value: c.value,
      minOrder: c.minOrder,
      maxPerUser: c.maxPerUser,
      expiresAt: c.expiresAt,
      description: c.description,
    },
    qr,
    shareUrl
  );

  // Mark as printed (audit)
  await markCouponPrinted([c.code]);

  return renderHtmlDoc(`Kupon ${c.code}`, body, "single");
}

// ------------------------------------------------------------
// Render batch PDF (grid of coupons).
// ------------------------------------------------------------
export async function renderBatchCouponPdf(couponIds: string[], origin: string): Promise<string> {
  const coupons = await db.coupon.findMany({
    where: { id: { in: couponIds } },
    orderBy: { createdAt: "desc" },
  });

  if (coupons.length === 0) throw new Error("No coupons found");

  // Generate QR codes in parallel
  const cards = await Promise.all(
    coupons.map(async (c) => {
      const shareUrl = buildShareUrl(c.code, origin);
      const qr = await genQr(shareUrl);
      return renderCouponCard(
        {
          id: c.id,
          code: c.code,
          type: c.type as CouponType,
          value: c.value,
          minOrder: c.minOrder,
          maxPerUser: c.maxPerUser,
          expiresAt: c.expiresAt,
          description: c.description,
        },
        qr,
        shareUrl
      );
    })
  );

  await markCouponPrinted(coupons.map((c) => c.code));

  return renderHtmlDoc(`${coupons.length} Kupon`, cards.join(""), "grid");
}
