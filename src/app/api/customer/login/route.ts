import { NextRequest, NextResponse } from "next/server";
import { loginCustomer, attachCustomerSession } from "@/lib/customer-auth";

export const dynamic = "force-dynamic";

// ============================================================
// POST /api/customer/login
// ============================================================
// Body: { email, password }
// On success: sets customer_session httpOnly cookie + returns
// customer profile.
// ============================================================

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const result = await loginCustomer({
      email: typeof body.email === "string" ? body.email : "",
      password: typeof body.password === "string" ? body.password : "",
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
