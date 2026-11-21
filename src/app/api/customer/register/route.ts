import { NextRequest, NextResponse } from "next/server";
import { registerCustomer, attachCustomerSession } from "@/lib/customer-auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// ============================================================
// POST /api/customer/register
// ============================================================
// Body: { name, email, phone, password, defaultAddress?, defaultCity? }
// On success: creates Customer + syncs to ERPNext Customer (best-
// effort) + sets customer_session httpOnly cookie. Returns the
// customer profile (no passwordHash).
//
// Phase 3: if admin enabled serviceAreaRestricted, validates that
// defaultCity is in the allowed list (serviceAreaCities). Rejects
// with 400 if city not allowed.
// ============================================================

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    // Phase 3: check service area restriction before processing
    const setting = await db.siteSetting.findUnique({ where: { id: "singleton" } });
    if (setting?.serviceAreaRestricted) {
      const allowedCities = (setting.serviceAreaCities || "Makassar")
        .split(",")
        .map((c) => c.trim().toLowerCase())
        .filter(Boolean);
      const inputCity = (body.defaultCity || "").toString().trim().toLowerCase();
      if (!inputCity) {
        return NextResponse.json(
          { success: false, message: "Kota wajib dipilih." },
          { status: 400 }
        );
      }
      if (allowedCities.length > 0 && !allowedCities.includes(inputCity)) {
        // Phase 1: return structured response with city list for UI formatting.
        // Frontend can bold the city name + show as warning (not error).
        const cityList = (setting.serviceAreaCities || "Makassar")
          .split(",")
          .map((c) => c.trim())
          .join(", ");
        return NextResponse.json(
          {
            success: false,
            message: `Mohon maaf, saat ini kami baru melayani area: ${cityList}.`,
            code: "SERVICE_AREA_RESTRICTED",
            allowedCities: cityList,
          },
          { status: 400 }
        );
      }
    }

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
    const status = /sudah terdaftar|tidak valid|minimal|wajib|melayani/i.test(message) ? 400 : 500;
    return NextResponse.json({ success: false, message }, { status });
  }
}
