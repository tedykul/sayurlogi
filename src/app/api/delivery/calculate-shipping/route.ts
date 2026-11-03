import { NextRequest, NextResponse } from "next/server";
import { calculateGojekShipping, getMapsSettings, geocodeAddress } from "@/lib/google-maps";

export const dynamic = "force-dynamic";

// ============================================================
// POST /api/delivery/calculate-shipping
// ============================================================
// Body: { address: string } OR { lat: number, lng: number }
// ============================================================

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const settings = await getMapsSettings();

    if (!settings.configured) {
      return NextResponse.json(
        { success: false, message: `Google Maps belum dikonfigurasi. apiKey=${settings.apiKey ? "ada" : "kosong"} lat=${settings.storeLat} lng=${settings.storeLng}` },
        { status: 503 }
      );
    }

    let lat: number;
    let lng: number;

    // If lat/lng provided directly, use them
    if (typeof body.lat === "number" && typeof body.lng === "number") {
      lat = body.lat;
      lng = body.lng;
    } else if (typeof body.address === "string" && body.address.trim()) {
      // Geocode address server-side
      const geoResult = await geocodeAddress(body.address.trim(), settings.apiKey);

      if (geoResult.error) {
        return NextResponse.json(
          { success: false, message: `Geocoding: ${geoResult.error}` },
          { status: 400 }
        );
      }

      lat = geoResult.lat;
      lng = geoResult.lng;
    } else {
      return NextResponse.json(
        { success: false, message: "Alamat atau koordinat diperlukan." },
        { status: 400 }
      );
    }

    // Calculate distance + fee
    const result = await calculateGojekShipping(lat, lng);

    if (result.error) {
      return NextResponse.json({ success: false, message: `Distance: ${result.error}` }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      fee: result.fee,
      distanceKm: result.distanceKm,
      durationMin: result.durationMin,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: `Server error: ${err.message}` }, { status: 500 });
  }
}
