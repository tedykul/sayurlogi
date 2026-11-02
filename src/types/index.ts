// ============================================================
// Shared types — storefront + coupon + admin.
// ============================================================

export interface Product {
  id: string;
  // ERPNext item_code (null for seed/demo products).
  itemCode: string | null;
  name: string;
  description: string;
  price: number; // IDR
  oldPrice: number | null; // original price (crossed-out display)
  category: string;
  unit: string; // ERPNext stock_uom (e.g. "pcs", "kg")
  image: string | null;
  emoji: string | null; // fallback display when no image
  stock: number;
  published: boolean;
  erpSyncedAt: string | null; // ISO; null = local-only (not from ERPNext)
  createdAt: string;
  updatedAt: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export type CouponType = "percent" | "fixed" | "free_shipping";

export interface Coupon {
  id: string;
  code: string;
  type: CouponType;
  value: number;
  minOrder: number;
  maxUsage: number;
  maxPerUser: number;
  usedCount: number;
  startsAt: string | null;
  expiresAt: string | null;
  active: boolean;
  scopeType: string;
  scopeValue: string | null;
  note: string | null;
  description: string | null;
  batchId: string | null;
  clickCount: number;
  shareCount: number;
  printedCount: number;
  printedAt: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { usages: number };
}

export interface AppliedCoupon {
  code: string;
  type: CouponType;
  value: number;
  discount: number; // calculated IDR amount off
  freeShipping: boolean;
  minOrder: number;
}

export interface Order {
  id: string;
  itemsJson: string;
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string;
  customerAddress: string;
  couponCode: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}
