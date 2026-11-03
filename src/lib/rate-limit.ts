import { getClientIp } from "@/lib/audit";

// ============================================================
// Rate limiter — in-memory sliding window per IP.
// ============================================================
// Sprint 6 (Skenario C): simple in-memory implementation suitable
// for single-server deployment. For multi-server, upgrade to Redis.
//
// Two-tier protection:
//   - Soft limit: 5 attempts per 15 min → block 15 min
//   - Hard limit: 20 attempts per 24h → block 24h
// ============================================================

interface RateLimitEntry {
  attempts: number[]; // timestamps of recent attempts (ms)
  blockedUntil: number | null; // ms timestamp when block expires
}

// In-memory store. Key: `${bucket}:${ip}`. Resets on server restart.
const store = new Map<string, RateLimitEntry>();

// Cleanup old entries every 10 minutes to prevent memory leak
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
const WINDOW_SOFT_MS = 15 * 60 * 1000; // 15 minutes
const WINDOW_HARD_MS = 24 * 60 * 60 * 1000; // 24 hours
const SOFT_LIMIT = 5; // max attempts per 15 min
const HARD_LIMIT = 20; // max attempts per 24h
const SOFT_BLOCK_MS = 15 * 60 * 1000; // block 15 min after soft limit
const HARD_BLOCK_MS = 24 * 60 * 60 * 1000; // block 24h after hard limit

let lastCleanup = Date.now();

/** Remove entries older than 24h from memory store. */
function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  const cutoff = now - WINDOW_HARD_MS;
  for (const [key, entry] of store.entries()) {
    const hasRecent = entry.attempts.some((t) => t > cutoff);
    if (!hasRecent && (!entry.blockedUntil || entry.blockedUntil < now)) {
      store.delete(key);
    }
  }
}

export interface RateLimitResult {
  blocked: boolean;
  retryAfterSeconds: number;
  resetAt: Date | null;
  attemptsRemaining: number;
}

/**
 * Check rate limit for a bucket + IP. Records an attempt.
 * Returns blocked=true if IP exceeded limit.
 *
 * @param bucket Logical bucket name (e.g., "admin-login")
 * @returns RateLimitResult with blocked status + retry info
 */
export async function checkRateLimit(bucket: string): Promise<RateLimitResult> {
  cleanup();
  const ip = (await getClientIp()) || "unknown";
  const key = `${bucket}:${ip}`;
  const now = Date.now();

  const entry = store.get(key) || { attempts: [], blockedUntil: null };

  // Check if currently blocked
  if (entry.blockedUntil && entry.blockedUntil > now) {
    const retryAfterMs = entry.blockedUntil - now;
    return {
      blocked: true,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
      resetAt: new Date(entry.blockedUntil),
      attemptsRemaining: 0,
    };
  }

  // Block expired → reset
  if (entry.blockedUntil && entry.blockedUntil <= now) {
    entry.blockedUntil = null;
    entry.attempts = [];
  }

  // Filter attempts within windows
  const softAttempts = entry.attempts.filter((t) => t > now - WINDOW_SOFT_MS);
  const hardAttempts = entry.attempts.filter((t) => t > now - WINDOW_HARD_MS);

  // Record this attempt
  entry.attempts = [...hardAttempts, now];
  store.set(key, entry);

  // Check hard limit (24h, 20 attempts)
  if (hardAttempts.length + 1 > HARD_LIMIT) {
    entry.blockedUntil = now + HARD_BLOCK_MS;
    store.set(key, entry);
    return {
      blocked: true,
      retryAfterSeconds: Math.ceil(HARD_BLOCK_MS / 1000),
      resetAt: new Date(now + HARD_BLOCK_MS),
      attemptsRemaining: 0,
    };
  }

  // Check soft limit (15 min, 5 attempts)
  if (softAttempts.length + 1 > SOFT_LIMIT) {
    entry.blockedUntil = now + SOFT_BLOCK_MS;
    store.set(key, entry);
    return {
      blocked: true,
      retryAfterSeconds: Math.ceil(SOFT_BLOCK_MS / 1000),
      resetAt: new Date(now + SOFT_BLOCK_MS),
      attemptsRemaining: 0,
    };
  }

  // Not blocked
  const attemptsRemaining = Math.max(0, SOFT_LIMIT - softAttempts.length - 1);
  return {
    blocked: false,
    retryAfterSeconds: 0,
    resetAt: null,
    attemptsRemaining,
  };
}

/**
 * Reset rate limit for a bucket + IP (e.g., after successful login).
 * Optional — successful login doesn't need reset since we only
 * track failed attempts implicitly via checkRateLimit.
 */
export async function resetRateLimit(bucket: string): Promise<void> {
  const ip = (await getClientIp()) || "unknown";
  const key = `${bucket}:${ip}`;
  store.delete(key);
}
