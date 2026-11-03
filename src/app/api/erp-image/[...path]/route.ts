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
// (IntegrationConfig table) — same source as the admin panel.
//
// Browser caches the response for 30 days (immutable).
// ============================================================

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;
  if (!segments || segments.length === 0) {
    return new NextResponse("Not found", { status: 404 });
  }

  // Read ERPNext config from DB (admin panel config), not env.
  const config = await getErpConfig();
  if (!config.url) {
    return new NextResponse("ERPNext not configured", { status: 503 });
  }

  const erpBaseUrl = config.url.replace(/\/$/, "");

  // Reconstruct the path as ERPNext expects it.
  // The sync logic (erpnext-sync.ts) rewrites "/private/files/xxx"
  // → "/api/erp-image/private/files/xxx" and "/files/xxx"
  // → "/api/erp-image/files/xxx".
  let erpUrl: string;
  if (segments[0] === "private" && segments[1] === "files") {
    erpUrl = `${erpBaseUrl}/private/files/${segments.slice(2).join("/")}`;
  } else if (segments[0] === "files") {
    erpUrl = `${erpBaseUrl}/files/${segments.slice(1).join("/")}`;
  } else {
    erpUrl = `${erpBaseUrl}/files/${segments.join("/")}`;
  }

  try {
    const res = await fetch(erpUrl, {
      headers: {
        Authorization: `token ${config.apiKey}:${config.apiSecret}`,
        Accept: "image/*",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      console.error(`[erp-image] fetch failed: ${res.status} for ${erpUrl}`);
      return new NextResponse("Image not found", { status: 404 });
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
    console.error("[erp-image] error:", err.message);
    return new NextResponse("Error fetching image", { status: 500 });
  }
}
