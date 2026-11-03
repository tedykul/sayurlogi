import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { sendTestWa } from "@/lib/wa-notification";

export const dynamic = "force-dynamic";

// ============================================================
// POST /api/admin/integration/test-wa
// ============================================================
// Send a test WA to verify the configured provider + apiKey work.
// Body: { phone } — target phone number (08xxx / +628xxx / 628xxx).
// Uses current WA config from DB (provider + apiKey + sender).
// ============================================================

export async function POST(req: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    if (!phone) {
      return NextResponse.json(
        { success: false, message: "Nomor telepon wajib diisi." },
        { status: 400 }
      );
    }

    const result = await sendTestWa(phone);
    return NextResponse.json({
      success: result.success,
      message: result.message,
      providerResponse: result.providerResponse,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message || "Server error." },
      { status: 500 }
    );
  }
}
