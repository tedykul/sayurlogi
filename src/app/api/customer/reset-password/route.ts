import { NextRequest, NextResponse } from "next/server";
import { resetPasswordWithToken, isValidResetToken } from "@/lib/customer-auth";
import { createSession } from "@/lib/session";
import { attachCustomerSession } from "@/lib/customer-auth";

export const dynamic = "force-dynamic";

// ============================================================
// POST /api/customer/reset-password
// ============================================================
// Body: { token: string, newPassword: string }
//
// Behavior:
//   - Verify token (must exist in DB + not expired)
//   - Update passwordHash with new password
//   - Clear token (single-use)
//   - Invalidate all existing sessions (force re-login everywhere)
//   - Create new session + set cookie (auto-login after reset)
//   - Return customer profile
//
// GET-style verification is also supported via GET method below
// (used by reset-password page to check link validity BEFORE
// showing the form).
// ============================================================

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = typeof body.token === "string" ? body.token.trim() : "";
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Token reset wajib diisi." },
        { status: 400 }
      );
    }

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { success: false, message: "Password baru minimal 6 karakter." },
        { status: 400 }
      );
    }

    // Maximum password length (prevent DoS via huge bcrypt input)
    if (newPassword.length > 256) {
      return NextResponse.json(
        { success: false, message: "Password terlalu panjang (maks 256 karakter)." },
        { status: 400 }
      );
    }

    const { customer } = await resetPasswordWithToken({ token, newPassword });

    // Auto-login: create new session after password reset
    // (better UX than forcing user to login again with new password)
    const { token: sessionToken, expiresAt } = await createSession({
      customerId: customer.id,
      email: customer.email,
      role: "customer",
      method: "customer",
    });

    const res = NextResponse.json({
      success: true,
      message: "Password berhasil diubah. Anda otomatis login.",
      customer,
    });
    attachCustomerSession(res, sessionToken, expiresAt);
    return res;
  } catch (err: any) {
    console.error("[api/customer/reset-password] error:", err);
    const message = err.message || "Gagal reset password.";
    const status = /tidak valid|kedaluwarsa|minimal|min/.test(message) ? 400 : 500;
    return NextResponse.json({ success: false, message }, { status });
  }
}

// ============================================================
// GET /api/customer/reset-password?token=...
// ============================================================
// Verify if a token is still valid (not expired, exists in DB).
// Used by frontend to decide whether to show the "new password"
// form OR the "token expired" message.
//
// Returns: { success: true, valid: boolean }
// Never throws — always 200 with valid flag.
// ============================================================

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token") || "";
    const valid = await isValidResetToken(token);
    return NextResponse.json({ success: true, valid });
  } catch (err: any) {
    console.error("[api/customer/reset-password] GET error:", err);
    return NextResponse.json({ success: true, valid: false });
  }
}
