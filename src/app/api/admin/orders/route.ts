import { NextRequest, NextResponse } from "next/server";
import { listOrders, type OrderStatus } from "@/lib/orders";
import { verifyAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/audit";

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

    return NextResponse.json({
      success: true,
      orders: result.orders,
      total: result.total,
      page,
      limit: isNaN(limit) ? 10 : limit,
      totalPages,
    });
  } catch (err: any) {
    console.error("[api/admin/orders] GET error:", err);
    return NextResponse.json(
      { success: false, message: "Server error." },
      { status: 500 }
    );
  }
}
