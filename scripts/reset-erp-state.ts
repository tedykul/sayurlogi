import { db } from "@/lib/db";

// ============================================================
// One-off cleanup: reset ERPNext integration state to "fresh".
// ============================================================
// - Deletes all IntegrationConfig rows (clears any saved ERPNext
//   config, including test/demo values).
// - Nulls erpSyncedAt on all products (clears stale sync stamps
//   from mock-fallback runs, so /api/products reports source=local
//   honestly until a real ERPNext sync succeeds).
//
// Run: bun run scripts/reset-erp-state.ts
// ============================================================

async function main() {
  console.log("🧹 Resetting ERPNext integration state...");

  const deleted = await db.integrationConfig.deleteMany({});
  console.log(`   🗑️  Deleted ${deleted.count} IntegrationConfig row(s)`);

  const cleared = await db.product.updateMany({
    where: { erpSyncedAt: { not: null } },
    data: { erpSyncedAt: null },
  });
  console.log(`   ↺ Cleared erpSyncedAt on ${cleared.count} product(s)`);

  const total = await db.product.count();
  const synced = await db.product.count({ where: { erpSyncedAt: { not: null } } });
  console.log(`\n✨ Done. Products: ${total} total, ${synced} synced (should be 0).`);
}

main()
  .catch((e) => {
    console.error("❌ Reset error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
