import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyAdmin } from "@/lib/admin-auth";
import type { OrderStatus } from "@/lib/orders";

// ============================================================
// Dashboard Stats API — aggregated metrics for admin dashboard.
// ============================================================
// Returns:
//   - KPI summary (totalRevenue, totalOrders, totalCustomers, avgOrderValue)
//   - Revenue + order count for last 7 days (trend chart)
//   - Orders grouped by status (donut chart)
//   - Top 5 products by qty sold (horizontal bar chart)
//   - Revenue by category (pie chart)
//   - Orders by payment method (donut chart)
//   - Recent orders (last 5)
//   - Low stock products (stock < 10)
//
// All amounts in IDR (Int). Dates in ISO string.
// ============================================================

export const dynamic = "force-dynamic";

interface CartItem {
  itemCode?: string;
  name?: string;
  emoji?: string;
  category?: string;
  price?: number;
  quantity?: number;
}

interface DailyRevenue {
  date: string;
  label: string;
  revenue: number;
  orderCount: number;
}

interface TopProduct {
  itemCode: string;
  name: string;
  emoji: string;
  category: string;
  qty: number;
  revenue: number;
}

interface CategoryRevenue {
  category: string;
  revenue: number;
  orderCount: number;
}

interface RecentOrder {
  id: string;
  trackingId: string;
  customerName: string;
  total: number;
  status: string;
  createdAt: string;
}

interface LowStockProduct {
  id: string;
  itemCode: string;
  name: string;
  emoji: string;
  category: string;
  stock: number;
  price: number;
}

interface DashboardStats {
  // KPI
  totalRevenue: number;
  totalOrders: number;
  totalCustomers: number;
  avgOrderValue: number;
  pendingOrders: number;
  // Charts
  revenueLast7Days: DailyRevenue[];
  ordersByStatus: { status: string; label: string; count: number; color: string }[];
  topProducts: TopProduct[];
  revenueByCategory: CategoryRevenue[];
  ordersByPaymentMethod: { method: string; count: number; revenue: number }[];
  // Lists
  recentOrders: RecentOrder[];
  lowStockProducts: LowStockProduct[];
  // Phase 2: Product dashboard
  stockByCategory: { category: string; stock: number; productCount: number; value: number }[];
  totalStockUnits: number;
  totalStockValue: number;
  erpSyncStatus: {
    totalProducts: number;
    syncedProducts: number;
    lastSyncAt: string | null;
    isConfigured: boolean;
  };
  // Phase 3: Order dashboard
  revenueVsTarget: (DailyRevenue & { target: number; achievement: number })[];
  customerGrowth7Days: { date: string; label: string; newCustomers: number; cumulative: number }[];
  ordersByDeliveryMethod: { method: string; label: string; count: number; revenue: number }[];
  dailyTarget: number;
}

// Status colors + labels (mirror of ORDER_STATUS_COLORS in lib/orders.ts)
const STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: "Menunggu", color: "#f59e0b" },
  confirmed: { label: "Dikonfirmasi", color: "#3b82f6" },
  preparing: { label: "Disiapkan", color: "#8b5cf6" },
  out_for_delivery: { label: "Dikirim", color: "#06b6d4" },
  delivered: { label: "Selesai", color: "#10b981" },
  cancelled: { label: "Dibatalkan", color: "#f43f5e" },
};

const PAYMENT_LABELS: Record<string, string> = {
  cod: "COD",
  transfer: "Transfer Bank",
  ewallet: "E-Wallet",
};

function formatDateLabel(date: Date): string {
  const days = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
  return `${days[date.getDay()]}, ${date.getDate()}/${date.getMonth() + 1}`;
}

function formatDateKey(date: Date): string {
  return date.toISOString().split("T")[0];
}

export async function GET() {
  if (!(await verifyAdmin())) {
    return NextResponse.json(
      { success: false, message: "Unauthorized." },
      { status: 401 }
    );
  }

  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 6); // include today
    sevenDaysAgo.setHours(0, 0, 0, 0);

    // === Fetch all orders (last 30 days for top products + category aggregation) ===
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 29);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const recentOrdersRaw = await db.order.findMany({
      where: {
        createdAt: { gte: thirtyDaysAgo },
        status: { not: "cancelled" },
      },
      orderBy: { createdAt: "desc" },
      take: 500, // cap for performance
      select: {
        id: true,
        trackingId: true,
        customerName: true,
        customerEmail: true,
        customerPhone: true,
        itemsJson: true,
        total: true,
        status: true,
        paymentMethod: true,
        createdAt: true,
      },
    });

    // === KPI: Total revenue + orders + customers (last 30 days) ===
    const totalRevenue = recentOrdersRaw.reduce((sum, o) => sum + o.total, 0);
    const totalOrders = recentOrdersRaw.length;
    const customerSet = new Set<string>();
    recentOrdersRaw.forEach((o) => {
      const key = o.customerEmail || o.customerPhone;
      if (key) customerSet.add(key);
    });
    const totalCustomers = customerSet.size;
    const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

    // === Pending orders (all time, status pending/confirmed/preparing) ===
    const pendingOrders = await db.order.count({
      where: { status: { in: ["pending", "confirmed", "preparing"] } },
    });

    // === Revenue last 7 days (trend chart) ===
    const dailyMap: Record<string, DailyRevenue> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const key = formatDateKey(d);
      dailyMap[key] = {
        date: key,
        label: formatDateLabel(d),
        revenue: 0,
        orderCount: 0,
      };
    }
    recentOrdersRaw.forEach((o) => {
      const key = formatDateKey(new Date(o.createdAt));
      if (dailyMap[key]) {
        dailyMap[key].revenue += o.total;
        dailyMap[key].orderCount += 1;
      }
    });
    const revenueLast7Days = Object.values(dailyMap).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    // === Orders by status (all time) ===
    const statusGroups = await db.order.groupBy({
      by: ["status"],
      _count: { status: true },
    });
    const ordersByStatus = (Object.keys(STATUS_META) as OrderStatus[]).map((status) => {
      const found = statusGroups.find((g) => g.status === status);
      const meta = STATUS_META[status] || { label: status, color: "#94a3b8" };
      return {
        status,
        label: meta.label,
        count: found?._count.status || 0,
        color: meta.color,
      };
    });

    // === Top products + category aggregation (parse itemsJson) ===
    const productMap: Record<string, TopProduct> = {};
    const categoryMap: Record<string, { revenue: number; orderCount: number }> = {};

    recentOrdersRaw.forEach((o) => {
      try {
        const items: CartItem[] = JSON.parse(o.itemsJson || "[]");
        items.forEach((item) => {
          const code = item.itemCode || item.name || "unknown";
          const qty = item.quantity || 0;
          const price = item.price || 0;
          const revenue = qty * price;
          const category = item.category || "Lainnya";

          // Aggregate product
          if (!productMap[code]) {
            productMap[code] = {
              itemCode: code,
              name: item.name || code,
              emoji: item.emoji || "🛒",
              category,
              qty: 0,
              revenue: 0,
            };
          }
          productMap[code].qty += qty;
          productMap[code].revenue += revenue;

          // Aggregate category
          if (!categoryMap[category]) {
            categoryMap[category] = { revenue: 0, orderCount: 0 };
          }
          categoryMap[category].revenue += revenue;
          categoryMap[category].orderCount += 1;
        });
      } catch {
        // ignore JSON parse errors
      }
    });

    const topProducts = Object.values(productMap)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    const revenueByCategory = Object.entries(categoryMap)
      .map(([category, data]) => ({ category, ...data }))
      .sort((a, b) => b.revenue - a.revenue);

    // === Orders by payment method ===
    const paymentGroups: Record<string, { count: number; revenue: number }> = {};
    recentOrdersRaw.forEach((o) => {
      const method = o.paymentMethod || "unknown";
      if (!paymentGroups[method]) {
        paymentGroups[method] = { count: 0, revenue: 0 };
      }
      paymentGroups[method].count += 1;
      paymentGroups[method].revenue += o.total;
    });
    const ordersByPaymentMethod = Object.entries(paymentGroups).map(([method, data]) => ({
      method,
      label: PAYMENT_LABELS[method] || method,
      count: data.count,
      revenue: data.revenue,
    }));

    // === Recent orders (last 5) ===
    const recentOrders: RecentOrder[] = recentOrdersRaw.slice(0, 5).map((o) => ({
      id: o.id,
      trackingId: o.trackingId,
      customerName: o.customerName,
      total: o.total,
      status: o.status,
      createdAt: o.createdAt.toISOString(),
    }));

    // === Low stock products (stock < 10) ===
    const lowStockRaw = await db.product.findMany({
      where: {
        published: true,
        stock: { lt: 10 },
      },
      orderBy: { stock: "asc" },
      take: 5,
      select: {
        id: true,
        itemCode: true,
        name: true,
        emoji: true,
        category: true,
        stock: true,
        price: true,
      },
    });
    const lowStockProducts: LowStockProduct[] = lowStockRaw.map((p) => ({
      ...p,
      emoji: p.emoji || "🛒",
    }));

    // === Phase 2: Product dashboard stats ===
    // Stock per category (for stacked bar chart)
    const allProductsForStock = await db.product.findMany({
      where: { published: true },
      select: { category: true, stock: true, price: true },
    });
    const stockByCategoryMap: Record<string, { stock: number; productCount: number; value: number }> = {};
    let totalStockUnits = 0;
    let totalStockValue = 0;
    allProductsForStock.forEach((p) => {
      const cat = p.category || "Lainnya";
      if (!stockByCategoryMap[cat]) {
        stockByCategoryMap[cat] = { stock: 0, productCount: 0, value: 0 };
      }
      stockByCategoryMap[cat].stock += p.stock;
      stockByCategoryMap[cat].productCount += 1;
      stockByCategoryMap[cat].value += p.stock * p.price;
      totalStockUnits += p.stock;
      totalStockValue += p.stock * p.price;
    });
    const stockByCategory = Object.entries(stockByCategoryMap)
      .map(([category, data]) => ({ category, ...data }))
      .sort((a, b) => b.stock - a.stock);

    // ERPNext sync status
    const totalProducts = await db.product.count();
    const syncedProducts = await db.product.count({ where: { erpSyncedAt: { not: null } } });
    const latestSynced = await db.product.findFirst({
      where: { erpSyncedAt: { not: null } },
      orderBy: { erpSyncedAt: "desc" },
      select: { erpSyncedAt: true },
    });
    const erpSyncStatus = {
      totalProducts,
      syncedProducts,
      lastSyncAt: latestSynced?.erpSyncedAt?.toISOString() || null,
      isConfigured: Boolean(
        process.env.ERPNEXT_URL && process.env.ERPNEXT_API_KEY && process.env.ERPNEXT_API_SECRET
      ),
    };

    // === Phase 3: Order dashboard ===
    // Customer growth (new customers per day, last 7 days)
    // A "new customer" = first order by that email/phone on that day.
    const customerFirstOrderMap: Record<string, { date: string; customer: string }> = {};
    recentOrdersRaw.forEach((o) => {
      const key = o.customerEmail || o.customerPhone;
      if (!key) return;
      const orderDate = formatDateKey(new Date(o.createdAt));
      if (!customerFirstOrderMap[key] || customerFirstOrderMap[key].date > orderDate) {
        customerFirstOrderMap[key] = { date: orderDate, customer: key };
      }
    });
    const customerGrowthMap: Record<string, number> = {};
    Object.values(customerFirstOrderMap).forEach((entry) => {
      // Only count if within last 7 days
      if (dailyMap[entry.date]) {
        customerGrowthMap[entry.date] = (customerGrowthMap[entry.date] || 0) + 1;
      }
    });
    const customerGrowth7Days = Object.keys(dailyMap)
      .sort()
      .map((date) => ({
        date,
        label: dailyMap[date].label,
        newCustomers: customerGrowthMap[date] || 0,
        cumulative: 0, // will be calculated below
      }));
    // Calculate cumulative
    let cumulative = 0;
    customerGrowth7Days.forEach((d) => {
      cumulative += d.newCustomers;
      d.cumulative = cumulative;
    });

    // Revenue vs target (daily target = total last 30 days / 30)
    const dailyTarget = totalRevenue > 0 ? Math.round(totalRevenue / 30) : 50000;
    const revenueVsTarget = revenueLast7Days.map((d) => ({
      ...d,
      target: dailyTarget,
      achievement: dailyTarget > 0 ? Math.round((d.revenue / dailyTarget) * 100) : 0,
    }));

    // Delivery method distribution (based on deliveryMethod field if available,
    // fallback: infer from customerAddress presence)
    const deliveryGroups: Record<string, { count: number; revenue: number }> = {};
    recentOrdersRaw.forEach((o) => {
      const key = o.customerAddress ? "delivery" : "pickup";
      if (!deliveryGroups[key]) {
        deliveryGroups[key] = { count: 0, revenue: 0 };
      }
      deliveryGroups[key].count += 1;
      deliveryGroups[key].revenue += o.total;
    });
    const ordersByDeliveryMethod = Object.entries(deliveryGroups).map(([method, data]) => ({
      method,
      label: method === "delivery" ? "Antar" : "Pickup",
      count: data.count,
      revenue: data.revenue,
    }));

    const stats: DashboardStats = {
      totalRevenue,
      totalOrders,
      totalCustomers,
      avgOrderValue,
      pendingOrders,
      revenueLast7Days,
      ordersByStatus,
      topProducts,
      revenueByCategory,
      ordersByPaymentMethod,
      recentOrders,
      lowStockProducts,
      // Phase 2
      stockByCategory,
      totalStockUnits,
      totalStockValue,
      erpSyncStatus,
      // Phase 3
      revenueVsTarget,
      customerGrowth7Days,
      ordersByDeliveryMethod,
      dailyTarget,
    };

    return NextResponse.json({ success: true, stats });
  } catch (err: any) {
    console.error("[api/admin/dashboard] GET error:", err);
    return NextResponse.json(
      { success: false, message: "Server error." },
      { status: 500 }
    );
  }
}
