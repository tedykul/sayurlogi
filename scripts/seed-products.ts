import { db } from "@/lib/db";

// ============================================================
// seed-products — idempotent insert of demo products.
// Run: bun run scripts/seed-products.ts
// ============================================================

const DEMO_PRODUCTS = [
  { name: "Bayam Hijau Segar", description: "1 ikat, dipetik pagi", price: 8000, category: "Sayuran", stock: 50 },
  { name: "Tomat Merah", description: "500 gram", price: 12000, category: "Sayuran", stock: 40 },
  { name: "Wortel Lokal", description: "500 gram", price: 10000, category: "Sayuran", stock: 35 },
  { name: "Apel Fuji", description: "1 kg", price: 45000, category: "Buah", stock: 25 },
  { name: "Pisang Cavendish", description: "1 sisir", price: 28000, category: "Buah", stock: 30 },
  { name: "Jeruk Manis", description: "1 kg", price: 32000, category: "Buah", stock: 28 },
  { name: "Bawang Merah", description: "500 gram", price: 18000, category: "Sayuran", stock: 45 },
  { name: "Cabai Merah Keriting", description: "250 gram", price: 22000, category: "Sayuran", stock: 20 },
  { name: "Mangga Harum Manis", description: "1 kg", price: 38000, category: "Buah", stock: 22 },
  { name: "Brokoli Hijau", description: "1 bunga", price: 15000, category: "Sayuran", stock: 18 },
  { name: "Anggur Red Globe", description: "500 gram", price: 55000, category: "Buah", stock: 15 },
  { name: "Jamur Tiram", description: "250 gram", price: 13000, category: "Sayuran", stock: 30 },
];

async function main() {
  console.log("🌱 Seeding products...");
  let created = 0;
  let skipped = 0;

  for (const p of DEMO_PRODUCTS) {
    const existing = await db.product.findFirst({ where: { name: p.name } });
    if (existing) {
      console.log(`   ⏭️  ${p.name} sudah ada, skip`);
      skipped++;
      continue;
    }
    await db.product.create({
      data: {
        name: p.name,
        description: p.description,
        price: p.price,
        category: p.category,
        stock: p.stock,
      },
    });
    console.log(`   ✅ ${p.name} dibuat`);
    created++;
  }

  console.log(`\n✨ Selesai: ${created} dibuat, ${skipped} dilewati.`);
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
