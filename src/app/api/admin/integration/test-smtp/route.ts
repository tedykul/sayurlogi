import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { sendTestEmail } from "@/lib/email-service";

export const dynamic = "force-dynamic";

// ============================================================
// POST /api/admin/integration/test-smtp
// ============================================================
// Send a test email to verify the configured SMTP server works.
// Body: { to } — target email address.
//
// Uses current Email config from DB (host + port + user + password
// + fromName + fromEmail). Reads fresh values from DB on each call
// (no in-memory cache) — so admin can save config + test in same
// flow without restart.
//
// Returns { success, message } — message contains either
// confirmation or SMTP error details (useful for admin debugging).
// ============================================================

export async function POST(req: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const to = typeof body.to === "string" ? body.to.trim() : "";

    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return NextResponse.json(
        { success: false, message: "Email penerima tidak valid." },
        { status: 400 }
      );
    }

    // sendTestEmail returns { success, message } — message already
    // contains user-friendly Indonesian text.
    const result = await sendTestEmail(to);
    return NextResponse.json({
      success: result.success,
      message: result.message,
    });
  } catch (err: any) {
    console.error("[api/admin/integration/test-smtp] error:", err);
    return NextResponse.json(
      { success: false, message: err.message || "Server error." },
      { status: 500 }
    );
  }
}
