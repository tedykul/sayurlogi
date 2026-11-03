import { NextResponse } from "next/server";
import { logoutCustomer, clearCustomerSession } from "@/lib/customer-auth";

export const dynamic = "force-dynamic";

// ============================================================
// POST /api/customer/logout
// ============================================================
// Destroys the customer Session row + clears the cookie.
// ============================================================

export async function POST() {
  await logoutCustomer();
  const res = NextResponse.json({ success: true });
  clearCustomerSession(res);
  return res;
}
