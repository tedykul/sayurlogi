import { db } from "@/lib/db";

// ============================================================
// Shipping config + calculator.
// ============================================================
// Reads from SiteSetting.freeShippingThreshold + shippingFee (set by
// admin). Falls back to DEFAULT_* when DB row missing or field null.
// ============================================================

export const DEFAULT_FREE_SHIPPING_THRESHOLD = 100_000; // IDR
export const DEFAULT_SHIPPING_FEE = 9_000; // IDR

export interface ShippingConfig {
  freeShippingThreshold: number;
  shippingFee: number;
}

/** Read the current shipping config (DB → fallback to defaults). */
export async function getShippingConfig(): Promise<ShippingConfig> {
  try {
    const row = await db.siteSetting.findUnique({
      where: { id: "singleton" },
      select: { freeShippingThreshold: true, shippingFee: true },
    });
    return {
      freeShippingThreshold:
        row?.freeShippingThreshold != null
          ? row.freeShippingThreshold
          : DEFAULT_FREE_SHIPPING_THRESHOLD,
      shippingFee:
        row?.shippingFee != null ? row.shippingFee : DEFAULT_SHIPPING_FEE,
    };
  } catch (err) {
    console.error("[shipping] getShippingConfig failed:", err);
    return {
      freeShippingThreshold: DEFAULT_FREE_SHIPPING_THRESHOLD,
      shippingFee: DEFAULT_SHIPPING_FEE,
    };
  }
}

export interface ShippingCalculation {
  /** Subtotal of items (before shipping/discount) */
  subtotal: number;
  /** Calculated shipping fee (0 if free shipping applies) */
  shipping: number;
  /** Whether free shipping was applied */
  freeShipping: boolean;
  /** Amount remaining to qualify for free shipping (0 if qualified) */
  remainingForFreeShipping: number;
}

/**
 * Calculate shipping fee based on subtotal + config.
 * Free shipping when subtotal >= freeShippingThreshold.
 */
export async function calculateShipping(
  subtotal: number,
  config?: ShippingConfig
): Promise<ShippingCalculation> {
  const cfg = config ?? (await getShippingConfig());
  const freeShipping = subtotal >= cfg.freeShippingThreshold;
  const shipping = freeShipping ? 0 : cfg.shippingFee;
  const remainingForFreeShipping = freeShipping
    ? 0
    : Math.max(0, cfg.freeShippingThreshold - subtotal);
  return { subtotal, shipping, freeShipping, remainingForFreeShipping };
}
