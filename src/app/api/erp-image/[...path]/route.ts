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

  const imagePath = segments.join("/");

  // Read ERPNext config from DB (admin panel config), not env
  const config = await getErpConfig();
  if (!config.url) {
    return new NextResponse("ERPNext not configured", { status: 503 });
  }

  const erpBaseUrl = config.url.replace(/\/$/, "");

  // ============================================================
  // Determine the correct ERPNext URL based on path.
  // ============================================================
  // If the original image path in ERPNext was "/private/files/xxx",
  // the sync logic (erpnext-sync.ts) would have rewritten it to
  // "/api/erp-image/private/files/xxx".
  // So segments[0] = "private", segments[1] = "files".
  //
  // For public files: segments[0] = "files" (or just the filename
  // if sync didn't prepend "files/"). We handle both.
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
