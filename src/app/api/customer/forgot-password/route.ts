import { NextRequest, NextResponse } from "next/server";
import { requestPasswordReset } from "@/lib/customer-auth";
import { getEmailConfig } from "@/lib/email-service";
import { sendPasswordResetEmail, isSmtpConfigured as isEnvSmtpConfigured } from "@/lib/email";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// ============================================================
// POST /api/customer/forgot-password
// ============================================================
// Body: { email: string }
//
// Behavior:
//   - Generate reset token + store hash in DB (1 hour expiry)
//   - Send reset email via SMTP:
//     - Priority 1: DB-stored config (admin dashboard > Integration)
//       via email-service.ts (encrypted password in IntegrationConfig)
//     - Priority 2: env vars (SMTP_HOST/USER/PASS) via email.ts
//       (backward compatibility)
//     - Priority 3: fallback to ContactMessage + console.log
//   - Always return success (even if email doesn't exist) to
//     prevent email enumeration attacks.
//
// Security:
//   - Rate limited at middleware
//   - Token stored as SHA-256 hash
//   - Single-use (issuing new token invalidates previous)
//   - 1-hour expiry
//   - Google-only accounts (no passwordHash) get null token
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
      const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
      const resetUrl = `${baseUrl}/?reset-password=1&token=${result.token}`;

      // ============================================================
      // Email sending — try DB-backed config first (email-service.ts),
      // then fall back to env-based config (email.ts), then fall
      // back to ContactMessage table (admin manual send).
      // ============================================================
      const dbConfig = await getEmailConfig();
      let emailSent = false;
      let emailError: string | null = null;
      let source = "none";

      // Priority 1: DB-backed config (admin dashboard > Integration)
      // Used when admin has enabled email + configured host/user/password.
      if (dbConfig.enabled && dbConfig.host && dbConfig.user && dbConfig.password) {
        source = "db";
        try {
          // Dynamically import to avoid loading nodemailer if DB
          // config is not used (small optimization).
          const { sendPasswordResetEmail: sendDbEmail } = await import("@/lib/email-service");
          const sendResult = await sendPasswordResetEmailDb({
            to: email,
            customerName: result.customerName,
            resetUrl,
            config: dbConfig,
          });
          emailSent = sendResult.success;
          emailError = sendResult.error || null;
        } catch (err: any) {
          emailError = err.message;
        }
      }

      // Priority 2: env-based config (email.ts)
      // Used as backward compatibility when DB config not set.
      if (!emailSent && isEnvSmtpConfigured()) {
        source = "env";
        const sendResult = await sendPasswordResetEmail({
          to: email,
          customerName: result.customerName,
          resetUrl,
        });
        emailSent = sendResult.success;
        emailError = sendResult.error || null;
      }

      // Priority 3: Fallback to ContactMessage table + console.log
      if (!emailSent) {
        console.log(
          `[forgot-password] Reset link for ${email} (source=${source}, ${source === "db" ? "DB SMTP FAILED" : source === "env" ? "ENV SMTP FAILED" : "no SMTP configured"}): ${resetUrl}`
        );
        if (emailError) {
          console.warn(`[forgot-password] SMTP error (source=${source}): ${emailError}`);
        }

        try {
          await db.contactMessage.create({
            data: {
              name: result.customerName || "Customer",
              email,
              phone: "-",
              message: `[PASSWORD RESET REQUEST] Reset URL: ${resetUrl}\n\nThis is an automated message — password reset was requested for this email. URL expires in 1 hour. After reset, this record can be deleted.\n\nSMTP source: ${source}${emailError ? `\nSMTP error: ${emailError}` : "\nSMTP not configured — admin must manually send this URL to the customer."}`,
            },
          });
        } catch {
          // Non-blocking — don't fail the API if ContactMessage fails
        }
      } else {
        console.log(`[forgot-password] Reset email sent to ${email} (source=${source})`);
      }
    }

    // ALWAYS return success (even if email not found / Google-only)
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

// ============================================================
// Helper: send password reset email using DB-backed SMTP config.
// Wraps nodemailer directly (instead of importing
// sendPasswordResetEmail from email.ts which uses env vars).
// ============================================================
// We don't want to add sendPasswordResetEmail to email-service.ts
// because:
//   - email-service.ts is "order confirmation" focused
//   - password reset is "auth" focused, different template
// So we inline the send logic here, reusing email-service's
// createTransporter pattern.
// ============================================================

async function sendPasswordResetEmailDb(opts: {
  to: string;
  customerName?: string | null;
  resetUrl: string;
  config: Awaited<ReturnType<typeof getEmailConfig>>;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { config } = opts;
    // Lazy import to avoid loading nodemailer when DB config unused
    const nodemailer = await import("nodemailer");

    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: { user: config.user, pass: config.password },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });

    const name = opts.customerName?.trim() || "";
    const greeting = name ? `Halo, ${name}` : "Halo";
    const fromEmail = config.fromEmail || config.user;
    const fromName = config.fromName || "SayurLogi";

    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: opts.to,
      subject: "Reset Password SayurLogi — Link Berlaku 1 Jam",
      html: `
<!DOCTYPE html>
<html lang="id"><head><meta charset="utf-8"></head><body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1f2937;">
  <div style="text-align: center; margin-bottom: 24px;">
    <h1 style="color: #16a34a; font-size: 24px; margin: 0;">🥬 SayurLogi</h1>
    <p style="color: #6b7280; font-size: 13px; margin: 4px 0 0;">Toko Online Sayur &amp; Buah Segar</p>
  </div>
  <h2 style="font-size: 20px; margin: 0 0 16px;">Reset Password Akun Anda</h2>
  <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px;">${greeting},</p>
  <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
    Kami menerima permintaan untuk reset password akun SayurLogi Anda. Klik tombol di bawah untuk menyetel password baru:
  </p>
  <div style="text-align: center; margin: 24px 0;">
    <a href="${opts.resetUrl}" style="display: inline-block; background: #16a34a; color: #ffffff !important; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 15px;">Reset Password</a>
  </div>
  <p style="font-size: 14px; line-height: 1.6; margin: 16px 0; color: #6b7280;">Atau salin link berikut dan tempel di browser:</p>
  <p style="font-size: 13px; line-height: 1.5; margin: 8px 0; padding: 12px; background: #f3f4f6; border-radius: 6px; word-break: break-all; font-family: monospace;">${opts.resetUrl}</p>
  <p style="font-size: 14px; line-height: 1.6; margin: 24px 0 0; color: #dc2626;">
    ⏰ Link ini berlaku selama <strong>1 jam</strong>.
  </p>
  <p style="font-size: 14px; line-height: 1.6; margin: 16px 0 0; color: #6b7280;">
    Jika Anda tidak meminta reset password, abaikan email ini.
  </p>
  <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 13px;">
    <p style="margin: 0 0 8px;">Salam hangat,</p>
    <p style="margin: 0; font-weight: 600; color: #16a34a;">Tim SayurLogi</p>
  </div>
</body></html>`,
      text: `SayurLogi — Reset Password\n\n${greeting},\n\nBuka link berikut untuk menyetel password baru:\n\n${opts.resetUrl}\n\nLink berlaku 1 jam. Jika tidak meminta reset, abaikan email ini.\n\n— Tim SayurLogi`,
    });

    return { success: true };
  } catch (err: any) {
    console.error("[forgot-password] DB SMTP send failed:", err.message);
    return { success: false, error: err.message };
  }
}
