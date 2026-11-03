import { NextResponse } from "next/server";
import { getCurrentCustomer } from "@/lib/customer-auth";

export const dynamic = "force-dynamic";

// ============================================================
// GET /api/customer/me
// ============================================================
// Returns the current customer profile (from cookie session) or
// 401 if not authenticated. Used by the storefront on mount to
// decide whether to show the login button or the customer menu.
// ============================================================

export async function GET() {
  const customer = await getCurrentCustomer();
  if (!customer) {
    return NextResponse.json(
      { success: false, authed: false },
      { status: 401 }
    );
  }
  return NextResponse.json({ success: true, authed: true, customer });
}
