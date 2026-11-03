import { db } from "@/lib/db";

// ============================================================
// Reward program — returning customer discount.
// ============================================================
// Config (admin-editable via SiteSetting):
//   rewardOrderCount        — Nth order that qualifies (e.g., every 5th)
//   rewardDiscountPercent   — discount % applied to qualifying order
//
// Logic:
//   - Count customer's completed orders by email or phone.
//   - If count + 1 (current order) is a multiple of rewardOrderCount,
//     apply rewardDiscountPercent discount.
//
// Example: rewardOrderCount=5, rewardDiscountPercent=10
//   - 5th order → 10% off
//   - 10th order → 10% off
//   - 15th order → 10% off
// ============================================================

export interface RewardConfig {
  orderCount: number;
  discountPercent: number;
}

export const DEFAULT_REWARD_ORDER_COUNT = 5;
export const DEFAULT_REWARD_DISCOUNT_PERCENT = 10;

/** Read the current reward config (DB → fallback to defaults). */
export async function getRewardConfig(): Promise<RewardConfig> {
  try {
    const row = await db.siteSetting.findUnique({
      where: { id: "singleton" },
      select: { rewardOrderCount: true, rewardDiscountPercent: true },
    });
    return {
      orderCount:
        row?.rewardOrderCount != null && row.rewardOrderCount > 0
          ? row.rewardOrderCount
          : DEFAULT_REWARD_ORDER_COUNT,
      discountPercent:
        row?.rewardDiscountPercent != null && row.rewardDiscountPercent > 0
          ? row.rewardDiscountPercent
          : DEFAULT_REWARD_DISCOUNT_PERCENT,
    };
  } catch (err) {
    console.error("[reward] getRewardConfig failed:", err);
    return {
      orderCount: DEFAULT_REWARD_ORDER_COUNT,
      discountPercent: DEFAULT_REWARD_DISCOUNT_PERCENT,
    };
  }
}

/** Count a customer's past orders by email OR phone. */
export async function countCustomerOrders(
  email?: string | null,
  phone?: string | null
): Promise<number> {
  if (!email && !phone) return 0;
  try {
    const or: { customerEmail?: string; customerPhone?: string }[] = [];
    if (email) or.push({ customerEmail: email });
    if (phone) or.push({ customerPhone: phone });
    return await db.order.count({
      where: {
        OR: or,
        status: { notIn: ["cancelled"] },
      },
    });
  } catch (err) {
    console.error("[reward] countCustomerOrders failed:", err);
    return 0;
  }
}

export interface RewardCalculation {
  /** Past orders count (excluding current) */
  pastOrders: number;
  /** This order's sequence number (pastOrders + 1) */
  currentOrderNumber: number;
  /** Whether the reward applies this order */
  applies: boolean;
  /** Discount percentage (0 if not applied) */
  discountPercent: number;
  /** Calculated discount in IDR for a given subtotal */
  discountAmount: (subtotal: number) => number;
  /** Human-readable label for UI */
  label: string;
}

/**
 * Calculate reward for current order based on customer's past orders.
 */
export async function calculateReward(
  email?: string | null,
  phone?: string | null,
  config?: RewardConfig
): Promise<RewardCalculation> {
  const cfg = config ?? (await getRewardConfig());
  const pastOrders = await countCustomerOrders(email, phone);
  const currentOrderNumber = pastOrders + 1;
  const applies = cfg.orderCount > 0 && currentOrderNumber % cfg.orderCount === 0;
  const discountPercent = applies ? cfg.discountPercent : 0;

  return {
    pastOrders,
    currentOrderNumber,
    applies,
    discountPercent,
    discountAmount: (subtotal: number) =>
      Math.round((subtotal * discountPercent) / 100),
    label: applies
      ? `Reward: ${discountPercent}% off (pesanan ke-${currentOrderNumber})`
      : `Pesanan ke-${currentOrderNumber} — reward di pesanan ke-${cfg.orderCount}`,
  };
}
