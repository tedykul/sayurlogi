import { NextRequest, NextResponse } from "next/server";
import { verifyCustomerAuth, updateCustomerProfile } from "@/lib/customer-auth";

export const dynamic = "force-dynamic";

// ============================================================
// PUT /api/customer/profile
// ============================================================
// Update the logged-in customer's profile (name, phone, default
// address/city/notes). Requires customer session.
// ============================================================

export async function PUT(req: NextRequest) {
  const auth = await verifyCustomerAuth();
  if (!auth) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const updated = await updateCustomerProfile(auth.customerId, {
      name: typeof body.name === "string" ? body.name : undefined,
      phone: typeof body.phone === "string" ? body.phone : undefined,
      defaultAddress:
        body.defaultAddress === null || typeof body.defaultAddress === "string"
          ? body.defaultAddress
          : undefined,
      defaultCity:
        body.defaultCity === null || typeof body.defaultCity === "string"
          ? body.defaultCity
          : undefined,
      defaultNotes:
        body.defaultNotes === null || typeof body.defaultNotes === "string"
          ? body.defaultNotes
          : undefined,
    });
    return NextResponse.json({ success: true, customer: updated });
  } catch (err: any) {
    const message = err.message || "Gagal update profile.";
    const status = /sudah dipakai|tidak valid/i.test(message) ? 400 : 500;
    return NextResponse.json({ success: false, message }, { status });
  }
}
