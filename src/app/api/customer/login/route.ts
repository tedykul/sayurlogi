import { NextRequest, NextResponse } from "next/server";
import { loginCustomer, attachCustomerSession } from "@/lib/customer-auth";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// ============================================================
// POST /api/customer/login
// ============================================================
// Body: { email, password, rememberMe? }
// Rate limited: 10 attempts per 15 min (prevent brute-force).
// ============================================================

export async function POST(req: NextRequest) {
  // Rate limit: customer login (10/15min) — prevents password brute-force
  const rateLimit = await checkRateLimit("customer-login");
  if (rateLimit.blocked) {
    return NextResponse.json(
      {
        success: false,
        message: "Terlalu banyak percobaan login. Coba lagi nanti.",
        retryAfter: rateLimit.retryAfterSeconds,
      },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      }
    );
  }
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
