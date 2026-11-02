// ============================================================
// Shared types — storefront + coupon + admin.
// ============================================================

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number; // IDR
  category: string;
  image: string | null;
  stock: number;
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
