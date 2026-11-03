import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, isAuthResult } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// GET /api/admin/products/sync/status — light-weight sync status (no auth-write)
export async function GET() {
  const auth = await requirePermission("products:read");
  if (!isAuthResult(auth)) return auth;

  try {
    const [totalProducts, syncedProducts] = await Promise.all([
      db.product.count(),
      db.product.count({ where: { erpSyncedAt: { not: null } } }),
    ]);
    const latestSynced = await db.product.findFirst({
      where: { erpSyncedAt: { not: null } },
      orderBy: { erpSyncedAt: "desc" },
      select: { erpSyncedAt: true },
    });
    const lastSyncAt = latestSynced?.erpSyncedAt?.toISOString() || null;
    const source = syncedProducts > 0 ? "erpnext" : "mock";
    return NextResponse.json({
      success: true,
      status: {
        lastSyncAt,
        source,
        totalProducts,
        syncedProducts,
      },
    });
  } catch (err: any) {
    console.error("[api/admin/products/sync/status] GET error:", err);
    return NextResponse.json(
      { success: false, message: "Server error." },
      { status: 500 }
    );
  }
}
