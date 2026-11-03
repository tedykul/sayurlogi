import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import {
  getAllConfigForDisplay,
  setConfigValue,
  refreshConfig,
  getErpConfig,
  ERP_KEYS,
  isConfigured,
} from "@/lib/integration-config";

// ============================================================
// Integration Config API — manage ERPNext connection settings.
// All editable via admin UI without restart.
// ============================================================
// GET  /api/admin/integration         → current config (secret
//                                       decrypted for admin editing)
// POST /api/admin/integration         → save any subset of keys
//                                       (only provided keys update;
//                                       absent keys stay)
// POST /api/admin/integration/test-connection → ERPNext ping
// ============================================================

export const dynamic = "force-dynamic";

// GET — return current ERPNext config (secrets decrypted for admin).
export async function GET() {
  if (!(await verifyAdmin())) {
    return NextResponse.json(
      { success: false, message: "Unauthorized." },
      { status: 401 }
    );
  }

  try {
    const config = await getAllConfigForDisplay();
    const currentErp = getErpConfig();

    return NextResponse.json({
      success: true,
      config: {
        erpnext_url: config[ERP_KEYS.URL]?.value || currentErp.url || "",
        erpnext_api_key: config[ERP_KEYS.API_KEY]?.value || currentErp.apiKey || "",
        erpnext_api_secret:
          config[ERP_KEYS.API_SECRET]?.value || currentErp.apiSecret || "",
        erpnext_site: config[ERP_KEYS.SITE]?.value || currentErp.site || "",
        erpnext_warehouse:
          config[ERP_KEYS.WAREHOUSE]?.value || currentErp.warehouse || "",
        erpnext_company:
          config[ERP_KEYS.COMPANY]?.value || currentErp.company || "",
      },
      isConfigured: isConfigured(),
    });
  } catch (err: any) {
    console.error("[api/admin/integration] GET error:", err);
    return NextResponse.json(
      { success: false, message: "Server error." },
      { status: 500 }
    );
  }
}

// POST — save config. Body may include any ERPNext key. Only
// provided keys are updated; absent keys stay unchanged.
export async function POST(req: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json(
      { success: false, message: "Unauthorized." },
      { status: 401 }
    );
  }

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const savePromises: Promise<void>[] = [];
    let touched = false;

    // ===== ERPNext =====
    if (body.erpnext_url !== undefined) {
      savePromises.push(setConfigValue(ERP_KEYS.URL, String(body.erpnext_url)));
      touched = true;
    }
    if (body.erpnext_api_key !== undefined) {
      savePromises.push(setConfigValue(ERP_KEYS.API_KEY, String(body.erpnext_api_key)));
      touched = true;
    }
    if (body.erpnext_api_secret !== undefined) {
      savePromises.push(
        setConfigValue(ERP_KEYS.API_SECRET, String(body.erpnext_api_secret), true)
      );
      touched = true;
    }
    if (body.erpnext_site !== undefined) {
      savePromises.push(setConfigValue(ERP_KEYS.SITE, String(body.erpnext_site)));
      touched = true;
    }
    if (body.erpnext_warehouse !== undefined) {
      savePromises.push(
        setConfigValue(ERP_KEYS.WAREHOUSE, String(body.erpnext_warehouse))
      );
      touched = true;
    }
    if (body.erpnext_company !== undefined) {
      savePromises.push(
        setConfigValue(ERP_KEYS.COMPANY, String(body.erpnext_company))
      );
      touched = true;
    }

    if (!touched) {
      return NextResponse.json(
        { success: false, message: "Tidak ada field untuk disimpan." },
        { status: 400 }
      );
    }

    await Promise.all(savePromises);

    // Refresh ERPNext in-memory cache so new config takes effect.
    await refreshConfig();

    return NextResponse.json({
      success: true,
      message: "Konfigurasi ERPNext berhasil disimpan.",
      isConfigured: isConfigured(),
    });
  } catch (err: any) {
    console.error("[api/admin/integration] POST error:", err);
    return NextResponse.json(
      { success: false, message: "Server error." },
      { status: 500 }
    );
  }
}
