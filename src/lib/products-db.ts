import { db } from "@/lib/db";
import type { Product as GroceryProduct } from "@/types/grocery";
import { MOCK_PRODUCTS_ENRICHED } from "@/lib/mock-data";

// ============================================================
// Products DB — CRUD + bulk + variant helpers.
// ============================================================
// Reads/writes happen on the Prisma Product model. The public
// storefront consumes the GroceryProduct shape (see types/grocery.ts),
// so we serialize Prisma rows → GroceryProduct via serializeProduct().
//
// Public read (getPublishedProducts) reads DB first. If DB is empty
// (no rows), it falls back to MOCK_PRODUCTS_ENRICHED so the storefront
// always has something to show during initial setup.
// ============================================================

/** Parse a JSON string field into a string array (safe — never throws). */
function parseStringArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((x): x is string => typeof x === "string");
    }
    return [];
  } catch {
    return [];
  }
}

/** Structural type for what serializeProduct accepts — any Product-like
 * row that optionally includes a variants array. Avoids tight coupling
 * to specific Prisma include shape (variants: true vs variants: {orderBy}). */
interface ProductRowLike {
  id: string;
  itemCode: string;
  name: string;
  description: string | null;
  longDescription: string | null;
  category: string;
  price: number;
  oldPrice: number | null;
  unit: string;
  stock: number;
  emoji: string;
  image: string | null;
  organic: boolean;
  onSale: boolean;
  tags: string | null;
  benefits: string | null;
  storageTip: string | null;
  origin: string | null;
  published: boolean;
  order: number;
  deletedFromErp?: boolean;
  erpSyncedAt: Date | null;
  variants?: Array<{
    id: string;
    name: string;
    sku: string | null;
    price: number;
    oldPrice: number | null;
    stock: number;
    unit: string;
  }>;
}

/** Convert a Prisma Product row (with variants) to GroceryProduct shape. */
export function serializeProduct(
  row: ProductRowLike
): GroceryProduct & {
  published: boolean;
  order: number;
  deletedFromErp?: boolean;
  longDescription?: string;
  benefits?: string[];
  storageTip?: string;
  origin?: string;
  variants?: {
    id: string;
    name: string;
    sku: string;
    price: number;
    oldPrice?: number | null;
    stock: number;
    unit: string;
  }[];
  erpSyncedAt?: string | null;
} {
  return {
    id: row.id,
    itemCode: row.itemCode,
    name: row.name || "Produk",
    description: row.description || "",
    longDescription: row.longDescription || undefined,
    category: row.category || "Lainnya",
    price: typeof row.price === "number" && row.price > 0 ? row.price : 0,
    oldPrice: row.oldPrice ?? undefined,
    unit: row.unit || "pcs",
    stock: typeof row.stock === "number" ? row.stock : 0,
    emoji: row.emoji || "🛒",
    image: row.image || undefined,
    organic: row.organic,
    onSale: row.onSale,
    tags: parseStringArray(row.tags),
    benefits: parseStringArray(row.benefits),
    storageTip: row.storageTip || undefined,
    origin: row.origin || undefined,
    // admin-only extensions
    published: row.published,
    order: row.order,
    deletedFromErp: row.deletedFromErp ?? false,
    variants: (row.variants || []).map((v) => ({
      id: v.id,
      name: v.name,
      sku: v.sku || "",
      price: v.price,
      oldPrice: v.oldPrice ?? null,
      stock: v.stock,
      unit: v.unit,
    })),
    erpSyncedAt: row.erpSyncedAt ? row.erpSyncedAt.toISOString() : null,
  };
}

/** Get all published products (for public storefront). Falls back to mock if DB empty. */
export async function getPublishedProducts(
  category?: string
): Promise<{ products: GroceryProduct[]; source: "db" | "mock" }> {
  try {
    // Filter published=true AND deletedFromErp=false (hide items that
    // were deleted/disabled in ERPNext). Items still exist in DB but
    // are hidden from storefront.
    const rows = await db.product.findMany({
      where: {
        published: true,
        deletedFromErp: false,
        ...(category ? { category } : {}),
      },
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
      include: { variants: true },
    });
    if (rows.length === 0) {
      // DB empty — fall back to mock
      const mock = category
        ? MOCK_PRODUCTS_ENRICHED.filter((p) => p.category === category)
        : MOCK_PRODUCTS_ENRICHED;
      return { products: mock, source: "mock" };
    }
    return { products: rows.map(serializeProduct), source: "db" };
  } catch (err) {
    console.error("[products-db] getPublishedProducts failed:", err);
    const mock = category
      ? MOCK_PRODUCTS_ENRICHED.filter((p) => p.category === category)
      : MOCK_PRODUCTS_ENRICHED;
    return { products: mock, source: "mock" };
  }
}

/** Get all products (admin) — includes unpublished. By default,
 * excludes products marked deletedFromErp=true (hidden from ERPNext
 * since last sync). Pass includeErpDeleted=true to also return those
 * (for "Trash" view in admin).
 */
export async function getAllProducts(options?: { includeErpDeleted?: boolean }) {
  const rows = await db.product.findMany({
    where: options?.includeErpDeleted ? undefined : { deletedFromErp: false },
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    include: { variants: { orderBy: { createdAt: "asc" } } },
  });
  return rows.map(serializeProduct);
}

/** Get products marked as deletedFromErp=true (admin "Trash" view).
 * These are items that no longer exist in ERPNext but still in DB
 * (preserved for restore / data retention). Admin can either:
 *   - Restore (re-publish manually, deletedFromErp stays true until
 *     next sync detects item back in ERPNext)
 *   - Hard delete permanently
 */
export async function getErpDeletedProducts() {
  const rows = await db.product.findMany({
    where: { deletedFromErp: true },
    orderBy: [{ updatedAt: "desc" }],
    include: { variants: true },
  });
  return rows.map(serializeProduct);
}

/** Get products with pagination (admin). Returns products + total count. */
export async function getProductsPaginated(options: {
  page?: number;
  limit?: number;
  includeErpDeleted?: boolean;
} = {}): Promise<{ products: ReturnType<typeof serializeProduct>[]; total: number }> {
  const { page = 1, limit = 10, includeErpDeleted = false } = options;
  const skip = (page - 1) * limit;

  const where = includeErpDeleted ? undefined : { deletedFromErp: false };

  const [rows, total] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
      include: { variants: { orderBy: { createdAt: "asc" } } },
      take: limit,
      skip,
    }),
    db.product.count({ where }),
  ]);

  return {
    products: rows.map(serializeProduct),
    total,
  };
}

/** Get a single product by id (admin). */
export async function getProductById(id: string) {
  const row = await db.product.findUnique({
    where: { id },
    include: { variants: { orderBy: { createdAt: "asc" } } },
  });
  return row ? serializeProduct(row) : null;
}

// ============================================================
// Input payload types
// ============================================================

export interface ProductInput {
  itemCode: string;
  name: string;
  description?: string;
  longDescription?: string | null;
  category: string;
  price: number;
  oldPrice?: number | null;
  unit: string;
  stock: number;
  emoji?: string;
  image?: string | null;
  organic?: boolean;
  onSale?: boolean;
  tags?: string[];
  benefits?: string[];
  storageTip?: string | null;
  origin?: string | null;
  published?: boolean;
  order?: number;
}

function toDbData(input: ProductInput) {
  return {
    itemCode: input.itemCode.trim(),
    name: input.name.trim(),
    description: input.description?.trim() || "",
    longDescription: input.longDescription?.trim() || null,
    category: input.category,
    price: Number(input.price) || 0,
    oldPrice: input.oldPrice != null ? Number(input.oldPrice) || null : null,
    unit: input.unit,
    stock: Number(input.stock) || 0,
    emoji: input.emoji || "🛒",
    image: input.image?.trim() || null,
    organic: !!input.organic,
    onSale: !!input.onSale,
    tags: input.tags && input.tags.length > 0 ? JSON.stringify(input.tags) : null,
    benefits:
      input.benefits && input.benefits.length > 0
        ? JSON.stringify(input.benefits)
        : null,
    storageTip: input.storageTip?.trim() || null,
    origin: input.origin?.trim() || null,
    published: input.published !== false,
    order: Number(input.order) || 0,
  };
}

/** Create a new product. Throws on duplicate itemCode. */
export async function createProduct(input: ProductInput) {
  const row = await db.product.create({
    data: toDbData(input),
    include: { variants: true },
  });
  return serializeProduct(row);
}

/** Update a product by id. Only provided fields are touched. */
export async function updateProduct(
  id: string,
  patch: Partial<ProductInput>
): Promise<ReturnType<typeof serializeProduct> | null> {
  const existing = await db.product.findUnique({ where: { id } });
  if (!existing) return null;
  // Merge patch onto existing values to build the full DB data.
  const merged: ProductInput = {
    itemCode: patch.itemCode ?? existing.itemCode,
    name: patch.name ?? existing.name,
    description: patch.description ?? existing.description,
    longDescription:
      patch.longDescription !== undefined
        ? patch.longDescription
        : existing.longDescription,
    category: patch.category ?? existing.category,
    price: patch.price ?? existing.price,
    oldPrice:
      patch.oldPrice !== undefined ? patch.oldPrice : existing.oldPrice,
    unit: patch.unit ?? existing.unit,
    stock: patch.stock ?? existing.stock,
    emoji: patch.emoji ?? existing.emoji,
    image: patch.image !== undefined ? patch.image : existing.image,
    organic: patch.organic ?? existing.organic,
    onSale: patch.onSale ?? existing.onSale,
    tags: patch.tags ?? parseStringArray(existing.tags),
    benefits: patch.benefits ?? parseStringArray(existing.benefits),
    storageTip:
      patch.storageTip !== undefined ? patch.storageTip : existing.storageTip,
    origin: patch.origin !== undefined ? patch.origin : existing.origin,
    published: patch.published ?? existing.published,
    order: patch.order ?? existing.order,
  };
  const row = await db.product.update({
    where: { id },
    data: toDbData(merged),
    include: { variants: true },
  });
  return serializeProduct(row);
}

/** Delete a product by id. Variants cascade. */
export async function deleteProduct(id: string): Promise<boolean> {
  try {
    await db.product.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}

// ============================================================
// Bulk actions
// ============================================================

export type BulkAction = "publish" | "unpublish" | "delete";

export interface BulkResult {
  action: BulkAction;
  affected: number;
}

export async function bulkUpdateProducts(
  ids: string[],
  action: BulkAction
): Promise<BulkResult> {
  if (ids.length === 0) return { action, affected: 0 };
  if (action === "delete") {
    const r = await db.product.deleteMany({ where: { id: { in: ids } } });
    return { action, affected: r.count };
  }
  const published = action === "publish";
  const r = await db.product.updateMany({
    where: { id: { in: ids } },
    data: { published },
  });
  return { action, affected: r.count };
}

// ============================================================
// Variant CRUD
// ============================================================

export interface VariantInput {
  name: string;
  sku?: string;
  price: number;
  oldPrice?: number | null;
  stock: number;
  unit?: string;
}

export async function addVariant(
  productId: string,
  input: VariantInput
) {
  const product = await db.product.findUnique({ where: { id: productId } });
  if (!product) return null;
  return db.productVariant.create({
    data: {
      productId,
      name: input.name.trim(),
      sku: input.sku?.trim() || null,
      price: Number(input.price) || 0,
      oldPrice: input.oldPrice != null ? Number(input.oldPrice) || null : null,
      stock: Number(input.stock) || 0,
      unit: input.unit || product.unit,
    },
  });
}

export async function updateVariant(
  productId: string,
  variantId: string,
  patch: Partial<VariantInput>
) {
  // Ensure variant belongs to product (avoid cross-product update).
  const existing = await db.productVariant.findUnique({
    where: { id: variantId },
    select: { productId: true },
  });
  if (!existing || existing.productId !== productId) return null;
  const data: Record<string, unknown> = {};
  if (patch.name !== undefined) data.name = patch.name.trim();
  if (patch.sku !== undefined) data.sku = patch.sku.trim() || null;
  if (patch.price !== undefined) data.price = Number(patch.price) || 0;
  if (patch.oldPrice !== undefined)
    data.oldPrice = patch.oldPrice != null ? Number(patch.oldPrice) || null : null;
  if (patch.stock !== undefined) data.stock = Number(patch.stock) || 0;
  if (patch.unit !== undefined) data.unit = patch.unit;
  return db.productVariant.update({ where: { id: variantId }, data });
}

export async function deleteVariant(
  productId: string,
  variantId: string
): Promise<boolean> {
  const existing = await db.productVariant.findUnique({
    where: { id: variantId },
    select: { productId: true },
  });
  if (!existing || existing.productId !== productId) return false;
  await db.productVariant.delete({ where: { id: variantId } });
  return true;
}
