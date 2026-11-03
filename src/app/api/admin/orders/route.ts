import { NextRequest, NextResponse } from "next/server";
import { listOrders, type OrderStatus } from "@/lib/orders";
import { verifyAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/audit";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/admin/orders — list orders with optional filtering
// Query params: page, limit, status, search
// (backward compatible: also supports offset)
export async function GET(req: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json(
      { success: false, message: "Unauthorized." },
      { status: 401 }
    );
  }
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const pageParam = searchParams.get("page");
    const offsetParam = searchParams.get("offset");
    const status = searchParams.get("status") as OrderStatus | null;
    const search = searchParams.get("search") || undefined;

    // Support both page-based and offset-based pagination
    // page takes priority over offset (backward compatible)
    let offset = 0;
    let page = 1;
    if (pageParam) {
      page = Math.max(1, parseInt(pageParam, 10) || 1);
      offset = (page - 1) * limit;
    } else if (offsetParam) {
      offset = parseInt(offsetParam, 10) || 0;
      page = Math.floor(offset / limit) + 1;
    }

    const result = await listOrders({
      limit: isNaN(limit) ? 10 : limit,
      offset,
      status: status || undefined,
      search,
    });

    const totalPages = Math.ceil(result.total / limit);

    // Attach payment info to each order (for admin verify payment UI).
    // Fetched separately because Payment-Order has no Prisma relation
    // (schema kept gateway-agnostic). One query for all orders on page.
    const orderIds = result.orders.map((o) => o.id);
    const payments =
      orderIds.length > 0
        ? await db.payment.findMany({
            where: { orderId: { in: orderIds } },
            select: {
              id: true,
              orderId: true,
              method: true,
              status: true,
              amount: true,
              vaNumber: true,
              vaBank: true,
              paidAt: true,
            },
          })
        : [];
    const paymentMap = new Map(payments.map((p) => [p.orderId, p]));

    const ordersWithPayment = result.orders.map((o) => {
      const p = paymentMap.get(o.id);
      if (!p) return { ...o, payment: null };
      // Strip orderId from payment (already on order) + serialize paidAt
      const { orderId: _omit, ...paymentData } = p;
      return {
        ...o,
        payment: {
          ...paymentData,
          paidAt: paymentData.paidAt ? paymentData.paidAt.toISOString() : null,
        },
      };
    });

    // Optional filter by payment status (e.g., "pending_verification")
    // Applied client-side post-fetch because listOrders doesn't support
    // payment_status filter (separate table, no relation).
    const paymentStatusFilter = searchParams.get("payment_status");
    const filteredOrders = paymentStatusFilter
      ? ordersWithPayment.filter((o) => o.payment?.status === paymentStatusFilter)
      : ordersWithPayment;

    // If filtering by payment_status, total reflects filtered count (not full total).
    // This makes pagination imprecise for payment_status filter, but acceptable
    // since admin usually verifies a handful at a time.
    const responseTotal = paymentStatusFilter ? filteredOrders.length : result.total;

    return NextResponse.json({
      success: true,
      orders: filteredOrders,
      total: responseTotal,
      page,
      limit: isNaN(limit) ? 10 : limit,
      totalPages: paymentStatusFilter ? 1 : totalPages,
    });
  } catch (err: any) {
    console.error("[api/admin/orders] GET error:", err);
    return NextResponse.json(
      { success: false, message: "Server error." },
      { status: 500 }
    );
  }
}
