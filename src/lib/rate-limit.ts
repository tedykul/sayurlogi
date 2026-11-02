// ============================================================
// Rate limiter — in-memory sliding window per IP.
// ============================================================
// Used by public coupon endpoints (validate, track) to prevent
// brute-force coupon code guessing. Uses a simple Map keyed by
// `${ip}:${route}` → array of timestamps within the window.
//
// Memory is bounded by maxEntries — oldest entries evicted LRU.
// For multi-instance production, replace with Redis. For local
// demo and single-instance, this is sufficient.
// ============================================================

interface Bucket {
  timestamps: number[];
}

const buckets = new Map<string, Bucket>();
const MAX_ENTRIES = 10_000;

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number; // epoch ms
}

// ------------------------------------------------------------
// Check rate limit for a key (typically `${ip}:${route}`).
// limit: max requests. windowMs: time window in milliseconds.
// Returns ok=false if exceeded. Mutates bucket (records hit).
// ------------------------------------------------------------
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const windowStart = now - windowMs;

  // Evict oldest bucket if memory is full (LRU-ish)
  if (buckets.size >= MAX_ENTRIES) {
    const firstKey = buckets.keys().next().value;
    if (firstKey) buckets.delete(firstKey);
  }

  const bucket = buckets.get(key) ?? { timestamps: [] };
  // Drop timestamps outside the window
  bucket.timestamps = bucket.timestamps.filter((t) => t > windowStart);

  if (bucket.timestamps.length >= limit) {
    const oldest = bucket.timestamps[0] ?? now;
    return { ok: false, remaining: 0, resetAt: oldest + windowMs };
  }

  bucket.timestamps.push(now);
  buckets.set(key, bucket);

  return {
    ok: true,
    remaining: Math.max(0, limit - bucket.timestamps.length),
    resetAt: now + windowMs,
  };
}

// ------------------------------------------------------------
// Extract client IP from request headers (handles proxies).
// Falls back to "unknown" if all missing.
// ------------------------------------------------------------
export function getClientIp(headersList: Headers): string {
  return (
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headersList.get("x-real-ip") ||
    "unknown"
  );
}
