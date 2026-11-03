import { NextRequest, NextResponse } from "next/server";
import { syncAllFromErpnext } from "@/lib/erpnext-sync";
import { db } from "@/lib/db";
import { requirePermission, isAuthResult } from "@/lib/permissions";
import { logAdminAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

// GET /api/admin/products/sync — get sync status
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
    console.error("[api/admin/products/sync] GET error:", err);
    return NextResponse.json(
      { success: false, message: "Server error." },
      { status: 500 }
    );
  }
}

// POST /api/admin/products/sync — trigger ERPNext sync
export async function POST() {
  const auth = await requirePermission("products:sync");
  if (!isAuthResult(auth)) return auth;

  try {
    const result = await syncAllFromErpnext();
    await logAdminAction({
      action: "update",
      target: `products:sync:${result.synced}/${result.total}${result.unpublished > 0 ? ` (unpublish ${result.unpublished})` : ""}`,
      success: true,
      userId: auth.userId,
      userEmail: auth.email,
    });
    return NextResponse.json({
      success: true,
      message: result.message,
      status: {
        lastSyncAt: result.lastSyncAt?.toISOString() || null,
        source: result.source,
        totalProducts: result.total,
        syncedProducts: result.synced,
        unpublishedProducts: result.unpublished,
      },
    });
  } catch (err: any) {
    console.error("[api/admin/products/sync] POST error:", err);
    return NextResponse.json(
      { success: false, message: "Server error." },
      { status: 500 }
    );
  }
}
