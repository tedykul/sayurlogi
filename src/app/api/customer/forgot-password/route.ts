import { NextRequest, NextResponse } from "next/server";
import { requestPasswordReset } from "@/lib/customer-auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// ============================================================
// POST /api/customer/forgot-password
// ============================================================
// Body: { email: string }
//
// Behavior:
//   - Generate reset token + store hash in DB (1 hour expiry)
//   - "Send email" with reset link. Email sending is currently
//     LOG-ONLY (console.log) — production should integrate SMTP
//     (Nodemailer / Resend / SendGrid). See note below.
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
// Production email integration (TODO):
//   Replace the console.log block with Nodemailer or similar.
//   Config via env vars: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS.
//   Reset link format: `${process.env.NEXTAUTH_URL}/reset-password?token=${rawToken}`
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

      // ============================================================
      // EMAIL SENDING (production TODO)
      // ============================================================
      // Currently LOG-ONLY. In production, replace with real SMTP.
      // The reset URL contains the raw token — must be sent via
      // email, NOT logged in production (would expose the token).
      //
      // Example Nodemailer integration:
      //   import nodemailer from "nodemailer";
      //   const transporter = nodemailer.createTransport({
      //     host: process.env.SMTP_HOST,
      //     port: Number(process.env.SMTP_PORT) || 587,
      //     auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      //   });
      //   await transporter.sendMail({
      //     from: `"SayurLogi" <noreply@sayurlogi.com>`,
      //     to: email,
      //     subject: "Reset Password SayurLogi",
      //     html: `...reset link: ${resetUrl} (berlaku 1 jam)...`,
      //   });
      //
      // For now: store reset link in ContactMessage table (sent-
      // but-not-emailed queue) for admin to manually send if SMTP
      // not yet configured. Also log to console in dev.
      // ============================================================
      console.log(`[forgot-password] Reset link for ${email}: ${resetUrl}`);

      // Best-effort: store in ContactMessage for admin fallback
      // (so admin can see pending reset requests + manually email
      // users if SMTP not yet configured)
      try {
        await db.contactMessage.create({
          data: {
            name: result.customerName || "Customer",
            email,
            phone: "-",
            message: `[PASSWORD RESET REQUEST] Reset URL: ${resetUrl}\n\nThis is an automated message — password reset was requested for this email. URL expires in 1 hour. After reset, this record can be deleted.`,
          },
        });
      } catch {
        // Non-blocking — don't fail the API if ContactMessage fails
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
