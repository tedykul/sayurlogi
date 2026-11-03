import { NextRequest, NextResponse } from "next/server";
import { getRates } from "@/lib/biteship";

export const dynamic = "force-dynamic";

// ============================================================
// POST /api/delivery/biteship/rates — get courier rates.
// ============================================================
// Body: { originAddress, destinationAddress, items }
// Returns: { success, rates: [{courier, price, etd, label}] }
// ============================================================

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    if (!body.destinationAddress) {
      return NextResponse.json(
        { success: false, message: "Alamat tujuan diperlukan." },
        { status: 400 }
      );
    }

    const result = await getRates({
      originAddress: body.originAddress || "Makassar, Sulawesi Selatan",
      destinationAddress: body.destinationAddress,
      items: Array.isArray(body.items) ? body.items : [],
    });

    if (result.error) {
      return NextResponse.json({ success: false, message: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, rates: result.rates });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: "Server error." }, { status: 500 });
  }
}
