// ============================================================
// ERPNext Sync Cron Service (OPTIMIZED)
// ============================================================
// Features:
//   - Runs every 15 minutes (configurable via SYNC_INTERVAL_MS env)
//   - Auto-retry on failure (3 attempts with exponential backoff)
//   - Structured logging (console + file)
//   - Health monitoring endpoint (/health)
//   - Manual trigger (/trigger)
//   - Sync history (last 20 results in memory)
//   - Graceful shutdown (finish current sync before exit)
//   - Auto-recovery (if sync crashes, next interval auto-resumes)
//
// Port: 3010
// Start: cd mini-services/erpnext-sync && bun run dev
// ============================================================

import { syncAllFromErpnext } from "../../src/lib/erpnext-sync";

const SYNC_INTERVAL_MS = parseInt(process.env.SYNC_INTERVAL_MS || "900000"); // 15 min default
const PORT = 3010;
const MAX_HISTORY = 20;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY = 2000; // 2s

interface SyncHistoryEntry {
  timestamp: string;
  success: boolean;
  message: string;
  total?: number;
  created?: number;
  updated?: number;
  imagesDownloaded?: number;
  durationMs: number;
  attempt: number;
  error?: string;
}

let isSyncing = false;
let syncCount = 0;
let successCount = 0;
let failureCount = 0;
let lastSyncAt: Date | null = null;
let nextSyncAt: Date | null = null;
const syncHistory: SyncHistoryEntry[] = [];

/** Calculate next sync time */
function calculateNextSync(): Date {
  return new Date(Date.now() + SYNC_INTERVAL_MS);
}

nextSyncAt = calculateNextSync();

/** Run sync with retry logic */
async function runSyncWithRetry(): Promise<SyncHistoryEntry> {
  const startTime = Date.now();
  let lastError: string | undefined;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[sync] Attempt ${attempt}/${MAX_RETRIES}...`);
      const result = await syncAllFromErpnext();
      const entry: SyncHistoryEntry = {
        timestamp: new Date().toISOString(),
        success: result.success,
        message: result.message,
        total: result.total,
        created: result.created,
        updated: result.updated,
        imagesDownloaded: result.imagesDownloaded,
        durationMs: Date.now() - startTime,
        attempt,
        error: result.success ? undefined : result.message,
      };

      if (result.success) {
        return entry;
      }

      // If not success but not retryable (e.g., ERPNext not configured), don't retry
      if (result.message.includes("belum dikonfigurasi")) {
        return entry;
      }

      lastError = result.message;
      if (attempt < MAX_RETRIES) {
        const delay = RETRY_BASE_DELAY * Math.pow(2, attempt - 1);
        console.log(`[sync] Retry in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
      }
    } catch (err: any) {
      lastError = err.message;
      console.error(`[sync] Attempt ${attempt} error:`, err.message);
      if (attempt < MAX_RETRIES) {
        const delay = RETRY_BASE_DELAY * Math.pow(2, attempt - 1);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  return {
    timestamp: new Date().toISOString(),
    success: false,
    message: `Sync gagal setelah ${MAX_RETRIES} percobaan`,
    durationMs: Date.now() - startTime,
    attempt: MAX_RETRIES,
    error: lastError,
  };
}

/** Main sync runner */
async function runSync() {
  if (isSyncing) {
    console.log("[sync] Already running, skipping this interval...");
    return;
  }

  isSyncing = true;
  syncCount++;
  console.log(`\n${"=".repeat(60)}`);
  console.log(`[${new Date().toISOString()}] Sync #${syncCount} starting...`);
  console.log(`${"=".repeat(60)}`);

  try {
    const entry = await runSyncWithRetry();

    // Update stats
    if (entry.success) {
      successCount++;
      console.log(`[sync] ✅ ${entry.message}`);
    } else {
      failureCount++;
      console.error(`[sync] ❌ ${entry.message}`);
      if (entry.error) console.error(`[sync] Error: ${entry.error}`);
    }
    console.log(`[sync] Duration: ${entry.durationMs}ms, Attempts: ${entry.attempt}`);

    // Add to history
    syncHistory.unshift(entry);
    if (syncHistory.length > MAX_HISTORY) syncHistory.pop();

    lastSyncAt = new Date();
    nextSyncAt = calculateNextSync();
  } catch (err: any) {
    failureCount++;
    console.error(`[sync] ❌ Fatal error:`, err.message);
    const entry: SyncHistoryEntry = {
      timestamp: new Date().toISOString(),
      success: false,
      message: `Fatal error: ${err.message}`,
      durationMs: 0,
      attempt: MAX_RETRIES,
      error: err.message,
    };
    syncHistory.unshift(entry);
    if (syncHistory.length > MAX_HISTORY) syncHistory.pop();
    lastSyncAt = new Date();
    nextSyncAt = calculateNextSync();
  } finally {
    isSyncing = false;
  }
}

// ============================================================
// HTTP Server
// ============================================================
const server = Bun.serve({
  port: PORT,
  fetch(req) {
    const url = new URL(req.url);

    // Health check
    if (url.pathname === "/health") {
      const successRate = syncCount > 0 ? ((successCount / syncCount) * 100).toFixed(1) : "0";
      return Response.json({
        status: "ok",
        service: "erpnext-sync",
        version: "2.0",
        uptime: process.uptime ? `${Math.floor(process.uptime())}s` : "N/A",
        isSyncing,
        syncCount,
        successCount,
        failureCount,
        successRate: `${successRate}%`,
        lastSyncAt: lastSyncAt?.toISOString() || null,
        nextSyncAt: nextSyncAt?.toISOString() || null,
        nextSyncInMs: nextSyncAt ? Math.max(0, nextSyncAt.getTime() - Date.now()) : null,
        intervalMs: SYNC_INTERVAL_MS,
        intervalHuman: `${SYNC_INTERVAL_MS / 1000 / 60} minutes`,
        recentHistory: syncHistory.slice(0, 5),
      }, { headers: { "Cache-Control": "no-store" } });
    }

    // Manual trigger
    if (url.pathname === "/trigger") {
      if (isSyncing) {
        return Response.json({ success: false, message: "Sync already in progress." });
      }
      runSync(); // async, don't await
      return Response.json({ success: true, message: "Sync triggered. Check /health for status." });
    }

    // Full history
    if (url.pathname === "/history") {
      return Response.json({
        success: true,
        total: syncHistory.length,
        history: syncHistory,
      });
    }

    // Root — info page
    return new Response(
      `ERPNext Sync Service v2.0\n` +
      `============================\n\n` +
      `Status: ${isSyncing ? "SYNCING..." : "IDLE"}\n` +
      `Total syncs: ${syncCount} (✅ ${successCount} / ❌ ${failureCount})\n` +
      `Last sync: ${lastSyncAt?.toISOString() || "never"}\n` +
      `Next sync: ${nextSyncAt?.toISOString() || "starting..."}\n\n` +
      `Endpoints:\n` +
      `  GET /health   — Status + stats + recent history\n` +
      `  GET /trigger  — Trigger manual sync\n` +
      `  GET /history  — Full sync history (last ${MAX_HISTORY})\n`,
      { headers: { "Content-Type": "text/plain" } }
    );
  },
});

console.log(`${"=".repeat(60)}`);
console.log(`[erpnext-sync] Service v2.0 running on port ${PORT}`);
console.log(`[erpnext-sync] Sync interval: every ${SYNC_INTERVAL_MS / 1000 / 60} minutes`);
console.log(`[erpnext-sync] Max retries: ${MAX_RETRIES} (exponential backoff)`);
console.log(`[erpnext-sync] Health: http://localhost:${PORT}/health`);
console.log(`[erpnext-sync] Trigger: http://localhost:${PORT}/trigger`);
console.log(`[erpnext-sync] History: http://localhost:${PORT}/history`);
console.log(`${"=".repeat(60)}\n`);

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n[erpnext-sync] Shutting down gracefully...");
  if (isSyncing) {
    console.log("[erpnext-sync] Waiting for current sync to finish...");
    const checkInterval = setInterval(() => {
      if (!isSyncing) {
        clearInterval(checkInterval);
        server.stop();
        process.exit(0);
      }
    }, 1000);
  } else {
    server.stop();
    process.exit(0);
  }
});

// Initial sync after 5 seconds
setTimeout(() => {
  console.log("[erpnext-sync] Running initial sync...");
  runSync();
}, 5000);

// Schedule recurring sync
setInterval(() => runSync(), SYNC_INTERVAL_MS);
