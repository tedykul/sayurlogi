import nodemailer, { type Transporter } from "nodemailer";

// ============================================================
// Email — SMTP client for sending transactional emails.
// ============================================================
// Used by:
//   - /api/customer/forgot-password (password reset link)
//   - (future) order confirmation, abandoned cart, etc.
//
// Configuration via environment variables:
//   SMTP_HOST       - SMTP server hostname (e.g., smtp.gmail.com)
//   SMTP_PORT        - SMTP port (587 for TLS, 465 for SSL)
//   SMTP_USER        - SMTP username (usually email address)
//   SMTP_PASS        - SMTP password (or app-specific password)
//   SMTP_FROM_EMAIL  - "From" email address (e.g., noreply@sayurlogi.com)
//   SMTP_FROM_NAME   - "From" display name (e.g., "SayurLogi")
//
// When SMTP_HOST is not set → isSmtpConfigured() returns false.
// Callers should handle this case (e.g., forgot-password falls
// back to logging the reset URL to console + storing in DB).
//
// Why nodemailer over Resend/SendGrid/Mailgun?
//   - Universal: works with ANY SMTP server (Gmail, Mailgun,
//     SendGrid, Amazon SES, custom Postfix, etc.)
//   - No vendor lock-in: switch providers by changing env vars
//   - Battle-tested: most popular Node.js email library
//   - Supports: attachments, inline images, HTML + text fallback
//
// Production recommendations:
//   - Gmail: enable 2FA + use App Password (don't use main password)
//   - Mailgun/SendGrid: dedicated transactional email provider
//     (better deliverability, no rate limits, analytics)
//   - Amazon SES: cheapest for high volume ($0.10 per 1000 emails)
// ============================================================

let transporter: Transporter | null = null;

/**
 * Check if SMTP is configured (SMTP_HOST env var is set).
 * Use this to decide whether to attempt sending or fall back
 * to alternative behavior (e.g., logging).
 */
export function isSmtpConfigured(): boolean {
  return !!process.env.SMTP_HOST && !!process.env.SMTP_USER && !!process.env.SMTP_PASS;
}

/**
 * Get the singleton SMTP transporter. Lazy-init on first call.
 * Returns null if SMTP not configured.
 *
 * Connection pooling: nodemailer manages a pool of connections
 * internally. Re-using the same transporter across requests is
 * more efficient than creating a new one per email.
 */
function getTransporter(): Transporter | null {
  if (!isSmtpConfigured()) return null;
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST!;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER!;
  const pass = process.env.SMTP_PASS!;

  transporter = nodemailer.createTransport({
    host,
    port,
    // 465 = SSL (secure: true), 587 = STARTTLS (secure: false,
    // upgraded to TLS during connection)
    secure: port === 465,
    auth: { user, pass },
    // Timeout: 10s connect, 10s greeting — prevents hung requests
    // when SMTP server is unreachable.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });

  return transporter;
}

/**
 * Verify SMTP connection (call on server startup or health check).
 * Throws on failure. Returns true on success.
 *
 * Usage:
 *   if (isSmtpConfigured()) {
 *     await verifySmtpConnection().catch(err => console.error("SMTP:", err));
 *   }
 */
export async function verifySmtpConnection(): Promise<boolean> {
  const t = getTransporter();
  if (!t) return false;
  await t.verify();
  return true;
}

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

/**
 * Send an email via configured SMTP.
 *
 * Returns { success: true, messageId } on success.
 * Returns { success: false, error } on failure (caller should log).
 *
 * "From" address is automatically set from SMTP_FROM_EMAIL +
 * SMTP_FROM_NAME env vars. Caller doesn't need to specify it.
 *
 * Throws if SMTP not configured (caller should check
 * isSmtpConfigured() first OR catch + handle gracefully).
 */
export async function sendEmail(opts: SendEmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const t = getTransporter();
  if (!t) {
    return {
      success: false,
      error: "SMTP not configured (SMTP_HOST/SMTP_USER/SMTP_PASS env vars required)",
    };
  }

  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;
  const fromName = process.env.SMTP_FROM_NAME || "SayurLogi";
  const from = `"${fromName}" <${fromEmail}>`;

  try {
    const info = await t.sendMail({
      from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text || opts.subject, // fallback: subject as plain text
      replyTo: opts.replyTo,
    });
    return { success: true, messageId: info.messageId };
  } catch (err: any) {
    console.error("[email] sendEmail failed:", err.message);
    return { success: false, error: err.message || "Unknown SMTP error" };
  }
}

// ============================================================
// Template helpers — generate HTML for common transactional emails.
// Keep templates simple + inline-styled (email clients don't
// support external CSS or <style> reliably).
// ============================================================

const EMAIL_CONTAINER_STYLES = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  max-width: 560px;
  margin: 0 auto;
  padding: 32px 24px;
  color: #1f2937;
  background: #ffffff;
`;
const EMAIL_BUTTON_STYLES = `
  display: inline-block;
  background: #16a34a;
  color: #ffffff !important;
  text-decoration: none;
  padding: 12px 32px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 15px;
  margin: 16px 0;
`;
const EMAIL_FOOTER_STYLES = `
  margin-top: 32px;
  padding-top: 16px;
  border-top: 1px solid #e5e7eb;
  color: #6b7280;
  font-size: 13px;
  line-height: 1.5;
`;

/**
 * Send password reset email.
 *
 * Email contains:
 *   - Greeting (Hi, [Name] or Hi,)
 *   - Explanation: "You requested a password reset"
 *   - Big green button linking to reset URL
 *   - Alternative: copy-paste link (for email clients that block links)
 *   - Expiry note (1 hour)
 *   - "If you didn't request this, ignore this email" note
 *   - Footer with brand + contact
 *
 * Returns { success, messageId?, error? }.
 * Caller should fall back to logging if success=false.
 */
export async function sendPasswordResetEmail(opts: {
  to: string;
  customerName?: string | null;
  resetUrl: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const name = opts.customerName?.trim() || "";
  const greeting = name ? `Halo, ${name}` : "Halo";

  const html = `
<!DOCTYPE html>
<html lang="id">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="${EMAIL_CONTAINER_STYLES}">
  <div style="text-align: center; margin-bottom: 24px;">
    <h1 style="color: #16a34a; font-size: 24px; margin: 0;">🥬 SayurLogi</h1>
    <p style="color: #6b7280; font-size: 13px; margin: 4px 0 0;">Toko Online Sayur &amp; Buah Segar</p>
  </div>

  <h2 style="font-size: 20px; margin: 0 0 16px;">Reset Password Akun Anda</h2>

  <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
    ${greeting},
  </p>
  <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
    Kami menerima permintaan untuk reset password akun SayurLogi Anda. Klik tombol di bawah untuk menyetel password baru:
  </p>

  <div style="text-align: center; margin: 24px 0;">
    <a href="${opts.resetUrl}" style="${EMAIL_BUTTON_STYLES}">Reset Password</a>
  </div>

  <p style="font-size: 14px; line-height: 1.6; margin: 16px 0; color: #6b7280;">
    Atau salin link berikut dan tempel di browser:
  </p>
  <p style="font-size: 13px; line-height: 1.5; margin: 8px 0; padding: 12px; background: #f3f4f6; border-radius: 6px; word-break: break-all; font-family: monospace;">
    ${opts.resetUrl}
  </p>

  <p style="font-size: 14px; line-height: 1.6; margin: 24px 0 0; color: #dc2626;">
    ⏰ Link ini berlaku selama <strong>1 jam</strong>. Setelah itu, Anda perlu meminta reset password baru.
  </p>

  <p style="font-size: 14px; line-height: 1.6; margin: 16px 0 0; color: #6b7280;">
    Jika Anda tidak meminta reset password, abaikan email ini. Akun Anda tetap aman — tidak ada perubahan yang terjadi.
  </p>

  <div style="${EMAIL_FOOTER_STYLES}">
    <p style="margin: 0 0 8px;">Salam hangat,</p>
    <p style="margin: 0 0 16px; font-weight: 600; color: #16a34a;">Tim SayurLogi</p>
    <p style="margin: 0; font-size: 12px;">
      Email ini dikirim otomatis. Mohon balas ke email resmi kami jika butuh bantuan.
    </p>
  </div>
</body>
</html>
  `.trim();

  const text = `
SayurLogi — Reset Password

${greeting},

Kami menerima permintaan untuk reset password akun SayurLogi Anda. Buka link berikut untuk menyetel password baru:

${opts.resetUrl}

Link berlaku 1 jam. Jika tidak meminta reset, abaikan email ini.

— Tim SayurLogi
  `.trim();

  return sendEmail({
    to: opts.to,
    subject: "Reset Password SayurLogi — Link Berlaku 1 Jam",
    html,
    text,
  });
}
