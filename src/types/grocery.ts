// ============================================================
// Grocery Store Types — compatible with ERPNext Item DocType
// ============================================================

export interface Product {
  /** ERPNext Item name (primary key) e.g. "TOMAT-001" */
  id: string;
  /** Item code in ERPNext */
  itemCode: string;
  /** Display name */
  name: string;
  /** Short description */
  description: string;
  /** Item Group name in ERPNext: "Sayuran" | "Buah" | "Paket" | ... */
  category: string;
  /** Price in IDR (Item Price / rate) */
  price: number;
  /** Old price for discount display (optional) */
  oldPrice?: number;
  /** Unit of measure: "kg", "ikat", "pcs", "bungkus" */
  unit: string;
  /** Stock quantity (actual qty in ERPNext bin) */
  stock: number;
  /** Emoji/icon for fast rendering (replaces image in mock mode) */
  emoji: string;
  /** Product image URL (from ERPNext Item image field) */
  image?: string;
  /** Whether item is organic */
  organic?: boolean;
  /** Whether item is on sale */
  onSale?: boolean;
  /** Tags for filtering: "lokal", "impor", "segar", etc. */
  tags?: string[];
  /** Average customer rating (0-5). Optional — defaults to derived value. */
  rating?: number;
  /** Number of customer reviews. Optional. */
  reviewCount?: number;
  /** Long-form description shown in product detail modal. Optional. */
  longDescription?: string;
  /** Key nutrition facts or benefits, shown as bullet list in detail modal. Optional. */
  benefits?: string[];
  /** Storage tip shown in detail modal. Optional. */
  storageTip?: string;
  /** Origin region/city. Optional. */
  origin?: string;
  /** Product variants (e.g. 250gr, 500gr, 1kg). Optional. */
  variants?: ProductVariant[];
}

export interface ProductVariant {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  oldPrice?: number | null;
  stock: number;
  unit: string;
}

export interface Category {
  /** Item Group name */
  id: string;
  name: string;
  /** Emoji icon */
  emoji: string;
  /** Gradient classes for the category card */
  gradient: string;
  /** Description */
  description: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface CheckoutPayload {
  customer: {
    name: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    notes?: string;
  };
  items: CartItem[];
  deliveryMethod: "delivery" | "pickup" | "gojek";
  paymentMethod: "cod" | "transfer" | "ewallet";
  total: number;
  /// Optional coupon code applied at checkout. Validated server-side.
  couponCode?: string;
  /// Optional delivery slot ID (when scheduling enabled). Validated server-side.
  deliverySlotId?: string;
  /// Optional delivery zone ID (for internal delivery shipping calc).
  deliveryZoneId?: string;
}

export interface CheckoutResponse {
  success: boolean;
  /** ERPNext Sales Order name if successful */
  salesOrderName?: string;
  /** Customer-facing tracking ID (e.g., "SB3X9K") */
  trackingId?: string;
  /** Internal order ID (for payment API) */
  orderId?: string;
  /** Payment ID (for confirm API) */
  paymentId?: string;
  /** Payment details (VA number, payment URL, etc.) */
  payment?: {
    method: string;
    status: string;
    amount: number;
    vaNumber?: string;
    vaBank?: string;
    paymentUrl?: string;
    ewalletProvider?: string;
    message: string;
  };
  message: string;
  /** Mock mode indicator */
  mock?: boolean;
  /** Estimated delivery info */
  estimatedDelivery?: {
    dateLabel: string;
    timeWindow: string;
    sameDay: boolean;
  };
}
