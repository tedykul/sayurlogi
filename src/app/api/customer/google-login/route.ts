import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { loginWithGoogle, attachCustomerSession } from "@/lib/customer-auth";

export const dynamic = "force-dynamic";

// ============================================================
// POST /api/customer/google-login
// ============================================================
// Body: { idToken: string }
// Verifies the Google ID token, creates or gets the Customer,
// sets customer_session httpOnly cookie. Returns customer profile.
//
// The Google Client ID is read from SiteSetting (configured by
// admin via dashboard > Integration tab). If not configured or
// disabled, the endpoint returns 403.
// ============================================================

export async function POST(req: NextRequest) {
  try {
    // Check if Google Auth is enabled + Client ID configured.
    const setting = await db.siteSetting.findUnique({
      where: { id: "singleton" },
      select: { googleAuthEnabled: true, googleAuthClientId: true },
    });

    if (!setting?.googleAuthEnabled || !setting?.googleAuthClientId) {
      return NextResponse.json(
        { success: false, message: "Login dengan Google belum diaktifkan." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const idToken = typeof body.idToken === "string" ? body.idToken : "";

    const result = await loginWithGoogle({
      idToken,
      clientId: setting.googleAuthClientId,
    });

    const res = NextResponse.json({
      success: true,
      customer: result.customer,
      isNewUser: result.isNewUser,
    });
    attachCustomerSession(res, result.token, result.expiresAt);
    return res;
  } catch (err: any) {
    console.error("[api/customer/google-login] error:", err);
    const message = err.message || "Gagal login dengan Google.";
    const status = /tidak valid|kedaluwarsa|belum|wajib|dinonaktifkan/i.test(message) ? 401 : 500;
    return NextResponse.json({ success: false, message }, { status });
  }
}
