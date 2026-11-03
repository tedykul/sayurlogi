import type { NextConfig } from "next";

// ============================================================
// Security headers — applied to all routes.
// ============================================================
// Defense-in-depth baseline. CSP allows inline scripts/styles +
// eval (Next.js dev/runtime needs these); for strict CSP, switch
// to nonce-based per-request in middleware (future work).
//
// frame-ancestors 'none'  → clickjacking (replaces X-Frame-Options)
// object-src 'none'       → no Flash/plugins
// base-uri 'self'         → base tag injection
// form-action 'self'      → no form POST to external
// img-src https:          → allow ERPNext product images
// ============================================================

const securityHeaders = [
  // Clickjacking — DENY framing (frame-ancestors in CSP handles modern,
  // X-Frame-Options for legacy browsers)
  { key: "X-Frame-Options", value: "DENY" },
  // MIME sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Referrer leakage
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Disable browser features (camera, mic, geolocation, payment)
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=()",
  },
  // Force HTTPS (1 year, include subdomains) — only effective on HTTPS
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  },
  // Process isolation (COOP/COEP — defense against Spectre-class)
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // Don't prefetch DNS (privacy)
  { key: "X-DNS-Prefetch-Control", value: "off" },
  // Content Security Policy — baseline (Next.js-compatible)
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js needs inline scripts + eval (especially in dev)
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      // Allow images from self, data URIs, HTTPS (ERPNext + Google Maps)
      "img-src 'self' data: https: blob:",
      "font-src 'self' data:",
      // Allow fetch/XHR to self + HTTPS (ERPNext, Midtrans, Google Maps)
      "connect-src 'self' https:",
      "media-src 'self' data:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
