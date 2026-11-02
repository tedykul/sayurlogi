import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { syncAllFromErpnext } from "@/lib/erpnext-sync";
import { db } from "@/lib/db";

// ============================================================
// Product Sync API — ERPNext → local DB sync.
// ============================================================
// GET  /api/admin/products/sync → sync status (lastSyncAt, source,
//                                 totalProducts, syncedProducts)
// POST /api/admin/products/sync → trigger manual sync (returns
//                                 result summary)
// ============================================================

export const dynamic = "force-dynamic";

// GET — light-weight sync status.
export async function GET() {
  if (!(await verifyAdmin())) {
    return NextResponse.json(
      { success: false, message: "Unauthorized." },
      { status: 401 }
    );
  }

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

// POST — trigger manual sync.
export async function POST() {
  if (!(await verifyAdmin())) {
    return NextResponse.json(
      { success: false, message: "Unauthorized." },
      { status: 401 }
    );
  }

  try {
    const result = await syncAllFromErpnext();
    return NextResponse.json({
      success: result.success,
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
