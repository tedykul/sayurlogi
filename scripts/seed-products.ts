import { db } from "@/lib/db";
import { MOCK_PRODUCTS } from "@/lib/mock-data";

// ============================================================
// seed-products — idempotent upsert of demo products.
// Run: bun run scripts/seed-products.ts
// ============================================================
// Uses MOCK_PRODUCTS (lib/mock-data.ts) as the source so the
// seeded catalog has ERPNext-compatible fields (itemCode, emoji,
// oldPrice, unit, published).
//
// Match strategy (avoids duplicates + preserves product.id so
// existing carts keep working):
//   1. findFirst by itemCode — re-seed updates in place.
//   2. else findFirst by name — enriches legacy seed rows (which
//      had no itemCode) without creating a duplicate.
//   3. else create new row.
//
// Seeded products are NOT marked ERPNext-synced (erpSyncedAt
// stays null) so they show as "local" source until a real
// ERPNext sync runs.
// ============================================================

async function main() {
  console.log("🌱 Seeding products from MOCK_PRODUCTS...");
  let created = 0;
  let updated = 0;

  for (const p of MOCK_PRODUCTS) {
    if (!p.itemCode) continue;

    // Match by itemCode first, then by name (legacy rows).
    const existing =
      (await db.product.findUnique({ where: { itemCode: p.itemCode } })) ??
      (await db.product.findFirst({ where: { name: p.name } }));

    if (existing) {
      await db.product.update({
        where: { id: existing.id },
        data: {
          itemCode: p.itemCode,
          name: p.name,
          description: p.description,
          price: p.price,
          oldPrice: p.oldPrice,
          category: p.category,
          unit: p.unit,
          emoji: p.emoji,
          stock: p.stock,
          published: true,
        },
      });
      updated++;
      console.log(`   ♻️  ${p.itemCode} — ${p.name} di-update`);
    } else {
      await db.product.create({
        data: {
          itemCode: p.itemCode,
          name: p.name,
          description: p.description,
          price: p.price,
          oldPrice: p.oldPrice,
          category: p.category,
          unit: p.unit,
          emoji: p.emoji,
          stock: p.stock,
          published: true,
        },
      });
      created++;
      console.log(`   ✅ ${p.itemCode} — ${p.name} dibuat`);
    }
  }

  console.log(`\n✨ Selesai: ${created} dibuat, ${updated} di-update.`);
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });

