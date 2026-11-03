import { db } from "@/lib/db";

// ============================================================
// seed-coupons — idempotent insert of demo coupons.
// ============================================================
// Run: bun run scripts/seed-coupons.ts
// Safe to re-run: existing codes are skipped (upsert with no-op
// update if the value/type changed — we only create when missing).
// ============================================================

const DEMO_COUPONS = [
  {
    code: "WELCOME10",
    type: "percent",
    value: 10,
    minOrder: 0,
    maxUsage: 100,
    maxPerUser: 1,
    note: "Diskon 10% untuk customer baru",
  },
  {
    code: "ONGKIR0",
    type: "free_shipping",
    value: 0,
    minOrder: 30000,
    maxUsage: 50,
    maxPerUser: 1,
    note: "Gratis ongkir min belanja Rp30rb",
  },
  {
    code: "HEMAT20",
    type: "fixed",
    value: 20000,
    minOrder: 100000,
    maxUsage: 30,
    maxPerUser: 1,
    note: "Potongan Rp20rb min belanja Rp100rb",
  },
  {
    code: "SAYUR5",
    type: "percent",
    value: 5,
    minOrder: 0,
    maxUsage: 0, // unlimited
    maxPerUser: 0, // unlimited
    scopeType: "category" as const,
    scopeValue: "Sayuran",
    note: "Diskon 5% kategori Sayuran (unlimited demo)",
  },
];

async function main() {
  console.log("🌱 Seeding coupons...");
  let created = 0;
  let skipped = 0;

  for (const c of DEMO_COUPONS) {
    const existing = await db.coupon.findUnique({ where: { code: c.code } });
    if (existing) {
      console.log(`   ⏭️  ${c.code} sudah ada, skip`);
      skipped++;
      continue;
    }
    await db.coupon.create({
      data: {
        code: c.code,
        type: c.type,
        value: c.value,
        minOrder: c.minOrder,
        maxUsage: c.maxUsage,
        maxPerUser: c.maxPerUser,
        active: true,
        scopeType: (c as { scopeType?: string }).scopeType ?? "all",
        scopeValue: (c as { scopeValue?: string }).scopeValue ?? null,
        note: c.note,
      },
    });
    console.log(`   ✅ ${c.code} dibuat`);
    created++;
  }

  console.log(`\n✅ Seed-coupons done! ${created} created, ${skipped} skipped.`);
}

main()
  .catch((err) => {
    console.error("❌ Seed-coupons failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
