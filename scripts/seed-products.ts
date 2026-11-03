import { db } from "@/lib/db";
import { MOCK_PRODUCTS_ENRICHED } from "@/lib/mock-data";

// ============================================================
// seed-products — idempotent seed of 23 products from mock data.
// ============================================================
// Maps each MOCK_PRODUCTS_ENRICHED entry to a Product row keyed by
// itemCode (unique). On conflict, ERPNext-sourced fields are
// updated; admin-edited fields (organic, onSale, tags, benefits,
// storageTip, origin, published, order) are preserved.
//
// Only runs if the Product table is empty (no rows). Use
// `bun run db:seed-products --force` to re-seed regardless.
// ============================================================

async function main() {
  const force = process.argv.includes("--force");
  console.log("🌱 Seeding products from mock data...");

  const existingCount = await db.product.count();
  if (existingCount > 0 && !force) {
    console.log(
      `  ℹ️  Product table already has ${existingCount} rows. Skipping (use --force to re-seed).`
    );
    return;
  }

  let created = 0;
  let updated = 0;
  for (let i = 0; i < MOCK_PRODUCTS_ENRICHED.length; i++) {
    const p = MOCK_PRODUCTS_ENRICHED[i];
    if (!p.itemCode) continue;
    // Check existence first so we can report created vs updated counts.
    const existing = await db.product.findUnique({
      where: { itemCode: p.itemCode },
      select: { id: true },
    });
    await db.product.upsert({
      where: { itemCode: p.itemCode },
      create: {
        itemCode: p.itemCode,
        name: p.name,
        description: p.description || "",
        longDescription: p.longDescription || null,
        category: p.category || "Lainnya",
        price: p.price || 0,
        oldPrice: p.oldPrice ?? null,
        unit: p.unit || "pcs",
        stock: p.stock ?? 0,
        emoji: p.emoji || "🛒",
        image: p.image || null,
        organic: !!p.organic,
        onSale: !!p.onSale,
        tags: p.tags && p.tags.length > 0 ? JSON.stringify(p.tags) : null,
        benefits:
          p.benefits && p.benefits.length > 0
            ? JSON.stringify(p.benefits)
            : null,
        storageTip: p.storageTip || null,
        origin: p.origin || null,
        published: true,
        order: i,
      },
      update: {
        // Refresh core fields on conflict (admin-edited fields preserved)
        name: p.name,
        description: p.description || "",
        longDescription: p.longDescription || null,
        category: p.category || "Lainnya",
        price: p.price || 0,
        oldPrice: p.oldPrice ?? null,
        unit: p.unit || "pcs",
        stock: p.stock ?? 0,
        emoji: p.emoji || "🛒",
        image: p.image || null,
      },
    });
    if (existing) updated++;
    else created++;
  }

  console.log(`  ✓ ${MOCK_PRODUCTS_ENRICHED.length} products processed (${created} created, ${updated} updated)`);
  console.log("\n✅ Seed-products complete!");
}

main()
  .catch((e) => {
    console.error("❌ seed-products failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
