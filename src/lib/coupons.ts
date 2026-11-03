import { db } from "@/lib/db";

// ============================================================
// Coupons — validate, calculate, redeem.
// ============================================================
// Dual-layer with ERPNext Pricing Rule:
//   - This module handles customer-input codes (WELCOME10, etc.)
//   - ERPNext Pricing Rule handles automatic per-item discounts
//     (synced into Product price separately).
//
// Three coupon types:
//   percent       — value = 1..100 (percent off subtotal)
//   fixed         — value = IDR amount off subtotal
//   free_shipping — value ignored; sets shipping to 0
//
// Anti-abuse:
//   - maxUsage (total cap), maxPerUser (per-customer cap)
//   - Customer identified by email OR phone (guest checkout)
//   - redeemCoupon is atomic (transaction: increment + insert usage)
// ============================================================

export type CouponType = "percent" | "fixed" | "free_shipping";
export type CouponScope = "all" | "category" | "product";

export interface Coupon {
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
  scopeType: CouponScope;
  scopeValue: string | null;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ValidateContext {
  /// Cart subtotal (IDR), before shipping/discount.
  subtotal: number;
  /// Customer email (for per-user limit). Either email or phone
  /// is enough to identify a guest customer.
  email?: string | null;
  /// Customer phone (fallback identifier).
  phone?: string | null;
  /// Cart items (for scope checks: category/product).
  items?: Array<{ itemCode?: string; category?: string }>;
}

export interface ValidationResult {
  valid: boolean;
  message: string;
  coupon?: Coupon;
  /// Discount amount in IDR (off subtotal). 0 for free_shipping
  /// (the caller handles shipping separately).
  discountAmount: number;
  /// True when the coupon grants free shipping (type=free_shipping).
  freeShipping: boolean;
}

// ============================================================
// Validate — check a coupon code against the current cart +
// customer. Does NOT increment usage (use redeemCoupon after
// checkout succeeds). Safe to call multiple times.
// ============================================================

export async function validateCoupon(
  code: string,
  ctx: ValidateContext
): Promise<ValidationResult> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) {
    return { valid: false, message: "Kode kupon kosong.", discountAmount: 0, freeShipping: false };
  }

  const row = await db.coupon.findUnique({ where: { code: normalized } });
  if (!row) {
    return { valid: false, message: "Kode kupon tidak ditemukan.", discountAmount: 0, freeShipping: false };
  }

  const coupon = rowToCoupon(row);

  if (!coupon.active) {
    return { valid: false, message: "Kupon ini sudah tidak aktif.", discountAmount: 0, freeShipping: false, coupon };
  }

  const now = new Date();
  if (coupon.startsAt && now < coupon.startsAt) {
    return { valid: false, message: "Kupon belum berlaku.", discountAmount: 0, freeShipping: false, coupon };
  }
  if (coupon.expiresAt && now > coupon.expiresAt) {
    return { valid: false, message: "Kupon sudah kedaluwarsa.", discountAmount: 0, freeShipping: false, coupon };
  }

  if (coupon.maxUsage > 0 && coupon.usedCount >= coupon.maxUsage) {
    return { valid: false, message: "Kuota kupon sudah habis.", discountAmount: 0, freeShipping: false, coupon };
  }

  if (coupon.minOrder > 0 && ctx.subtotal < coupon.minOrder) {
    return {
      valid: false,
      message: `Minimum belanja Rp ${coupon.minOrder.toLocaleString("id-ID")} untuk kupon ini.`,
      discountAmount: 0,
      freeShipping: false,
      coupon,
    };
  }

  // Scope check (category/product)
  if (coupon.scopeType === "category" && ctx.items) {
    const hasCat = ctx.items.some((i) => i.category === coupon.scopeValue);
    if (!hasCat) {
      return {
        valid: false,
        message: `Kupon hanya berlaku untuk kategori ${coupon.scopeValue}.`,
        discountAmount: 0,
        freeShipping: false,
        coupon,
      };
    }
  } else if (coupon.scopeType === "product" && ctx.items) {
    const hasProd = ctx.items.some((i) => i.itemCode === coupon.scopeValue);
    if (!hasProd) {
      return {
        valid: false,
        message: `Kupon hanya berlauk untuk produk tertentu.`,
        discountAmount: 0,
        freeShipping: false,
        coupon,
      };
    }
  }

  // Per-user usage check
  if (coupon.maxPerUser > 0 && (ctx.email || ctx.phone)) {
    const userUsageCount = await db.couponUsage.count({
      where: {
        couponId: coupon.id,
        OR: [
          ...(ctx.email ? [{ email: ctx.email }] : []),
          ...(ctx.phone ? [{ phone: ctx.phone }] : []),
        ],
      },
    });
    if (userUsageCount >= coupon.maxPerUser) {
      return {
        valid: false,
        message: "Anda sudah pernah memakai kupon ini.",
        discountAmount: 0,
        freeShipping: false,
        coupon,
      };
    }
  }

  // Calculate discount
  const calc = calculateDiscount(coupon, ctx.subtotal);

  return {
    valid: true,
    message: calc.freeShipping
      ? "Kupon diterapkan: gratis ongkir!"
      : `Kupon diterapkan: hemat Rp ${calc.discountAmount.toLocaleString("id-ID")}.`,
    coupon,
    discountAmount: calc.discountAmount,
    freeShipping: calc.freeShipping,
  };
}

// ============================================================
// Calculate — pure function: discount amount from coupon type.
// ============================================================

export function calculateDiscount(
  coupon: Pick<Coupon, "type" | "value">,
  subtotal: number
): { discountAmount: number; freeShipping: boolean } {
  if (coupon.type === "free_shipping") {
    return { discountAmount: 0, freeShipping: true };
  }
  if (coupon.type === "percent") {
    const pct = Math.max(0, Math.min(100, coupon.value));
    return { discountAmount: Math.round((subtotal * pct) / 100), freeShipping: false };
  }
  // fixed
  return { discountAmount: Math.min(coupon.value, subtotal), freeShipping: false };
}

// ============================================================
// Redeem — atomically increment usedCount + insert CouponUsage.
// ============================================================
// Call ONLY after the order is successfully created. If the
// transaction fails (e.g., race condition exceeding maxUsage),
// the order still succeeds — the coupon is best-effort.
//
// Returns the CouponUsage row id, or null if coupon not found.
// ============================================================

export async function redeemCoupon(opts: {
  couponId: string;
  code: string;
  orderId?: string;
  email?: string | null;
  phone?: string | null;
  userId?: string | null;
  discount: number;
}): Promise<string | null> {
  try {
    const result = await db.$transaction(async (tx) => {
      // Lock-ish: re-read current usedCount inside the transaction.
      const coupon = await tx.coupon.findUnique({ where: { id: opts.couponId } });
      if (!coupon) return null;

      // Enforce maxUsage one more time (race-safe inside tx).
      if (coupon.maxUsage > 0 && coupon.usedCount >= coupon.maxUsage) {
        return null;
      }

      const usage = await tx.couponUsage.create({
        data: {
          couponId: opts.couponId,
          code: opts.code,
          orderId: opts.orderId ?? null,
          email: opts.email ?? null,
          phone: opts.phone ?? null,
          userId: opts.userId ?? null,
          discount: opts.discount,
        },
      });

      await tx.coupon.update({
        where: { id: opts.couponId },
        data: { usedCount: { increment: 1 } },
      });

      return usage.id;
    });
    return result;
  } catch (err) {
    console.error("[coupons] redeemCoupon failed (non-blocking):", err);
    return null;
  }
}

// ============================================================
// Helpers — DB row → typed Coupon.
// ============================================================

function rowToCoupon(row: {
  id: string;
  code: string;
  type: string;
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
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
}): Coupon {
  return {
    id: row.id,
    code: row.code,
    type: normalizeType(row.type),
    value: row.value,
    minOrder: row.minOrder,
    maxUsage: row.maxUsage,
    maxPerUser: row.maxPerUser,
    usedCount: row.usedCount,
    startsAt: row.startsAt,
    expiresAt: row.expiresAt,
    active: row.active,
    scopeType: normalizeScope(row.scopeType),
    scopeValue: row.scopeValue,
    note: row.note,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function normalizeType(t: string): CouponType {
  if (t === "percent" || t === "fixed" || t === "free_shipping") return t;
  return "fixed";
}

function normalizeScope(s: string): CouponScope {
  if (s === "all" || s === "category" || s === "product") return s;
  return "all";
}
