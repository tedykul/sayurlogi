import { db } from "@/lib/db";
import { fetchProducts, isErpnextConfigured } from "@/lib/erpnext";

// ============================================================
// ERPNext sync — pull products from ERPNext into the local DB.
// ============================================================
// This is a one-way sync (ERPNext → local DB). It creates or
// updates Product rows keyed by itemCode. Existing rows keep
// their admin-edited fields (organic, onSale, tags, benefits,
// storageTip, origin, published, order) — only ERPNext-sourced
// fields (name, description, category, price, unit, stock, image)
// are overwritten.
//
// downloadImage: optional helper used by the upload route when
// importing product photos from ERPNext URLs.
// ============================================================

export interface SyncResult {
  source: "erpnext" | "mock" | "unknown";
  synced: number;
  total: number;
  unpublished: number;
  restoredFromErp: number;
  message: string;
  lastSyncAt: Date | null;
}

/**
 * Sync all products from ERPNext into local DB.
 * - If ERPNext not configured → fall back to mock, but still upsert
 *   mock products into DB so admin can edit them.
 * - If ERPNext configured but unreachable → fetchProducts returns
 *   mock data (handled in erpnext.ts).
 * - Auto-mark-deleted: products in DB that no longer exist in ERPNext
 *   are flagged `deletedFromErp=true` (NOT hard deleted — admin can
 *   still see in Trash view + restore if item returns to ERPNext).
 *   Frontend + admin should filter `deletedFromErp: false` to hide
 *   these from all listings. Only runs when source is genuinely
 *   "erpnext" (not mock fallback), to avoid mass-delete on transient
 *   ERPNext outage.
 * - Auto-restore: products that were previously `deletedFromErp=true`
 *   but reappear in ERPNext (e.g. admin re-enabled disabled item)
 *   are reset to `deletedFromErp=false`. Also sets published=true
 *   so they become visible again on storefront.
 */
export async function syncAllFromErpnext(): Promise<SyncResult> {
  const configured = isErpnextConfigured();
  const source: "erpnext" | "mock" | "unknown" = configured
    ? "erpnext"
    : "mock";

  try {
    const { products, source: fetchedSource } = await fetchProducts();
    let synced = 0;
    let restoredFromErp = 0;
    const syncedItemCodes: string[] = [];
    for (const p of products) {
      if (!p.itemCode) continue;
      syncedItemCodes.push(p.itemCode);
      // Rewrite ERPNext file paths to proxy endpoint.
      // ERPNext stores uploaded files at "/files/xxx.png" (internal URL
      // not accessible from browser). We proxy via /api/erp-image/ so
      // the storefront can serve them same-origin without CORS issues.
      const rewrittenImage = (() => {
        if (!p.image) return null;
        // Handle both public (/files/...) and private (/private/files/...) images.
        // ERPNext stores private files at /private/files/ which require auth.
        if (p.image.startsWith("/private/files/")) {
          return `/api/erp-image${p.image}`;
        }
        if (p.image.startsWith("/files/")) {
          return `/api/erp-image${p.image}`;
        }
        return p.image;
      })();
      // ERPNext-sourced fields to upsert.
      const erpData = {
        name: p.name,
        description: p.description || "",
        category: p.category || "Lainnya",
        price: p.price || 0,
        oldPrice: p.oldPrice ?? null,
        unit: p.unit || "pcs",
        stock: p.stock ?? 0,
        emoji: p.emoji || "🛒",
        image: rewrittenImage,
        erpSyncedAt: new Date(),
        // Reset deletedFromErp flag in case item was previously marked
        // deleted but now reappears in ERPNext (e.g. admin re-enabled
        // disabled item). Also re-publish so it's visible on storefront.
        deletedFromErp: false,
      };
      // Before upsert, check if product was previously flagged as
      // deletedFromErp. If so, log it as "restored" so admin gets
      // feedback that an item came back.
      const existing = await db.product.findUnique({
        where: { itemCode: p.itemCode },
        select: { deletedFromErp: true },
      });
      if (existing?.deletedFromErp) {
        restoredFromErp++;
        console.log(
          `[erpnext-sync] Item ${p.itemCode} restored (was deletedFromErp, now back in ERPNext)`
        );
      }
      await db.product.upsert({
        where: { itemCode: p.itemCode },
        create: {
          itemCode: p.itemCode,
          ...erpData,
          // New products default to published=true so the sync result
          // is immediately visible on the storefront.
          published: true,
        },
        update: erpData,
      });
      synced++;
    }

    // Auto-mark-deleted: products in DB that no longer exist in ERPNext.
    // Only run when source is genuinely ERPNext (not mock fallback),
    // to avoid mass-delete on transient ERPNext outage.
    let unpublished = 0;
    if (fetchedSource === "erpnext" && syncedItemCodes.length > 0) {
      // Find DB products with erpSyncedAt (sourced from ERPNext before)
      // whose itemCode is NOT in the current ERPNext list.
      const orphans = await db.product.findMany({
        where: {
          erpSyncedAt: { not: null },
          NOT: { itemCode: { in: syncedItemCodes } },
        },
        select: { id: true, itemCode: true, published: true, deletedFromErp: true },
      });
      // Mark as deletedFromErp. Also set published=false so they
      // disappear from storefront immediately. Admin can see them
      // in Trash view (deletedFromErp=true filter).
      const toMarkDeleted = orphans.filter((o) => !o.deletedFromErp);
      if (toMarkDeleted.length > 0) {
        await db.product.updateMany({
          where: { id: { in: toMarkDeleted.map((o) => o.id) } },
          data: {
            published: false,
            deletedFromErp: true,
          },
        });
        unpublished = toMarkDeleted.length;
        console.log(
          `[erpnext-sync] Marked ${unpublished} product(s) as deletedFromErp (no longer in ERPNext): ${toMarkDeleted
            .map((o) => o.itemCode)
            .join(", ")}`
        );
      }
    }

    return {
      success: true,
      source: fetchedSource === "erpnext" ? "erpnext" : source,
      synced,
      total: products.length,
      unpublished,
      restoredFromErp,
      message:
        synced > 0
          ? `${synced} produk tersinkron dari ${
              fetchedSource === "erpnext" ? "ERPNext" : "mock data"
            }${unpublished > 0 ? ` (${unpublished} ditandai hapus dari ERPNext)` : ""}${
              restoredFromErp > 0 ? ` (${restoredFromErp} dipulihkan)` : ""
            }`
          : "Tidak ada produk untuk disinkron",
      lastSyncAt: new Date(),
    };
  } catch (err) {
    console.error("[erpnext-sync] syncAllFromErpnext failed:", err);
    return {
      success: false,
      source,
      synced: 0,
      total: 0,
      unpublished: 0,
      restoredFromErp: 0,
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
    // Rewrite ERPNext file paths to proxy endpoint (same as syncAllFromErpnext).
    const rewrittenImage = (() => {
      if (!match.image) return null;
      if (match.image.startsWith("/files/")) {
        return `/api/erp-image${match.image.replace(/^\/files\//, "/")}`;
      }
      return match.image;
    })();
    await db.product.upsert({
      where: { itemCode: match.itemCode },
      create: {
        itemCode: match.itemCode,
        name: match.name,
        description: match.description || "",
        category: match.category || "Lainnya",
        price: match.price || 0,
        unit: match.unit || "pcs",
        stock: match.stock ?? 0,
        emoji: match.emoji || "🛒",
        image: rewrittenImage,
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
        image: rewrittenImage,
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

/**
 * Download an image from a URL and return it as a Buffer.
 * Used when migrating ERPNext-hosted product photos into /public.
 */
export async function downloadImage(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Download gagal: ${res.status} ${res.statusText}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
