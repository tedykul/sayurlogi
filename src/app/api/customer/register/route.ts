import { NextRequest, NextResponse } from "next/server";
import { registerCustomer, attachCustomerSession } from "@/lib/customer-auth";

export const dynamic = "force-dynamic";

// ============================================================
// POST /api/customer/register
// ============================================================
// Body: { name, email, phone, password, defaultAddress?, defaultCity? }
// On success: creates Customer + syncs to ERPNext Customer (best-
// effort) + sets customer_session httpOnly cookie. Returns the
// customer profile (no passwordHash).
// ============================================================

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const result = await registerCustomer({
      name: typeof body.name === "string" ? body.name : "",
      email: typeof body.email === "string" ? body.email : "",
      phone: typeof body.phone === "string" ? body.phone : "",
      password: typeof body.password === "string" ? body.password : "",
      defaultAddress: typeof body.defaultAddress === "string" ? body.defaultAddress : undefined,
      defaultCity: typeof body.defaultCity === "string" ? body.defaultCity : undefined,
    });
    const res = NextResponse.json({ success: true, customer: result.customer });
    attachCustomerSession(res, result.token, result.expiresAt);
    return res;
  } catch (err: any) {
    const message = err.message || "Gagal mendaftar.";
    const status = /sudah terdaftar|tidak valid|minimal|wajib/i.test(message) ? 400 : 500;
    return NextResponse.json({ success: false, message }, { status });
  }
}
