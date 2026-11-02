import { db } from "@/lib/db";

// ============================================================
// Coupon service — shared logic for validate / apply / calculate.
// ============================================================
// All coupon-related business rules live here so API routes stay
// thin and consistent. Pure functions where possible; db calls
// only when state mutation is required.
// ============================================================

export type CouponType = "percent" | "fixed" | "free_shipping";

export interface CouponWithUsage {
  id: string;
  code: string;
  type: CouponType;
  value: number;
  minOrder: number;
  maxUsage: number;
  maxPerUser: number;
  usedCount: number;
  startsAt: Date | null;
  expiresAt: Date | null;
  active: boolean;
  scopeType: string;
  scopeValue: string | null;
  description: string | null;
  note: string | null;
  clickCount: number;
  shareCount: number;
  printedCount: number;
  createdAt: Date;
  updatedAt: Date;
  _count?: { usages: number };
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
  code: string;
  discount: number; // IDR amount off
  freeShipping: boolean;
  coupon?: CouponWithUsage;
}

export interface CartLine {
  productId: string;
  name: string;
  price: number; // IDR unit price
  quantity: number;
  category?: string;
}

// ------------------------------------------------------------
// Calculate discount amount for a cart given a coupon.
// Returns { discount, freeShipping }.
// ------------------------------------------------------------
export function calculateDiscount(
  coupon: CouponWithUsage,
  lines: CartLine[],
  shippingFee: number
): { discount: number; freeShipping: boolean } {
  // Scope filter: only count eligible lines toward subtotal.
  const eligibleLines =
    coupon.scopeType === "category" && coupon.scopeValue
      ? lines.filter((l) => l.category === coupon.scopeValue)
      : coupon.scopeType === "product" && coupon.scopeValue
        ? lines.filter((l) => l.productId === coupon.scopeValue)
        : lines;

  const subtotal = eligibleLines.reduce(
    (sum, l) => sum + l.price * l.quantity,
    0
  );

  if (coupon.type === "free_shipping") {
    return { discount: 0, freeShipping: true };
  }

  if (coupon.type === "percent") {
    const pct = Math.max(0, Math.min(100, coupon.value));
    return { discount: Math.floor((subtotal * pct) / 100), freeShipping: false };
  }

  // fixed
  return { discount: Math.min(coupon.value, subtotal), freeShipping: false };
}

// ------------------------------------------------------------
// Validate a coupon against a cart + customer without persisting.
// Used by both storefront "apply coupon" and checkout pre-check.
// ------------------------------------------------------------
export async function validateCoupon(
  code: string,
  lines: CartLine[],
  customer?: { email?: string | null; phone?: string | null },
  shippingFee = 0
): Promise<ValidationResult> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) {
    return { valid: false, reason: "Kode kupon kosong.", code: normalized, discount: 0, freeShipping: false };
  }

  const coupon = await db.coupon.findUnique({
    where: { code: normalized },
    include: { _count: { select: { usages: true } } },
  });

  if (!coupon) {
    return { valid: false, reason: "Kode kupon tidak ditemukan.", code: normalized, discount: 0, freeShipping: false };
  }

  if (!coupon.active) {
    return { valid: false, reason: "Kupon tidak aktif.", code: normalized, discount: 0, freeShipping: false, coupon };
  }

  const now = new Date();
  if (coupon.startsAt && now < coupon.startsAt) {
    return { valid: false, reason: "Kupon belum berlaku.", code: normalized, discount: 0, freeShipping: false, coupon };
  }
  if (coupon.expiresAt && now > coupon.expiresAt) {
    return { valid: false, reason: "Kupon sudah kedaluwarsa.", code: normalized, discount: 0, freeShipping: false, coupon };
  }

  if (coupon.maxUsage > 0 && coupon.usedCount >= coupon.maxUsage) {
    return { valid: false, reason: "Kuota kupon sudah habis.", code: normalized, discount: 0, freeShipping: false, coupon };
  }

  // Per-customer usage check
  if (coupon.maxPerUser > 0 && customer && (customer.email || customer.phone)) {
    const orClauses: { email?: string; phone?: string }[] = [];
    if (customer.email) orClauses.push({ email: customer.email });
    if (customer.phone) orClauses.push({ phone: customer.phone });
    const userUsage = await db.couponUsage.count({
      where: { couponId: coupon.id, OR: orClauses },
    });
    if (userUsage >= coupon.maxPerUser) {
      return { valid: false, reason: "Anda sudah pernah memakai kupon ini.", code: normalized, discount: 0, freeShipping: false, coupon };
    }
  }

  // Min order check (uses eligible lines, same as discount calc)
  const { discount, freeShipping } = calculateDiscount(coupon as CouponWithUsage, lines, shippingFee);

  if (coupon.minOrder > 0) {
    const subtotal = lines.reduce((sum, l) => sum + l.price * l.quantity, 0);
    if (subtotal < coupon.minOrder) {
      return {
        valid: false,
        reason: `Minimal belanja Rp${coupon.minOrder.toLocaleString("id-ID")} untuk kupon ini.`,
        code: normalized,
        discount: 0,
        freeShipping: false,
        coupon: coupon as CouponWithUsage,
      };
    }
  }

  return { valid: true, code: normalized, discount, freeShipping, coupon: coupon as CouponWithUsage };
}

// ------------------------------------------------------------
// Commit a coupon usage (called after order is created).
// Idempotent: skips if usage already recorded for this orderId.
// ------------------------------------------------------------
export async function recordCouponUsage(params: {
  couponId: string;
  code: string;
  orderId?: string;
  email?: string | null;
  phone?: string | null;
  discount: number;
}): Promise<void> {
  // Skip if already recorded for this order (idempotent)
  if (params.orderId) {
    const existing = await db.couponUsage.findFirst({
      where: { orderId: params.orderId, couponId: params.couponId },
    });
    if (existing) return;
  }

  await db.$transaction([
    db.couponUsage.create({
      data: {
        couponId: params.couponId,
        code: params.code,
        orderId: params.orderId ?? null,
        email: params.email ?? null,
        phone: params.phone ?? null,
        discount: params.discount,
      },
    }),
    db.coupon.update({
      where: { id: params.couponId },
      data: { usedCount: { increment: 1 } },
    }),
  ]);
}

// ------------------------------------------------------------
// Increment click counter (when ?coupon=CODE link opened).
// Silent failure — analytics must never break storefront.
// ------------------------------------------------------------
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

// ------------------------------------------------------------
// Increment share counter (admin clicked Copy/WA share button).
// ------------------------------------------------------------
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

// ------------------------------------------------------------
// Mark a coupon as printed (PDF exported). Used for audit.
// ------------------------------------------------------------
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

// ------------------------------------------------------------
// Generate a random coupon code. Format: PREFIX + 6 alphanumeric.
// Collision-free: caller should retry on unique violation.
// ------------------------------------------------------------
export function generateCode(prefix?: string, length = 6): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I,O,0,1 (readable)
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return prefix ? `${prefix.toUpperCase()}${code}` : code;
}

// ------------------------------------------------------------
// Build absolute share URL for a coupon code.
// Uses NEXT_PUBLIC_APP_URL env (fallback: request origin).
// ------------------------------------------------------------
export function buildShareUrl(code: string, baseUrl: string): string {
  const url = new URL("/", baseUrl);
  url.searchParams.set("coupon", code.toUpperCase());
  return url.toString();
}

// ------------------------------------------------------------
// Build wa.me share link with pre-filled marketing message.
// ------------------------------------------------------------
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
    const d = params.expiresAt.toLocaleDateString("id-ID", {
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
