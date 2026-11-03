import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { getErpConfig, refreshConfig } from "@/lib/integration-config";

// ============================================================
// Test Connection — ping ERPNext + verify auth token.
// ============================================================
// Returns:
//   - connected: true/false
//   - ping: "pong" if server reachable
//   - authUser: email if token valid
//   - error: message if failed
// ============================================================

export const dynamic = "force-dynamic";

export async function POST() {
  if (!(await verifyAdmin())) {
    return NextResponse.json(
      { success: false, message: "Unauthorized." },
      { status: 401 }
    );
  }

  try {
    // Refresh config from DB first (in case admin just saved)
    await refreshConfig();
    const config = getErpConfig();

    if (!config.url) {
      return NextResponse.json({
        success: false,
        connected: false,
        error: "ERPNext URL belum diatur.",
      });
    }

    // Step 1: Ping (no auth needed)
    let pingResult = "failed";
    try {
      const pingRes = await fetch(
        `${config.url.replace(/\/$/, "")}/api/method/ping`,
        { signal: AbortSignal.timeout(10000) }
      );
      if (pingRes.ok) {
        const pingData = await pingRes.json();
        pingResult = pingData.message || "ok";
      }
    } catch (err: any) {
      return NextResponse.json({
        success: false,
        connected: false,
        error: `Tidak dapat terhubung ke ${config.url}: ${err.message}`,
      });
    }

    // Step 2: Auth test (with token)
    let authUser = null;
    try {
      const authRes = await fetch(
        `${config.url.replace(/\/$/, "")}/api/method/frappe.auth.get_logged_user`,
        {
          headers: {
            Authorization: `token ${config.apiKey}:${config.apiSecret}`,
          },
          signal: AbortSignal.timeout(10000),
        }
      );
      if (authRes.ok) {
        const authData = await authRes.json();
        authUser = authData.message || null;
      } else {
        return NextResponse.json({
          success: false,
          connected: false,
          ping: pingResult,
          error: "API Key/Secret tidak valid (auth gagal).",
        });
      }
    } catch (err: any) {
      return NextResponse.json({
        success: false,
        connected: false,
        ping: pingResult,
        error: `Auth test gagal: ${err.message}`,
      });
    }

    return NextResponse.json({
      success: true,
      connected: true,
      ping: pingResult,
      authUser,
      message: `✅ Terhubung! Login sebagai: ${authUser}`,
    });
  } catch (err: any) {
    console.error("[api/admin/integration/test] error:", err);
    return NextResponse.json(
      { success: false, connected: false, error: err.message || "Server error" },
      { status: 500 }
    );
  }
}
