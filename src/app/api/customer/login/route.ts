import { NextRequest, NextResponse } from "next/server";
import { loginCustomer, attachCustomerSession } from "@/lib/customer-auth";

export const dynamic = "force-dynamic";

// ============================================================
// POST /api/customer/login
// ============================================================
// Body: { email, password, rememberMe? }
// On success: sets customer_session httpOnly cookie + returns
// customer profile.
//
// rememberMe (optional, default false):
//   - true  → session TTL 30 days (long-lived on personal device)
//   - false → session TTL 7 days (default)
//
// The cookie's maxAge is derived from session.expiresAt, so when
// rememberMe=true, the cookie also persists for 30 days. The user
// won't need to re-login until the 30-day window expires.
// ============================================================

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const result = await loginCustomer({
      email: typeof body.email === "string" ? body.email : "",
      password: typeof body.password === "string" ? body.password : "",
      rememberMe: body.rememberMe === true,
    });
    const res = NextResponse.json({ success: true, customer: result.customer });
    attachCustomerSession(res, result.token, result.expiresAt);
    return res;
  } catch (err: any) {
    const message = err.message || "Gagal login.";
    const status = /salah|wajib/i.test(message) ? 401 : 500;
    return NextResponse.json({ success: false, message }, { status });
  }
}
