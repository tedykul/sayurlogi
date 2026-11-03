import { db } from "@/lib/db";
import { fetchProducts, isErpnextConfigured } from "@/lib/erpnext";

// ============================================================
// ERPNext sync — pull products from ERPNext into the local DB.
// ============================================================
// One-way sync (ERPNext → local DB). Creates or updates Product
// rows keyed by itemCode. Existing rows keep their admin-edited
// fields — only ERPNext-sourced fields (name, description,
// category, price, unit, stock, image, emoji) are overwritten.
//
// Image URLs from ERPNext ("/files/..." or "/private/files/...")
// are rewritten to "/api/erp-image/..." proxy paths so the
// storefront can serve them same-origin without CORS issues.
//
// Auto-unpublish: products in DB that no longer exist in ERPNext
// are marked published=false (NOT deleted). Only runs when source
// is genuinely "erpnext" (not mock fallback) to avoid mass-unpublish
// on a transient ERPNext outage.
// ============================================================

export interface SyncResult {
  source: "erpnext" | "mock";
  success: boolean;
  synced: number;
  total: number;
  unpublished: number;
  message: string;
  lastSyncAt: Date | null;
}

/** Rewrite ERPNext image path to the local proxy endpoint. */
function rewriteImage(image: string | null): string | null {
  if (!image) return null;
  // Handle both public (/files/...) and private (/private/files/...) images.
  // ERPNext private files require auth — proxy handles that.
  if (image.startsWith("/private/files/") || image.startsWith("/files/")) {
    return `/api/erp-image${image}`;
  }
  // Absolute URL or already-proxied — keep as-is.
  return image;
}

/**
 * Sync all products from ERPNext into local DB.
 * - If ERPNext not configured → fall back to mock, but still upsert
 *   mock products into DB so admin can edit them.
 * - If ERPNext configured but unreachable → fetchProducts returns
 *   mock data (handled in erpnext.ts).
 * - Auto-unpublish orphans only when source is genuinely ERPNext.
 */
export async function syncAllFromErpnext(): Promise<SyncResult> {
  const configured = isErpnextConfigured();
  const source: "erpnext" | "mock" = configured ? "erpnext" : "mock";

  try {
    const { products, source: fetchedSource } = await fetchProducts();
    let synced = 0;
    const syncedItemCodes: string[] = [];

    // Only stamp erpSyncedAt when the data genuinely came from ERPNext.
    // Mock-fallback (ERPNext configured but unreachable, or not configured
    // at all) does NOT set erpSyncedAt — so /api/products honestly
    // reports source="local" until a real ERPNext sync succeeds.
    const isGenuineErp = fetchedSource === "erpnext";

    for (const p of products) {
      if (!p.itemCode) continue;
      syncedItemCodes.push(p.itemCode);

      const erpData = {
        name: p.name,
        description: p.description || "",
        category: p.category || "Lainnya",
        price: p.price || 0,
        oldPrice: p.oldPrice ?? null,
        unit: p.unit || "pcs",
        stock: p.stock ?? 0,
        emoji: p.emoji || "🛒",
        image: rewriteImage(p.image),
        ...(isGenuineErp ? { erpSyncedAt: new Date() } : {}),
      };

      await db.product.upsert({
        where: { itemCode: p.itemCode },
        create: {
          itemCode: p.itemCode,
          ...erpData,
          // New products default to published=true so the sync
          // result is immediately visible on the storefront.
          published: true,
        },
        update: erpData,
      });
      synced++;
    }

    // Auto-unpublish orphans (only when source is genuinely ERPNext).
    let unpublished = 0;
    if (isGenuineErp && syncedItemCodes.length > 0) {
      const orphans = await db.product.findMany({
        where: {
          erpSyncedAt: { not: null },
          NOT: { itemCode: { in: syncedItemCodes } },
        },
        select: { id: true, itemCode: true, published: true },
      });
      const toUnpublish = orphans.filter((o) => o.published);
      if (toUnpublish.length > 0) {
        await db.product.updateMany({
          where: { id: { in: toUnpublish.map((o) => o.id) } },
          data: { published: false },
        });
        unpublished = toUnpublish.length;
        console.log(
          `[erpnext-sync] Auto-unpublished ${unpublished} orphaned product(s): ${toUnpublish
            .map((o) => o.itemCode)
            .join(", ")}`
        );
      }
    }

    return {
      source: fetchedSource === "erpnext" ? "erpnext" : source,
      success: true,
      synced,
      total: products.length,
      unpublished,
      message:
        synced > 0
          ? `${synced} produk tersinkron dari ${
              fetchedSource === "erpnext" ? "ERPNext" : "mock data"
            }${unpublished > 0 ? ` (${unpublished} di-unpublish)` : ""}`
          : "Tidak ada produk untuk disinkron",
      lastSyncAt: new Date(),
    };
  } catch (err) {
    console.error("[erpnext-sync] syncAllFromErpnext failed:", err);
    return {
      source,
      success: false,
      synced: 0,
      total: 0,
      unpublished: 0,
      message: `Sync gagal: ${err instanceof Error ? err.message : "unknown error"}`,
      lastSyncAt: null,
    };
  }
}

/**
 * Sync a single ERPNext item by itemCode. Useful for on-demand
 * refresh of one product without re-syncing the whole catalog.
 */
export async function syncSingleItem(itemCode: string): Promise<{
  ok: boolean;
  message: string;
}> {
  try {
    const { products } = await fetchProducts();
    const match = products.find((p) => p.itemCode === itemCode);
    if (!match) {
      return { ok: false, message: `Item ${itemCode} tidak ditemukan di ERPNext` };
    }
    await db.product.upsert({
      where: { itemCode: match.itemCode! },
      create: {
        itemCode: match.itemCode!,
        name: match.name,
        description: match.description || "",
        category: match.category || "Lainnya",
        price: match.price || 0,
        unit: match.unit || "pcs",
        stock: match.stock ?? 0,
        emoji: match.emoji || "🛒",
        image: rewriteImage(match.image),
        published: true,
        erpSyncedAt: new Date(),
      },
      update: {
        name: match.name,
        description: match.description || "",
        category: match.category || "Lainnya",
        price: match.price || 0,
        unit: match.unit || "pcs",
        stock: match.stock ?? 0,
        emoji: match.emoji || "🛒",
        image: rewriteImage(match.image),
        erpSyncedAt: new Date(),
      },
    });
    return { ok: true, message: `${itemCode} tersinkron` };
  } catch (err) {
    return {
      ok: false,
      message: `Sync gagal: ${err instanceof Error ? err.message : "unknown error"}`,
    };
  }
}
