import { NextResponse } from "next/server";
import { getMapsSettings } from "@/lib/google-maps";

export const dynamic = "force-dynamic";

// ============================================================
// GET /api/delivery/maps-public — returns API key for client-side
// Places Autocomplete. Only returns apiKey if configured.
// ============================================================

export async function GET() {
  try {
    const settings = await getMapsSettings();
    if (!settings.configured) {
      return NextResponse.json({ success: false, apiKey: null });
    }
    return NextResponse.json({ success: true, apiKey: settings.apiKey });
  } catch {
    return NextResponse.json({ success: false, apiKey: null });
  }
}
