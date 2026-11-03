import { NextResponse } from "next/server";
import { generateAndListSlots } from "@/lib/delivery-slots";

export const dynamic = "force-dynamic";

// ============================================================
// GET /api/delivery/slots — public list of bookable slots.
// ============================================================
// Returns empty array if scheduling disabled. Customer-facing
// checkout calls this to render the slot picker.
// ============================================================

export async function GET() {
  try {
    const slots = await generateAndListSlots();
    return NextResponse.json({ success: true, slots });
  } catch (err: any) {
    console.error("[api/delivery/slots] error:", err);
    return NextResponse.json({ success: false, message: "Server error." }, { status: 500 });
  }
}
