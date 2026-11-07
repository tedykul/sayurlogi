import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import {
  getAllConfigForDisplay,
  setConfigValue,
  refreshConfig,
  getErpConfig,
  getMidtransConfig,
  getWaConfig,
  isMidtransEnabled,
  isWaEnabled,
  ERP_KEYS,
  MIDTRANS_KEYS,
  WA_KEYS,
  EMAIL_KEYS,
  isConfigured,
} from "@/lib/integration-config";
import { getEmailConfig, isEmailEnabled } from "@/lib/email-service";
import { logAdminAction } from "@/lib/audit";

// ============================================================
// Integration Config API — manage ERPNext + Midtrans + WhatsApp
// gateway + Email (SMTP) settings. All editable via admin UI
// without restart.
// ============================================================
// GET  /api/admin/integration         → all 4 configs (secrets
//                                       shown for admin editing)
// POST /api/admin/integration         → save any subset of keys
//                                       (only provided keys update;
//                                       absent keys stay)
// POST /api/admin/integration/test-connection → ERPNext ping
// POST /api/admin/integration/test-wa → WA test
// POST /api/admin/integration/test-smtp → Email test
// ============================================================

export const dynamic = "force-dynamic";

// GET — return all integration configs (ERPNext + Midtrans + WA + Email)
export async function GET() {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const config = await getAllConfigForDisplay();
    const currentErp = getErpConfig();
    const midtrans = await getMidtransConfig();
    const wa = await getWaConfig();
    const email = await getEmailConfig();

    return NextResponse.json({
      success: true,
      // ERPNext
      config: {
        erpnext_url: config[ERP_KEYS.URL]?.value || currentErp.url || "",
        erpnext_api_key: config[ERP_KEYS.API_KEY]?.value || currentErp.apiKey || "",
        erpnext_api_secret: config[ERP_KEYS.API_SECRET]?.value || currentErp.apiSecret || "",
        erpnext_site: config[ERP_KEYS.SITE]?.value || currentErp.site || "",
        erpnext_warehouse: config[ERP_KEYS.WAREHOUSE]?.value || currentErp.warehouse || "",
        erpnext_company: config[ERP_KEYS.COMPANY]?.value || currentErp.company || "",
      },
      isConfigured: isConfigured(),
      // Midtrans
      midtrans: {
        environment: midtrans.environment,
        serverKey: midtrans.serverKey,
        clientKey: midtrans.clientKey,
        enabled: midtrans.enabled,
      },
      isMidtransEnabled: await isMidtransEnabled(),
      // WhatsApp gateway
      wa: {
        provider: wa.provider,
        apiKey: wa.apiKey,
        sender: wa.sender,
        enabled: wa.enabled,
        adminPhone: wa.adminPhone,
      },
      isWaEnabled: await isWaEnabled(),
      // Email (SMTP) — password disimpan terenkripsi di IntegrationConfig,
      // tapi return plaintext ke admin untuk editing (sama seperti WA api_key
      // + Midtrans serverKey). Endpoint ini sudah protected via verifyAdmin.
      email: {
        host: email.host,
        port: email.port,
        user: email.user,
        password: email.password,
        fromName: email.fromName,
        fromEmail: email.fromEmail,
        enabled: email.enabled,
      },
      isEmailEnabled: await isEmailEnabled(),
    });
  } catch (err: any) {
    console.error("[api/admin/integration] GET error:", err);
    return NextResponse.json({ success: false, message: "Server error." }, { status: 500 });
  }
}

// POST — save config. Body may include any of ERPNext, Midtrans,
// WA, or Email keys. Only provided keys are updated; absent keys stay.
export async function POST(req: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const savePromises: Promise<void>[] = [];
    let touchedSection = "";

    // ===== ERPNext =====
    if (body.erpnext_url !== undefined) {
      savePromises.push(setConfigValue(ERP_KEYS.URL, String(body.erpnext_url)));
      touchedSection = "erpnext";
    }
    if (body.erpnext_api_key !== undefined) {
      savePromises.push(setConfigValue(ERP_KEYS.API_KEY, String(body.erpnext_api_key)));
      touchedSection = "erpnext";
    }
    if (body.erpnext_api_secret !== undefined) {
      savePromises.push(setConfigValue(ERP_KEYS.API_SECRET, String(body.erpnext_api_secret), true));
      touchedSection = "erpnext";
    }
    if (body.erpnext_site !== undefined) {
      savePromises.push(setConfigValue(ERP_KEYS.SITE, String(body.erpnext_site)));
      touchedSection = "erpnext";
    }
    if (body.erpnext_warehouse !== undefined) {
      savePromises.push(setConfigValue(ERP_KEYS.WAREHOUSE, String(body.erpnext_warehouse)));
      touchedSection = "erpnext";
    }
    if (body.erpnext_company !== undefined) {
      savePromises.push(setConfigValue(ERP_KEYS.COMPANY, String(body.erpnext_company)));
      touchedSection = "erpnext";
    }

    // ===== Midtrans =====
    if (body.midtrans_environment !== undefined) {
      const env = body.midtrans_environment === "production" ? "production" : "sandbox";
      savePromises.push(setConfigValue(MIDTRANS_KEYS.ENVIRONMENT, env));
      touchedSection = "midtrans";
    }
    if (body.midtrans_server_key !== undefined) {
      savePromises.push(setConfigValue(MIDTRANS_KEYS.SERVER_KEY, String(body.midtrans_server_key), true));
      touchedSection = "midtrans";
    }
    if (body.midtrans_client_key !== undefined) {
      savePromises.push(setConfigValue(MIDTRANS_KEYS.CLIENT_KEY, String(body.midtrans_client_key)));
      touchedSection = "midtrans";
    }
    if (body.midtrans_enabled !== undefined) {
      const enabled = body.midtrans_enabled === true || body.midtrans_enabled === "true" ? "true" : "false";
      savePromises.push(setConfigValue(MIDTRANS_KEYS.ENABLED, enabled));
      touchedSection = "midtrans";
    }

    // ===== WhatsApp =====
    if (body.wa_provider !== undefined) {
      const p = body.wa_provider === "fonnte" || body.wa_provider === "wablas" ? body.wa_provider : "mock";
      savePromises.push(setConfigValue(WA_KEYS.PROVIDER, p));
      touchedSection = "wa";
    }
    if (body.wa_api_key !== undefined) {
      savePromises.push(setConfigValue(WA_KEYS.API_KEY, String(body.wa_api_key), true));
      touchedSection = "wa";
    }
    if (body.wa_sender !== undefined) {
      savePromises.push(setConfigValue(WA_KEYS.SENDER, String(body.wa_sender)));
      touchedSection = "wa";
    }
    if (body.wa_enabled !== undefined) {
      const enabled = body.wa_enabled === true || body.wa_enabled === "true" ? "true" : "false";
      savePromises.push(setConfigValue(WA_KEYS.ENABLED, enabled));
      touchedSection = "wa";
    }
    if (body.wa_admin_phone !== undefined) {
      // Normalize: strip non-digits (phone digits only, no "+", spaces, dashes)
      const phone = String(body.wa_admin_phone).replace(/[^\d]/g, "");
      savePromises.push(setConfigValue(WA_KEYS.ADMIN_PHONE, phone));
      touchedSection = "wa";
    }

    // ===== Email (SMTP) =====
    // Password disimpan dengan isSecret=true (encrypted AES-256-CBC).
    // Note: empty string untuk password = "tidak update" (keep existing).
    // Untuk clear password, kirim null. Ini supaya admin tidak perlu
    // re-enter password setiap kali save form lain (host/port/user/dll).
    if (body.email_host !== undefined) {
      savePromises.push(setConfigValue(EMAIL_KEYS.HOST, String(body.email_host)));
      touchedSection = "email";
    }
    if (body.email_port !== undefined) {
      const port = parseInt(String(body.email_port), 10);
      savePromises.push(setConfigValue(EMAIL_KEYS.PORT, String(Number.isFinite(port) ? port : 587)));
      touchedSection = "email";
    }
    if (body.email_user !== undefined) {
      savePromises.push(setConfigValue(EMAIL_KEYS.USER, String(body.email_user)));
      touchedSection = "email";
    }
    if (body.email_password !== undefined && body.email_password !== null && body.email_password !== "") {
      // Only update password if non-empty (empty = keep existing).
      // Caller can send null to clear, but that's rare — usually
      // they want to KEEP password when editing other fields.
      savePromises.push(setConfigValue(EMAIL_KEYS.PASSWORD, String(body.email_password), true));
      touchedSection = "email";
    }
    if (body.email_from_name !== undefined) {
      savePromises.push(setConfigValue(EMAIL_KEYS.FROM_NAME, String(body.email_from_name)));
      touchedSection = "email";
    }
    if (body.email_from_email !== undefined) {
      savePromises.push(setConfigValue(EMAIL_KEYS.FROM_EMAIL, String(body.email_from_email)));
      touchedSection = "email";
    }
    if (body.email_enabled !== undefined) {
      const enabled = body.email_enabled === true || body.email_enabled === "true" ? "true" : "false";
      savePromises.push(setConfigValue(EMAIL_KEYS.ENABLED, enabled));
      touchedSection = "email";
    }

    if (savePromises.length === 0) {
      return NextResponse.json(
        { success: false, message: "Tidak ada field untuk disimpan." },
        { status: 400 }
      );
    }

    await Promise.all(savePromises);

    // Refresh ERPNext in-memory cache (Midtrans + WA + Email are read on-demand)
    if (touchedSection === "erpnext") {
      await refreshConfig();
    }

    await logAdminAction({
      action: "update",
      target: `integration:${touchedSection}`,
      success: true,
    });

    return NextResponse.json({
      success: true,
      message: `Konfigurasi ${touchedSection.toUpperCase()} berhasil disimpan.`,
      isConfigured: isConfigured(),
      isMidtransEnabled: await isMidtransEnabled(),
      isWaEnabled: await isWaEnabled(),
      isEmailEnabled: await isEmailEnabled(),
    });
  } catch (err: any) {
    console.error("[api/admin/integration] POST error:", err);
    return NextResponse.json({ success: false, message: "Server error." }, { status: 500 });
  }
}
