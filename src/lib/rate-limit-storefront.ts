// ============================================================
// Rate limiter for storefront + public API endpoints.
// ============================================================
// In-memory sliding window per IP. Suitable for single-server
// deployment (same pattern as admin rate-limit.ts).
//
// Buckets are configured per-route in middleware.ts.
// Each bucket has its own limit + window + block duration.
//
// For multi-server deployment, upgrade to Redis-backed store.
// ============================================================

interface StorefrontRateLimitEntry {
  attempts: number[]; // timestamps of recent attempts (ms)
  blockedUntil: number | null; // ms timestamp when block expires
}

// In-memory store. Key: `${bucket}:${ip}`. Resets on server restart.
const store = new Map<string, StorefrontRateLimitEntry>();

// Cleanup old entries every 10 minutes to prevent memory leak
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
let lastCleanup = Date.now();

export interface StorefrontRateLimitResult {
  blocked: boolean;
  retryAfterSeconds: number;
  remaining: number;
}

// Bucket configuration: limit per window + block duration
interface BucketConfig {
  limit: number; // max requests per window
  windowMs: number; // window duration (ms)
  blockMs: number; // block duration after limit exceeded (ms)
}

export const BUCKETS: Record<string, BucketConfig> = {
  checkout: { limit: 5, windowMs: 15 * 60 * 1000, blockMs: 15 * 60 * 1000 }, // 5 per 15min
  "admin-login": { limit: 3, windowMs: 5 * 60 * 1000, blockMs: 15 * 60 * 1000 }, // 3 per 5min
  "coupon-validate": { limit: 10, windowMs: 15 * 60 * 1000, blockMs: 15 * 60 * 1000 }, // 10 per 15min
  products: { limit: 60, windowMs: 60 * 1000, blockMs: 60 * 1000 }, // 60 per 1min
  contact: { limit: 3, windowMs: 60 * 60 * 1000, blockMs: 60 * 60 * 1000 }, // 3 per 1hour
  newsletter: { limit: 2, windowMs: 60 * 60 * 1000, blockMs: 60 * 60 * 1000 }, // 2 per 1hour
  payments: { limit: 10, windowMs: 15 * 60 * 1000, blockMs: 15 * 60 * 1000 }, // 10 per 15min
  admin: { limit: 30, windowMs: 60 * 1000, blockMs: 60 * 1000 }, // 30 per 1min
  default: { limit: 60, windowMs: 60 * 1000, blockMs: 60 * 1000 }, // 60 per 1min
};

/** Remove expired entries from memory store. */
function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, entry] of store.entries()) {
    const hasRecent = entry.attempts.some((t) => t > now - CLEANUP_INTERVAL_MS);
    if (!hasRecent && (!entry.blockedUntil || entry.blockedUntil < now)) {
      store.delete(key);
    }
  }
}

/**
 * Check rate limit for a bucket + IP. Records an attempt.
 * Returns blocked=true if IP exceeded limit.
 *
 * @param bucket Logical bucket name (must exist in BUCKETS config)
 * @param ip Client IP address
 * @returns StorefrontRateLimitResult with blocked status + retry info
 */
export function checkStorefrontRateLimit(
  bucket: string,
  ip: string
): StorefrontRateLimitResult {
  cleanup();

  const config = BUCKETS[bucket] || BUCKETS.default;
  const key = `${bucket}:${ip}`;
  const now = Date.now();

  const entry = store.get(key) || { attempts: [], blockedUntil: null };

  // Check if currently blocked
  if (entry.blockedUntil && entry.blockedUntil > now) {
    const retryAfterMs = entry.blockedUntil - now;
    return {
      blocked: true,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
      remaining: 0,
    };
  }

  // Block expired → reset
  if (entry.blockedUntil && entry.blockedUntil <= now) {
    entry.blockedUntil = null;
    entry.attempts = [];
  }

  // Filter attempts to current window
  const windowStart = now - config.windowMs;
  entry.attempts = entry.attempts.filter((t) => t > windowStart);

  // Check limit
  if (entry.attempts.length >= config.limit) {
    // Block the IP
    entry.blockedUntil = now + config.blockMs;
    store.set(key, entry);
    return {
      blocked: true,
      retryAfterSeconds: Math.ceil(config.blockMs / 1000),
      remaining: 0,
    };
  }

  // Record attempt
  entry.attempts.push(now);
  store.set(key, entry);

  return {
    blocked: false,
    retryAfterSeconds: 0,
    remaining: config.limit - entry.attempts.length,
  };
}

/**
 * Map request path to rate limit bucket.
 * Returns bucket name based on URL path.
 */
export function getBucketForPath(pathname: string): string {
  // Admin login (separate from other admin routes — brute force protection)
  if (pathname === "/api/admin/login") return "admin-login";

  // Checkout (critical — prevent spam orders)
  if (pathname === "/api/checkout") return "checkout";

  // Coupon validation (prevent brute force coupon codes)
  if (pathname === "/api/coupon/validate") return "coupon-validate";

  // Products (high traffic, but prevent scraping)
  if (pathname === "/api/products") return "products";

  // Contact form (prevent spam)
  if (pathname === "/api/contact") return "contact";

  // Newsletter (prevent spam)
  if (pathname === "/api/newsletter") return "newsletter";

  // Payment endpoints
  if (pathname.startsWith("/api/payments/")) return "payments";

  // Other admin routes
  if (pathname.startsWith("/api/admin/")) return "admin";

  // Default for all other API routes
  if (pathname.startsWith("/api/")) return "default";

  // Non-API routes (static files, pages) — no rate limit
  return "";
}
