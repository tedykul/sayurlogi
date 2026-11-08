import { NextRequest, NextResponse } from "next/server";
import { getErpConfig } from "@/lib/integration-config";

// ============================================================
// ERPNext Image Proxy
// ============================================================
// Proxies images stored in ERPNext's /files/ or /private/files/
// folder so they can be served on the SayurLogi storefront
// (same-origin, no CORS).
//
// Reads ERPNext config (URL + API key + secret) from DB
// (IntegrationConfig table) — same source as the admin panel
// settings.
//
// Browser caches the response for 30 days (immutable).
//
// Performance: negative results (403/404/500 from ERPNext) are
// cached in-memory for 5 minutes to prevent CPU spikes when
// customer pages have broken image URLs. Without this cache,
// each page load re-fetches the failing URL → ERPNext returns
// 403 fast but the request overhead + logging fills CPU.
// ============================================================

export const dynamic = "force-dynamic";
export const revalidate = 0;

// ============================================================
// Negative cache — remember URLs that returned 4xx/5xx so we
// don't re-fetch them every request (for 5 minutes).
// ============================================================
// Key: erpUrl
// Value: { status: number, timestamp: number }
//
// On cache hit (within 5 min): return cached status immediately
// without hitting ERPNext. Saves CPU + ERPNext load.
//
// On miss: fetch from ERPNext, cache result if 4xx/5xx.
// ============================================================

interface CachedError {
  status: number;
  timestamp: number;
}

const NEGATIVE_CACHE = new Map<string, CachedError>();
const NEGATIVE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Track which URLs we've already logged about (avoid log spam)
// Reset every hour to allow re-logging (in case issue is fixed)
const LOGGED_URLS = new Set<string>();
let lastLogReset = Date.now();
const LOG_RESET_INTERVAL = 60 * 60 * 1000; // 1 hour

function shouldLog(url: string): boolean {
  const now = Date.now();
  // Reset log tracker every hour
  if (now - lastLogReset > LOG_RESET_INTERVAL) {
    LOGGED_URLS.clear();
    lastLogReset = now;
  }
  if (LOGGED_URLS.has(url)) return false;
  LOGGED_URLS.add(url);
  return true;
}

// 1x1 transparent PNG (placeholder for broken images)
// Browser displays this instead of broken image icon — cleaner UX
const PLACEHOLDER_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64"
);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;
  if (!segments || segments.length === 0) {
    return new NextResponse("Not found", { status: 404 });
  }

  const imagePath = segments.join("/");

  // Read ERPNext config from DB (admin panel config), not env
  const config = await getErpConfig();
  if (!config.url) {
    return new NextResponse(PLACEHOLDER_PNG, {
      status: 200, // return 200 with placeholder so browser doesn't retry
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=300", // 5 min
        "X-Content-Type-Options": "nosniff",
        "X-ERP-Image-Status": "not-configured",
      },
    });
  }

  const erpBaseUrl = config.url.replace(/\/$/, "");

  // ============================================================
  // Determine the correct ERPNext URL based on path.
  // ============================================================
  let erpUrl: string;

  // Reconstruct the path as ERPNext expects it
  if (segments[0] === "private" && segments[1] === "files") {
    // Private file: /private/files/xxx.jpg
    erpUrl = `${erpBaseUrl}/private/files/${segments.slice(2).join("/")}`;
  } else if (segments[0] === "files") {
    // Public file: /files/xxx.jpg
    erpUrl = `${erpBaseUrl}/files/${segments.slice(1).join("/")}`;
  } else {
    // Fallback: treat as public file directly
    erpUrl = `${erpBaseUrl}/files/${imagePath}`;
  }

  // ============================================================
  // Check negative cache first — if this URL recently failed,
  // return placeholder immediately without hitting ERPNext.
  // ============================================================
  const cached = NEGATIVE_CACHE.get(erpUrl);
  if (cached) {
    const age = Date.now() - cached.timestamp;
    if (age < NEGATIVE_CACHE_TTL_MS) {
      // Still fresh — return placeholder (200 OK, browser caches)
      return new NextResponse(PLACEHOLDER_PNG, {
        status: 200,
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=300", // 5 min browser cache
          "X-Content-Type-Options": "nosniff",
          "X-ERP-Image-Status": `cached-${cached.status}`,
        },
      });
    } else {
      // Stale — remove from cache so next request re-fetches
      NEGATIVE_CACHE.delete(erpUrl);
    }
  }

  // ============================================================
  // Fetch from ERPNext.
  // ============================================================
  try {
    const res = await fetch(erpUrl, {
      headers: {
        Authorization: `token ${config.apiKey}:${config.apiSecret}`,
        Accept: "image/*",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      // Cache negative result (4xx/5xx) to prevent re-fetching
      NEGATIVE_CACHE.set(erpUrl, { status: res.status, timestamp: Date.now() });

      // Log only once per URL per hour (avoid disk spam)
      if (shouldLog(erpUrl)) {
        console.error(
          `[erp-image] fetch failed: ${res.status} for ${erpUrl}` +
            (res.status === 403
              ? " (API key/secret mungkin tidak punya permission baca private files, atau file tidak ada)"
              : res.status === 404
                ? " (file tidak ada di ERPNext — kemungkinan sudah dihapus)"
                : "")
        );
      }

      // Return placeholder image (200 OK) so browser doesn't retry
      // aggressively. Browser caches for 5 min via Cache-Control.
      return new NextResponse(PLACEHOLDER_PNG, {
        status: 200,
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=300", // 5 min
          "X-Content-Type-Options": "nosniff",
          "X-ERP-Image-Status": `error-${res.status}`,
        },
      });
    }

    const contentType = res.headers.get("content-type") || "image/png";
    const buffer = await res.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=2592000, immutable", // 30 days
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err: any) {
    // Network error / timeout — cache negative result
    NEGATIVE_CACHE.set(erpUrl, { status: 0, timestamp: Date.now() });

    if (shouldLog(erpUrl)) {
      console.error("[erp-image] error:", err.message, "URL:", erpUrl);
    }

    return new NextResponse(PLACEHOLDER_PNG, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=300", // 5 min
        "X-Content-Type-Options": "nosniff",
        "X-ERP-Image-Status": "fetch-error",
      },
    });
  }
}
