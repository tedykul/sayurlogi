import { db } from "@/lib/db";
import QRCode from "qrcode";
import type { CouponType } from "@/lib/coupons";

// ============================================================
// Coupon Service — QR Code + Share via WhatsApp + PDF Export.
// ============================================================
// Extends the existing coupon module (lib/coupons.ts) with:
//   - generateCode(): batch generate coupon codes
//   - buildShareUrl(): absolute URL for ?coupon=CODE auto-apply
//   - buildWhatsAppShareUrl(): wa.me link with pre-filled message
//   - trackCouponClick(): increment clickCount when link opened
//   - trackCouponShare(): increment shareCount when admin shares
//   - markCouponPrinted(): increment printedCount + set printedAt
//   - generateQRCodeDataURL(): QR code as base64 data URL
//
// All functions are backward compatible — they only ADD fields
// that were already added to the Coupon model (batchId,
// description, clickCount, shareCount, printedCount, printedAt).
// ============================================================

/** Generate a random coupon code. Format: PREFIX + 6 alphanumeric. */
export function generateCode(prefix?: string, length = 6): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I,O,0,1 (readable)
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return prefix ? `${prefix.toUpperCase()}${code}` : code;
}

/** Build absolute share URL for a coupon code. */
export function buildShareUrl(code: string, baseUrl: string): string {
  const url = new URL("/", baseUrl);
  url.searchParams.set("coupon", code.toUpperCase());
  return url.toString();
}

/** Build wa.me share link with pre-filled marketing message. */
export function buildWhatsAppShareUrl(params: {
  code: string;
  type: CouponType;
  value: number;
  expiresAt?: Date | null;
  minOrder?: number;
  shareUrl: string;
}): string {
  const lines: string[] = ["🎫 Diskon Spesial!"];
  lines.push("");
  lines.push(`Kode: ${params.code}`);

  if (params.type === "percent") {
    lines.push(`Diskon: ${params.value}%`);
  } else if (params.type === "fixed") {
    lines.push(`Potongan: Rp${params.value.toLocaleString("id-ID")}`);
  } else if (params.type === "free_shipping") {
    lines.push(`Gratis ongkir!`);
  }

  if (params.minOrder && params.minOrder > 0) {
    lines.push(`Min. belanja: Rp${params.minOrder.toLocaleString("id-ID")}`);
  }
  if (params.expiresAt) {
    const d = new Date(params.expiresAt).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    lines.push(`Berlaku s/d ${d}`);
  }

  lines.push("");
  lines.push(`Klaim sekarang:`);
  lines.push(params.shareUrl);

  const text = encodeURIComponent(lines.join("\n"));
  return `https://wa.me/?text=${text}`;
}

/** Generate QR Code as base64 data URL (for PDF + browser display). */
export async function generateQRCodeDataURL(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    width: 200,
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
    errorCorrectionLevel: "M",
  });
}

// ============================================================
// Tracking functions — increment counters (best-effort).
// ============================================================

export async function trackCouponClick(code: string): Promise<void> {
  try {
    await db.coupon.update({
      where: { code: code.trim().toUpperCase() },
      data: { clickCount: { increment: 1 } },
    });
  } catch {
    // Coupon may not exist — ignore silently.
  }
}

export async function trackCouponShare(code: string): Promise<void> {
  try {
    await db.coupon.update({
      where: { code: code.trim().toUpperCase() },
      data: { shareCount: { increment: 1 } },
    });
  } catch {
    // ignore
  }
}

export async function markCouponPrinted(codes: string[]): Promise<void> {
  try {
    await db.coupon.updateMany({
      where: { code: { in: codes.map((c) => c.toUpperCase()) } },
      data: {
        printedCount: { increment: 1 },
        printedAt: new Date(),
      },
    });
  } catch {
    // ignore
  }
}

// ============================================================
// Batch generate coupons.
// ============================================================

export async function batchGenerateCoupons(opts: {
  prefix: string;
  count: number;
  type: CouponType;
  value: number;
  minOrder?: number;
  maxUsage?: number;
  maxPerUser?: number;
  expiresAt?: Date | null;
  scopeType?: string;
  scopeValue?: string;
  note?: string;
  description?: string;
}): Promise<{ created: number; codes: string[] }> {
  const codes: string[] = [];
  let created = 0;

  for (let i = 0; i < opts.count; i++) {
    let attempts = 0;
    while (attempts < 5) {
      const code = generateCode(opts.prefix);
      try {
        const coupon = await db.coupon.create({
          data: {
            code,
            type: opts.type,
            value: opts.value,
            minOrder: opts.minOrder ?? 0,
            maxUsage: opts.maxUsage ?? 0,
            maxPerUser: opts.maxPerUser ?? 1,
            expiresAt: opts.expiresAt ?? null,
            scopeType: opts.scopeType ?? "all",
            scopeValue: opts.scopeValue ?? null,
            note: opts.note ?? null,
            description: opts.description ?? null,
            batchId: `batch-${Date.now()}`,
          },
        });
        codes.push(coupon.code);
        created++;
        break;
      } catch (err: any) {
        // Unique constraint — code already exists, retry
        if (err.code === "P2002") {
          attempts++;
          continue;
        }
        throw err;
      }
    }
  }

  return { created, codes };
}
