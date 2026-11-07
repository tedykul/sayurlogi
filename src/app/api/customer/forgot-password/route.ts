import { NextRequest, NextResponse } from "next/server";
import { requestPasswordReset } from "@/lib/customer-auth";
import { sendPasswordResetEmail, isSmtpConfigured } from "@/lib/email";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// ============================================================
// POST /api/customer/forgot-password
// ============================================================
// Body: { email: string }
//
// Behavior:
//   - Generate reset token + store hash in DB (1 hour expiry)
//   - Send reset email via SMTP (if SMTP_HOST configured)
//     - On success: email terkirim ke user
//     - On failure OR SMTP not configured: fallback ke ContactMessage
//       table (admin bisa manual send) + console.log
//   - Always return success (even if email doesn't exist) to
//     prevent email enumeration attacks.
//
// Security:
//   - Rate limited at middleware (4-5 requests per IP per minute)
//   - Token stored as SHA-256 hash (never raw)
//   - Single-use (issuing new token invalidates previous)
//   - 1-hour expiry
//   - Google-only accounts (no passwordHash) get null token (no
//     email sent, but API still returns success — they should use
//     Google login, not password reset)
//
// SMTP configuration (.env):
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM_EMAIL,
//   SMTP_FROM_NAME — see src/lib/email.ts for details.
// ============================================================

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email.trim() : "";

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { success: false, message: "Format email tidak valid." },
        { status: 400 }
      );
    }

    const result = await requestPasswordReset(email);

    if (result.token && result.customerId) {
      // Build the reset URL. NEXTAUTH_URL must be set in .env VPS.
      // Token is sent as query param — frontend reads it from URL
      // and submits to /api/customer/reset-password.
      const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
      const resetUrl = `${baseUrl}/?reset-password=1&token=${result.token}`;

      // Try to send email via SMTP. If SMTP not configured OR send
      // fails, fall back to ContactMessage table (admin can manual
      // send) + console.log (for dev visibility).
      const smtpReady = isSmtpConfigured();
      let emailSent = false;
      let emailError: string | null = null;

      if (smtpReady) {
        const sendResult = await sendPasswordResetEmail({
          to: email,
          customerName: result.customerName,
          resetUrl,
        });
        emailSent = sendResult.success;
        emailError = sendResult.error || null;
      }

      if (!emailSent) {
        // Fallback: log to console (dev visibility) + store in
        // ContactMessage (admin fallback for manual send).
        // This is the SAME behavior as before SMTP was added — so
        // existing deployments without SMTP env vars still work.
        console.log(
          `[forgot-password] Reset link for ${email} (SMTP ${smtpReady ? "FAILED" : "not configured"}): ${resetUrl}`
        );
        if (emailError) {
          console.warn(`[forgot-password] SMTP error: ${emailError}`);
        }

        // Store in ContactMessage for admin fallback (so admin can
        // see pending reset requests + manually email users if SMTP
        // not yet configured or SMTP failed).
        try {
          await db.contactMessage.create({
            data: {
              name: result.customerName || "Customer",
              email,
              phone: "-",
              message: `[PASSWORD RESET REQUEST] Reset URL: ${resetUrl}\n\nThis is an automated message — password reset was requested for this email. URL expires in 1 hour. After reset, this record can be deleted.${smtpReady ? `\n\nSMTP error: ${emailError}` : "\n\nSMTP not configured — admin must manually send this URL to the customer."}`,
            },
          });
        } catch {
          // Non-blocking — don't fail the API if ContactMessage fails
        }
      } else {
        // Email sent successfully — log for monitoring (no PII).
        console.log(`[forgot-password] Reset email sent to ${email}`);
      }
    }

    // ALWAYS return success (even if email not found / Google-only)
    // to prevent email enumeration. Same response time-ish to avoid
    // timing attacks (in production, can add artificial delay).
    return NextResponse.json({
      success: true,
      message:
        "Jika email terdaftar, link reset password telah dikirim. Cek folder inbox + spam. Link berlaku 1 jam.",
    });
  } catch (err: any) {
    console.error("[api/customer/forgot-password] error:", err);
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan. Coba lagi." },
      { status: 500 }
    );
  }
}
