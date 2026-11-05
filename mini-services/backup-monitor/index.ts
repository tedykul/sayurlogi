// ============================================================
// Backup Monitor Service
// ============================================================
// Monitors backup health + provides HTTP endpoints for status.
// Runs on port 3011 (fixed, no conflict with 3000/3010).
//
// Endpoints:
//   GET /health   → backup status (last backup, age, count)
//   GET /trigger  → trigger manual backup (async)
//   GET /list     → list backup files
//
// Start: cd mini-services/backup-monitor && bun run dev
// ============================================================

import { readdirSync, statSync, existsSync } from "fs";
import path from "path";

const PORT = 3011;
const PROJECT_ROOT = path.resolve(__dirname, "../..");
const BACKUP_DIR = path.join(PROJECT_ROOT, "db", "backups");
const DB_PATH = path.join(PROJECT_ROOT, "db", "custom.db");
const MAX_AGE_HOURS = 26; // alert if last backup > 26 hours

interface BackupInfo {
  name: string;
  size: number;
  createdAt: Date;
  ageHours: number;
}

/** Get list of backup files sorted by date (newest first). */
function getBackups(): BackupInfo[] {
  if (!existsSync(BACKUP_DIR)) return [];
  const files = readdirSync(BACKUP_DIR).filter((f) => f.startsWith("backup-") && f.endsWith(".db"));
  const backups: BackupInfo[] = files.map((name) => {
    const filePath = path.join(BACKUP_DIR, name);
    const stat = statSync(filePath);
    const ageHours = (Date.now() - stat.mtimeMs) / (1000 * 60 * 60);
    return { name, size: stat.size, createdAt: stat.mtime, ageHours };
  });
  return backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/** Determine backup health status. */
function getBackupStatus(): {
  status: "ok" | "warning" | "critical";
  lastBackup: string | null;
  ageHours: number | null;
  backupCount: number;
  message: string;
} {
  const backups = getBackups();
  if (backups.length === 0) {
    return {
      status: "critical",
      lastBackup: null,
      ageHours: null,
      backupCount: 0,
      message: "No backups found. Run backup-db.ts immediately.",
    };
  }
  const latest = backups[0];
  if (latest.ageHours > MAX_AGE_HOURS) {
    return {
      status: "critical",
      lastBackup: latest.createdAt.toISOString(),
      ageHours: Math.round(latest.ageHours),
      backupCount: backups.length,
      message: `Last backup is ${Math.round(latest.ageHours)}h old (> ${MAX_AGE_HOURS}h). Check cron job.`,
    };
  }
  if (latest.ageHours > 24) {
    return {
      status: "warning",
      lastBackup: latest.createdAt.toISOString(),
      ageHours: Math.round(latest.ageHours),
      backupCount: backups.length,
      message: `Last backup is ${Math.round(latest.ageHours)}h old. Consider running backup soon.`,
    };
  }
  return {
    status: "ok",
    lastBackup: latest.createdAt.toISOString(),
    ageHours: Math.round(latest.ageHours),
    backupCount: backups.length,
    message: `Backup healthy. Last backup ${Math.round(latest.ageHours)}h ago.`,
  };
}

/** Trigger manual backup (async, non-blocking). */
async function triggerBackup(): Promise<{ success: boolean; message: string }> {
  try {
    const proc = Bun.spawn(["bun", "run", path.join(PROJECT_ROOT, "scripts/backup-db.ts")], {
      cwd: PROJECT_ROOT,
      stdout: "pipe",
      stderr: "pipe",
    });
    // Don't wait for completion — return immediately
    return { success: true, message: "Backup triggered. Check /health for status." };
  } catch (err: any) {
    return { success: false, message: `Failed to trigger backup: ${err.message}` };
  }
}

// ============================================================
// HTTP Server
// ============================================================
const server = Bun.serve({
  port: PORT,
  fetch(req) {
    const url = new URL(req.url);

    // GET /health — backup status
    if (url.pathname === "/health") {
      const status = getBackupStatus();
      return Response.json(
        {
          service: "backup-monitor",
          version: "1.0",
          ...status,
          dbExists: existsSync(DB_PATH),
          backupDir: BACKUP_DIR,
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    // GET /trigger — manual backup
    if (url.pathname === "/trigger") {
      // Don't await — fire and forget
      triggerBackup().then(() => {});
      return Response.json({ success: true, message: "Backup triggered. Check /health for status." });
    }

    // GET /list — list backups
    if (url.pathname === "/list") {
      const backups = getBackups();
      return Response.json({
        success: true,
        total: backups.length,
        backups: backups.map((b) => ({
          name: b.name,
          sizeKB: Math.round(b.size / 1024),
          createdAt: b.createdAt.toISOString(),
          ageHours: Math.round(b.ageHours),
        })),
      });
    }

    // Root — info page
    return new Response(
      `Backup Monitor Service v1.0\n` +
        `============================\n\n` +
        `Endpoints:\n` +
        `  GET /health   — Backup status + health\n` +
        `  GET /trigger  — Trigger manual backup\n` +
        `  GET /list     — List backup files\n\n` +
        `Backup dir: ${BACKUP_DIR}\n`,
      { headers: { "Content-Type": "text/plain" } }
    );
  },
});

console.log(`${"=".repeat(60)}`);
console.log(`[backup-monitor] Service v1.0 running on port ${PORT}`);
console.log(`[backup-monitor] Backup dir: ${BACKUP_DIR}`);
console.log(`[backup-monitor] Health: http://localhost:${PORT}/health`);
console.log(`[backup-monitor] Trigger: http://localhost:${PORT}/trigger`);
console.log(`${"=".repeat(60)}\n`);

// Initial status check on startup
const initialStatus = getBackupStatus();
console.log(`[backup-monitor] Initial status: ${initialStatus.status} — ${initialStatus.message}`);
if (initialStatus.status === "critical") {
  console.warn(`[backup-monitor] ⚠️  CRITICAL: ${initialStatus.message}`);
}
