import { db } from "@/lib/db";
import type { CartItem } from "@/types/grocery";

// ============================================================
// Order helpers — create, track, update status.
// ============================================================
// trackingId: 6-char uppercase alphanumeric (e.g., "SB3X9K")
//   Easy to share via WhatsApp, type manually, remember.
//   Collision-safe: 36^6 = 2.2 billion combinations.
// ============================================================

const TRACKING_ID_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I, O, 0, 1 (confusing)
const TRACKING_ID_LENGTH = 6;
const TRACKING_PREFIX = "SB"; // SayurBox

/** Generate a unique tracking ID (e.g., "SB3X9K"). Checks DB for collision. */
export async function generateTrackingId(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    let id = TRACKING_PREFIX;
    for (let i = 0; i < TRACKING_ID_LENGTH - TRACKING_PREFIX.length; i++) {
      id += TRACKING_ID_CHARS[Math.floor(Math.random() * TRACKING_ID_CHARS.length)];
    }
    // Check collision
    const existing = await db.order.findUnique({
      where: { trackingId: id },
      select: { id: true },
    });
    if (!existing) return id;
  }
  // Fallback: use timestamp suffix (extremely unlikely to reach here)
  return TRACKING_PREFIX + Date.now().toString(36).toUpperCase().slice(-4);
}

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export const ORDER_STATUS_FLOW: OrderStatus[] = [
  "pending",
  "confirmed",
  "preparing",
  "out_for_delivery",
  "delivered",
];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Menunggu Konfirmasi",
  confirmed: "Dikonfirmasi",
  preparing: "Disiapkan",
  out_for_delivery: "Dalam Pengiriman",
  delivered: "Selesai",
  cancelled: "Dibatalkan",
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  pending: "bg-amber-500/20 text-amber-700 dark:text-amber-400",
  confirmed: "bg-blue-500/20 text-blue-700 dark:text-blue-400",
  preparing: "bg-violet-500/20 text-violet-700 dark:text-violet-400",
  out_for_delivery: "bg-cyan-500/20 text-cyan-700 dark:text-cyan-400",
  delivered: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400",
  cancelled: "bg-rose-500/20 text-rose-700 dark:text-rose-400",
};

export const ORDER_STATUS_ICONS: Record<OrderStatus, string> = {
  pending: "⏳",
  confirmed: "✓",
  preparing: "🥬",
  out_for_delivery: "🚚",
  delivered: "📦",
  cancelled: "✗",
};

interface CreateOrderInput {
  customerName: string;
  customerEmail?: string;
  customerPhone: string;
  customerAddress: string;
  customerCity?: string;
  customerNotes?: string;
  items: CartItem[];
  subtotal: number;
  shipping: number;
  total: number;
  /// Discount applied (IDR). Defaults to 0. Stored on Order row.
  discount?: number;
  /// Coupon code applied (snapshot). Stored on Order row for display.
  couponCode?: string;
  /// Customer account link (null for guest checkout). When set,
  /// the order shows up in the customer's order history.
  customerId?: string | null;
  /// Delivery slot ID (when scheduling enabled). Null = no slot.
  deliverySlotId?: string | null;
  /// Delivery slot label snapshot (e.g. "Sen, 3 Nov 09:00-12:00").
  deliverySlotLabel?: string | null;
  deliveryMethod: "delivery" | "pickup";
  paymentMethod: "cod" | "transfer" | "ewallet";
  erpSalesOrderName?: string;
  estimatedDelivery?: string;
}

export interface OrderWithItems {
  id: string;
  trackingId: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string;
  customerAddress: string;
  customerCity: string | null;
  customerNotes: string | null;
  items: CartItem[];
  subtotal: number;
  shipping: number;
  total: number;
  /// Discount applied (IDR). 0 if none.
  discount: number;
  /// Coupon code applied (snapshot). null if none.
  couponCode: string | null;
  /// Customer account link (null for guest checkout).
  customerId: string | null;
  /// Delivery slot ID (null if no slot selected).
  deliverySlotId: string | null;
  /// Delivery slot label snapshot.
  deliverySlotLabel: string | null;
  deliveryMethod: string;
  paymentMethod: string;
  status: OrderStatus;
  erpSalesOrderName: string | null;
  estimatedDelivery: string | null;
  statusHistory: { status: OrderStatus; timestamp: string }[];
  createdAt: string;
  updatedAt: string;
}

/** Create a new order record. Returns the order with trackingId. */
export async function createOrder(input: CreateOrderInput): Promise<OrderWithItems> {
  const trackingId = await generateTrackingId();
  const now = new Date().toISOString();
  const statusHistory = [{ status: "pending" as OrderStatus, timestamp: now }];

  const order = await db.order.create({
    data: {
      trackingId,
      customerName: input.customerName,
      customerEmail: input.customerEmail || null,
      customerPhone: input.customerPhone,
      customerAddress: input.customerAddress,
      customerCity: input.customerCity || null,
      customerNotes: input.customerNotes || null,
      itemsJson: JSON.stringify(input.items),
      subtotal: input.subtotal,
      shipping: input.shipping,
      total: input.total,
      deliveryMethod: input.deliveryMethod,
      paymentMethod: input.paymentMethod,
      discount: input.discount ?? 0,
      couponCode: input.couponCode ?? null,
      customerId: input.customerId ?? null,
      deliverySlotId: input.deliverySlotId ?? null,
      deliverySlotLabel: input.deliverySlotLabel ?? null,
      status: "pending",
      erpSalesOrderName: input.erpSalesOrderName || null,
      estimatedDelivery: input.estimatedDelivery || null,
      statusHistoryJson: JSON.stringify(statusHistory),
    },
  });

  return serializeOrder(order);
}

/** Get order by tracking ID. Returns null if not found. */
export async function getOrderByTrackingId(trackingId: string): Promise<OrderWithItems | null> {
  const order = await db.order.findUnique({
    where: { trackingId: trackingId.toUpperCase().trim() },
  });
  if (!order) return null;
  return serializeOrder(order);
}

/** Get order by internal ID (for admin). */
export async function getOrderById(id: string): Promise<OrderWithItems | null> {
  const order = await db.order.findUnique({ where: { id } });
  if (!order) return null;
  return serializeOrder(order);
}

/** List orders with optional filtering. For admin dashboard. */
export async function listOrders(options: {
  limit?: number;
  offset?: number;
  status?: OrderStatus;
  search?: string;
} = {}): Promise<{ orders: OrderWithItems[]; total: number }> {
  const { limit = 50, offset = 0, status, search } = options;

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { trackingId: { contains: search.toUpperCase() } },
      { customerName: { contains: search } },
      { customerPhone: { contains: search } },
      { customerEmail: { contains: search } },
    ];
  }

  const [orders, total] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 100),
      skip: offset,
    }),
    db.order.count({ where }),
  ]);

  return {
    orders: orders.map(serializeOrder),
    total,
  };
}

/** Update order status + append to history. */
export async function updateOrderStatus(
  id: string,
  newStatus: OrderStatus
): Promise<OrderWithItems> {
  const existing = await db.order.findUnique({ where: { id } });
  if (!existing) throw new Error("Order tidak ditemukan");

  const history: { status: OrderStatus; timestamp: string }[] = existing.statusHistoryJson
    ? JSON.parse(existing.statusHistoryJson)
    : [];
  history.push({ status: newStatus, timestamp: new Date().toISOString() });

  const updated = await db.order.update({
    where: { id },
    data: {
      status: newStatus,
      statusHistoryJson: JSON.stringify(history),
    },
  });

  return serializeOrder(updated);
}

/** Convert Prisma Order row to OrderWithItems (parse JSON fields). */
function serializeOrder(order: any): OrderWithItems {
  return {
    id: order.id,
    trackingId: order.trackingId,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone,
    customerAddress: order.customerAddress,
    customerCity: order.customerCity,
    customerNotes: order.customerNotes,
    items: JSON.parse(order.itemsJson) as CartItem[],
    subtotal: order.subtotal,
    shipping: order.shipping,
    total: order.total,
    discount: order.discount ?? 0,
    couponCode: order.couponCode ?? null,
    customerId: order.customerId ?? null,
    deliverySlotId: order.deliverySlotId ?? null,
    deliverySlotLabel: order.deliverySlotLabel ?? null,
    deliveryMethod: order.deliveryMethod,
    paymentMethod: order.paymentMethod,
    status: order.status as OrderStatus,
    erpSalesOrderName: order.erpSalesOrderName,
    estimatedDelivery: order.estimatedDelivery,
    statusHistory: order.statusHistoryJson
      ? JSON.parse(order.statusHistoryJson)
      : [],
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}
