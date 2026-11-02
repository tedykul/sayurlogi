import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isErpnextConfigured } from "@/lib/erpnext";

export const dynamic = "force-dynamic";

// ============================================================
// GET /api/products — storefront catalog (read from local DB,
// which is synced from ERPNext via /api/admin/products/sync).
// ============================================================
// Optional: ?category=Sayuran
// Returns: { products, source, configured }
//   - configured: whether ERPNext connection is set up (URL+key+secret).
//   - source: "erpnext" only when configured AND any product has
//     erpSyncedAt set. Otherwise "local" (seed/demo products).
//     This avoids falsely showing "Live ERPNext" when the sync
//     ran in mock-fallback mode (ERPNext not configured).
// Only published products are returned (sync auto-unpublishes
// orphans when an Item is removed from ERPNext).
// ============================================================

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");

    const where = {
      published: true,
      ...(category ? { category } : {}),
    };

    const [products, syncedCount] = await Promise.all([
      db.product.findMany({
        where,
        orderBy: { createdAt: "asc" },
      }),
      db.product.count({ where: { erpSyncedAt: { not: null } } }),
    ]);

    const configured = isErpnextConfigured();
    // Honest source: "erpnext" only when truly configured + synced.
    const source = configured && syncedCount > 0 ? "erpnext" : "local";

    return NextResponse.json({ success: true, products, source, configured });
  } catch (err) {
    console.error("[api/products] GET error:", err);
    return NextResponse.json(
      { success: false, message: "Server error." },
      { status: 500 }
    );
  }
}

