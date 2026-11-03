import { NextResponse } from "next/server";
import { getActiveZones } from "@/lib/delivery-zones";

export const dynamic = "force-dynamic";

// ============================================================
// GET /api/delivery/zones — public list of active zones.
// ============================================================

export async function GET() {
  try {
    const zones = await getActiveZones();
    return NextResponse.json({ success: true, zones });
  } catch {
    return NextResponse.json({ success: false, message: "Server error." }, { status: 500 });
  }
}
