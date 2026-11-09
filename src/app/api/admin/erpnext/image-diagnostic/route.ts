import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { getErpConfig, refreshConfig } from "@/lib/integration-config";
import { db } from "@/lib/db";

// ============================================================
// Image Access Diagnostic — root-cause finder for the
// ERPNext private-files 403 issue.
// ============================================================
//
// WHAT IT DOES
//
// 1. Reads ERPNext config (URL + API key + secret) from DB.
// 2. Finds a real product with a private (/private/files/...)
//    image URL in our DB (or uses a URL the admin pasted in).
// 3. Reconstructs the original ERPNext URL (un-proxied).
// 4. Hits it directly with `Authorization: token key:secret`.
// 5. Captures: status, Content-Type, response body snippet.
// 6. ALSO tests whether the API key user can read the File
//    doctype at all — `GET /api/resource/File?limit=1`. This
//    is the real permission probe: Frappe's private-file
//    download handler (`/private/files/*`) calls
//    `frappe.has_permission("File", "read")`, which checks
//    the API key user's role permissions. If the user's role
//    lacks File: read, every private-file URL returns 403.
//
// WHY THIS EXISTS
//
// The erp-image proxy swallows the 403 and returns a 1×1
// placeholder PNG so the storefront doesn't break visually.
// But that hides the root cause from the admin. This
// endpoint surfaces it: admin clicks "Diagnosa Akses File
// Private" and gets a precise diagnosis + the exact ERPNext
// role/permission fix to apply.
// ============================================================

export const dynamic = "force-dynamic";

interface ProbeResult {
  url: string;
  status: number | null;
  statusText: string;
  contentType: string | null;
  bodySnippet: string;
  durationMs: number;
  error?: string;
}

export async function POST(req: Request) {
  if (!(await verifyAdmin())) {
    return NextResponse.json(
      { success: false, message: "Unauthorized." },
      { status: 401 }
    );
  }

  // Refresh config from DB (in case admin just saved)
  await refreshConfig();
  const config = getErpConfig();

  if (!config.url || !config.apiKey || !config.apiSecret) {
    return NextResponse.json({
      success: false,
      configured: false,
      message: "ERPNext belum dikonfigurasi (URL/API Key/API Secret kosong).",
    });
  }

  const erpBaseUrl = config.url.replace(/\/$/, "");
  const authHeader = `token ${config.apiKey}:${config.apiSecret}`;

  // Body: optional test image URL (must be the ORIGINAL ERPNext
  // path like "/private/files/xxx.jpg" or "/files/xxx.jpg").
  let testImagePath: string | null = null;
  try {
    const body = await req.json();
    if (typeof body?.testImagePath === "string" && body.testImagePath.trim()) {
      testImagePath = body.testImagePath.trim();
    }
  } catch {
    // no body or invalid JSON — that's fine, we auto-detect below
  }

  // If admin didn't provide a test path, find a real product
  // with a private-file image URL in our DB.
  if (!testImagePath) {
    const product = await db.product.findFirst({
      where: {
        image: { startsWith: "/api/erp-image/private/files/" },
        deletedFromErp: false,
      },
      select: { itemCode: true, name: true, image: true },
    });
    if (product?.image) {
      // Convert "/api/erp-image/private/files/xxx.jpg" → "/private/files/xxx.jpg"
      testImagePath = product.image.replace(/^\/api\/erp-image/, "");
    }
  }

  // ----------------------------------------------------------
  // Probe 1: Direct fetch of the private file URL.
  // ----------------------------------------------------------
  // This is what the storefront proxy does at runtime.
  // If this 403s, it confirms the Frappe permission check
  // is blocking the API key user from reading private files.
  // ----------------------------------------------------------
  let privateFileProbe: ProbeResult | null = null;
  if (testImagePath) {
    const directUrl = `${erpBaseUrl}${testImagePath}`;
    const t0 = Date.now();
    try {
      const res = await fetch(directUrl, {
        headers: {
          Authorization: authHeader,
          Accept: "image/*",
        },
        signal: AbortSignal.timeout(15000),
      });
      let body = "";
      try {
        body = (await res.text()).slice(0, 500);
      } catch {
        // ignore
      }
      privateFileProbe = {
        url: directUrl,
        status: res.status,
        statusText: res.statusText,
        contentType: res.headers.get("content-type"),
        bodySnippet: body.replace(/\s+/g, " ").slice(0, 300),
        durationMs: Date.now() - t0,
      };
    } catch (err: any) {
      privateFileProbe = {
        url: directUrl,
        status: null,
        statusText: "network-error",
        contentType: null,
        bodySnippet: "",
        durationMs: Date.now() - t0,
        error: err.message,
      };
    }
  }

  // ----------------------------------------------------------
  // Probe 2: File doctype read permission check.
  // ----------------------------------------------------------
  // GET /api/resource/File?limit=1 — if this succeeds, the
  // API key user has File: read permission (necessary for
  // private-file downloads). If this 403s, we've confirmed
  // the root cause: missing role permission.
  // ----------------------------------------------------------
  const permUrl = `${erpBaseUrl}/api/resource/File?fields=${encodeURIComponent(
    JSON.stringify(["name"])
  )}&limit_page_length=1`;
  const t1 = Date.now();
  let permProbe: ProbeResult;
  try {
    const res = await fetch(permUrl, {
      headers: {
        Authorization: authHeader,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(15000),
    });
    let body = "";
    try {
      body = (await res.text()).slice(0, 500);
    } catch {
      // ignore
    }
    permProbe = {
      url: permUrl,
      status: res.status,
      statusText: res.statusText,
      contentType: res.headers.get("content-type"),
      bodySnippet: body.replace(/\s+/g, " ").slice(0, 300),
      durationMs: Date.now() - t1,
    };
  } catch (err: any) {
    permProbe = {
      url: permUrl,
      status: null,
      statusText: "network-error",
      contentType: null,
      bodySnippet: "",
      durationMs: Date.now() - t1,
      error: err.message,
    };
  }

  // ----------------------------------------------------------
  // Probe 3: Auth validity (sanity check — is the token
  // itself valid? If this fails, the issue is config, not
  // permissions).
  // ----------------------------------------------------------
  const authUrl = `${erpBaseUrl}/api/method/frappe.auth.get_logged_user`;
  const t2 = Date.now();
  let authProbe: ProbeResult;
  try {
    const res = await fetch(authUrl, {
      headers: { Authorization: authHeader },
      signal: AbortSignal.timeout(10000),
    });
    let body = "";
    try {
      body = (await res.text()).slice(0, 500);
    } catch {
      // ignore
    }
    authProbe = {
      url: authUrl,
      status: res.status,
      statusText: res.statusText,
      contentType: res.headers.get("content-type"),
      bodySnippet: body.replace(/\s+/g, " ").slice(0, 300),
      durationMs: Date.now() - t2,
    };
  } catch (err: any) {
    authProbe = {
      url: authUrl,
      status: null,
      statusText: "network-error",
      contentType: null,
      bodySnippet: "",
      durationMs: Date.now() - t2,
      error: err.message,
    };
  }

  // ----------------------------------------------------------
  // Synthesize diagnosis.
  // ----------------------------------------------------------
  let diagnosis: string;
  let recommendation: string;
  let severity: "ok" | "warning" | "error";

  if (authProbe.status === 401 || authProbe.status === 403) {
    diagnosis = "auth_failed";
    severity = "error";
    recommendation =
      "API Key/Secret tidak valid. Token ditolak ERPNext (401/403) bahkan untuk endpoint auth. " +
      "Generate ulang API Key di ERPNext: User List → pilih user → API Access → Generate API Key. " +
      "Lalu simpan Key + Secret baru di form di atas.";
  } else if (permProbe.status === 403) {
    diagnosis = "permission_denied";
    severity = "error";
    recommendation =
      "ROOT CAUSE DITEMUKAN: API key user tidak punya permission 'read' pada doctype File. " +
      "Inilah yang menyebabkan semua private file (/private/files/*) return 403.\n\n" +
      "FIX (pilih salah satu di ERPNext):\n" +
      "1. User List → pilih user pemilik API key → tab Roles → centang 'File Manager'. Save.\n" +
      "   (Rekomendasi — File Manager sudah include read/write/delete untuk File doctype)\n" +
      "2. ATAU Role Permissions Manager → File → pilih role user tsb → centang 'read'.\n" +
      "3. ATAU set user tsb sebagai Administrator (full access — kurang aman untuk production).\n\n" +
      "Setelah fix, klik tombol 'Diagnosa' lagi untuk verifikasi. Tunggu 5 menit atau clear " +
      "negative cache proxy dengan restart pm2 (sayurlogi) jika perlu.";
  } else if (permProbe.status === 200 && privateFileProbe?.status === 403) {
    diagnosis = "permission_ok_but_file_403";
    severity = "warning";
    recommendation =
      "API key user punya File: read permission (probe File doctype 200 OK), tapi private file " +
      "tetap 403. Kemungkinan:\n" +
      "- File tsb private (is_private=1) dan dimiliki user lain → perlu 'File Manager' role " +
      "  untuk membaca file private milik user lain\n" +
      "- ATAU file_url tidak cocok dengan record File manapun (orphaned URL)\n\n" +
      "Solusi: tambahkan role 'File Manager' ke user pemilik API key di ERPNext.";
  } else if (privateFileProbe?.status === 404) {
    diagnosis = "file_not_found";
    severity = "warning";
    recommendation =
      "File tidak ada di ERPNext (404). Kemungkinan file sudah dihapus dari ERPNext tapi produk " +
      "masih punya reference ke URL lama. Jalankan sync ulang (admin → Produk → Sync Now) untuk " +
      "memperbarui field image dari ERPNext.";
  } else if (privateFileProbe?.status === 200) {
    diagnosis = "ok";
    severity = "ok";
    recommendation =
      "Akses private file normal (200 OK). Jika gambar masih tidak tampil di storefront, " +
      "kemungkinan di-cache sebagai negative result (5 menit). Tunggu atau restart pm2 sayurlogi " +
      "untuk clear cache.";
  } else if (privateFileProbe?.status === null) {
    diagnosis = "network_error";
    severity = "error";
    recommendation =
      "Tidak bisa menghubungi ERPNext (network error / timeout). Cek: ERPNext server berjalan, " +
      "URL benar, firewall tidak memblokir. " +
      (privateFileProbe.error ? `Error: ${privateFileProbe.error}` : "");
  } else {
    diagnosis = "unknown";
    severity = "warning";
    recommendation =
      `Status tidak dikenali: private file HTTP ${privateFileProbe?.status}, ` +
      `File doctype HTTP ${permProbe.status}. Lihat bodySnippet untuk detail. ` +
      `Konsultasikan dengan developer jika perlu.`;
  }

  return NextResponse.json({
    success: true,
    configured: true,
    erpUrl: erpBaseUrl,
    testImagePath,
    diagnosis,
    severity,
    recommendation,
    probes: {
      auth: authProbe,
      filePermission: permProbe,
      privateFile: privateFileProbe,
    },
  });
}
