import { NextRequest, NextResponse } from "next/server";
import { checkStorefrontRateLimit, getBucketForPath } from "@/lib/rate-limit-storefront";

// ============================================================
// Middleware — Rate limiting untuk storefront + public API.
// ============================================================
// Intercepts all /api/* requests. Applies IP-based rate limiting
// based on route. Returns 429 Too Many Requests if IP exceeded
// limit.
//
// Non-API routes (static files, pages) bypass middleware entirely
// (getBucketForPath returns empty string → skip).
//
// Client IP detection: uses x-forwarded-for (set by Caddy),
// fallback to x-real-ip, fallback to "unknown".
//
// In-memory store (resets on server restart). For multi-server,
// upgrade to Redis-backed store.
// ============================================================

/** Extract client IP from request headers. */
function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    // x-forwarded-for can be "client, proxy1, proxy2" — take first
    return forwarded.split(",")[0].trim();
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only rate-limit API routes (pass method so GET status-checks
  // don't consume the admin-login brute-force bucket)
  const bucket = getBucketForPath(pathname, req.method);
  if (!bucket) {
    // Non-API route — skip rate limiting
    return NextResponse.next();
  }

  // Get client IP
  const ip = getClientIp(req);

  // Check rate limit
  const result = checkStorefrontRateLimit(bucket, ip);

  if (result.blocked) {
    // Return 429 Too Many Requests
    const retryAfter = String(result.retryAfterSeconds);
    return NextResponse.json(
      {
        success: false,
        message: `Terlalu banyak permintaan. Coba lagi dalam ${result.retryAfterSeconds} detik.`,
        retryAfter: result.retryAfterSeconds,
      },
      {
        status: 429,
        headers: {
          "Retry-After": retryAfter,
          "X-RateLimit-Limit": String(result.remaining),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.floor(Date.now() / 1000) + result.retryAfterSeconds),
        },
      }
    );
  }

  // Not blocked — add rate limit headers + proceed
  const response = NextResponse.next();
  response.headers.set("X-RateLimit-Bucket", bucket);
  response.headers.set("X-RateLimit-Remaining", String(result.remaining));
  return response;
}

export const config = {
  // Only run middleware on API routes (skip static files + pages)
  matcher: ["/api/:path*"],
};
