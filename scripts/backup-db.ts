import { copyFileSync, mkdirSync, readdirSync, unlinkSync, statSync, existsSync } from "fs";
import path from "path";
import { Database } from "bun:sqlite";

// ============================================================
// backup-db — daily SQLite backup script.
// ============================================================
// Run via cron: 0 3 * * * cd ~/sayurlogi && bun run scripts/backup-db.ts
//
// Features:
//   - Copy db/custom.db → db/backups/backup-YYYY-MM-DD-HHMM.db
//   - Verify backup integrity (open + count rows)
//   - Auto-delete backups older than RETENTION_DAYS (default 30)
//   - Log summary to stdout (for cron log)
//   - Exit 0 success, 1 failure (for monitoring)
// ============================================================

const DB_PATH = path.join(process.cwd(), "db", "custom.db");
const BACKUP_DIR = path.join(process.cwd(), "db", "backups");
const RETENTION_DAYS = parseInt(process.env.BACKUP_RETENTION_DAYS || "30", 10);

function timestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}

/** Verify backup integrity by opening it and running a count query. */
function verifyBackup(backupPath: string): { ok: boolean; productCount: number; error?: string } {
  try {
    const db = new Database(backupPath, { readonly: true });
    const result = db.query("SELECT COUNT(*) as count FROM Product").get() as { count: number } | null;
    db.close();
    if (!result || typeof result.count !== "number") {
      return { ok: false, productCount: 0, error: "COUNT query returned invalid result" };
    }
    return { ok: true, productCount: result.count };
  } catch (err: any) {
    return { ok: false, productCount: 0, error: err.message };
  }
}

/** Delete backup files older than RETENTION_DAYS. */
function cleanupOldBackups(): { deleted: number; errors: number } {
  if (!existsSync(BACKUP_DIR)) return { deleted: 0, errors: 0 };

  const files = readdirSync(BACKUP_DIR).filter((f) => f.startsWith("backup-") && f.endsWith(".db"));
  const now = Date.now();
  const maxAge = RETENTION_DAYS * 24 * 60 * 60 * 1000;
  let deleted = 0;
  let errors = 0;

  for (const file of files) {
    const filePath = path.join(BACKUP_DIR, file);
    try {
      const stat = statSync(filePath);
      if (now - stat.mtimeMs > maxAge) {
        unlinkSync(filePath);
        deleted++;
        console.log(`  🗑️  Deleted old backup: ${file}`);
      }
    } catch (err: any) {
      errors++;
      console.warn(`  ⚠️  Failed to delete ${file}: ${err.message}`);
    }
  }
  return { deleted, errors };
}

async function main() {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`[${new Date().toISOString()}] Backup started`);
  console.log(`${"=".repeat(60)}`);

  // 1. Check source DB exists
  if (!existsSync(DB_PATH)) {
    console.error(`❌ Source DB not found: ${DB_PATH}`);
    process.exit(1);
  }

  const sourceSize = statSync(DB_PATH).size;
  console.log(`📦 Source: ${DB_PATH} (${(sourceSize / 1024).toFixed(1)} KB)`);

  // 2. Create backup directory if not exists
  mkdirSync(BACKUP_DIR, { recursive: true });
  console.log(`📂 Backup dir: ${BACKUP_DIR}`);

  // 3. Generate backup filename + copy
  const backupName = `backup-${timestamp()}.db`;
  const backupPath = path.join(BACKUP_DIR, backupName);

  try {
    copyFileSync(DB_PATH, backupPath);
    const backupSize = statSync(backupPath).size;
    console.log(`✅ Backup created: ${backupName} (${(backupSize / 1024).toFixed(1)} KB)`);
  } catch (err: any) {
    console.error(`❌ Backup failed: ${err.message}`);
    process.exit(1);
  }

  // 4. Verify backup integrity
  console.log(`🔍 Verifying backup integrity...`);
  const verification = verifyBackup(backupPath);
  if (!verification.ok) {
    console.error(`❌ Backup verification FAILED: ${verification.error}`);
    console.error(`   Backup file may be corrupt. Manual intervention required.`);
    process.exit(1);
  }
  console.log(`✅ Verification OK: ${verification.productCount} products in backup`);

  // 5. Cleanup old backups
  console.log(`\n🧹 Cleaning up backups older than ${RETENTION_DAYS} days...`);
  const cleanupResult = cleanupOldBackups();
  console.log(`   Deleted: ${cleanupResult.deleted}, Errors: ${cleanupResult.errors}`);

  // 6. List remaining backups
  const remaining = readdirSync(BACKUP_DIR).filter((f) => f.startsWith("backup-") && f.endsWith(".db"));
  console.log(`\n📋 Remaining backups: ${remaining.length}`);
  if (remaining.length > 0) {
    const latest = remaining[remaining.length - 1];
    const oldest = remaining[0];
    console.log(`   Latest: ${latest}`);
    console.log(`   Oldest: ${oldest}`);
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`[${new Date().toISOString()}] Backup completed successfully`);
  console.log(`${"=".repeat(60)}\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error(`Fatal error:`, err);
  process.exit(1);
});
