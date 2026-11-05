import { db } from "@/lib/db";
import { EMAIL_KEYS, decrypt } from "@/lib/integration-config";
import nodemailer from "nodemailer";
import PDFDocument from "pdfkit";
import { formatIDR } from "@/lib/mock-data";

// ============================================================
// Email service — SMTP + invoice PDF generation.
// ============================================================
// Sends order confirmation emails with PDF invoice attached.
// Config is DB-backed (IntegrationConfig table) — editable via
// admin panel without restart.
//
// When email not configured (enabled=false or missing host),
// all functions are no-ops (return success with mock=true).
// This ensures checkout never fails due to email issues.
// ============================================================

export interface EmailConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  fromName: string;
  fromEmail: string;
  enabled: boolean;
}

export async function getEmailConfig(): Promise<EmailConfig> {
  const rows = await db.integrationConfig.findMany({
    where: { key: { startsWith: "email_" } },
  });
  const map: Record<string, string> = {};
  rows.forEach((r) => {
    map[r.key] = r.isSecret ? decrypt(r.value) : r.value;
  });
  return {
    host: map[EMAIL_KEYS.HOST] || "",
    port: parseInt(map[EMAIL_KEYS.PORT] || "587", 10),
    user: map[EMAIL_KEYS.USER] || "",
    password: map[EMAIL_KEYS.PASSWORD] || "",
    fromName: map[EMAIL_KEYS.FROM_NAME] || "SayurLogi",
    fromEmail: map[EMAIL_KEYS.FROM_EMAIL] || "",
    enabled: map[EMAIL_KEYS.ENABLED] === "true",
  };
}

export async function isEmailEnabled(): Promise<boolean> {
  const c = await getEmailConfig();
  return c.enabled && Boolean(c.host && c.user && c.password);
}

/** Create SMTP transporter (cached per-request). */
async function createTransporter(config: EmailConfig) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: {
      user: config.user,
      pass: config.password,
    },
  });
}

// ============================================================
// Invoice PDF generation.
// ============================================================
// Generates a professional invoice PDF as a Buffer.
// Uses pdfkit (no external dependencies, pure JS).
// ============================================================

export async function generateInvoicePDF(order: {
  trackingId: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string;
  customerAddress: string;
  customerCity: string | null;
  items: Array<{ product: { name: string; price: number }; quantity: number }>;
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  couponCode: string | null;
  createdAt: Date;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: "A4" });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // Header
      doc
        .fontSize(24)
        .font("Helvetica-Bold")
        .text("SayurLogi", { align: "left" })
        .fontSize(10)
        .font("Helvetica")
        .text("Sayur & Buah Segar", { align: "left" })
        .moveDown(0.5);

      // Invoice title + tracking ID
      doc
        .fontSize(16)
        .font("Helvetica-Bold")
        .text("INVOICE", { align: "right" })
        .fontSize(10)
        .font("Helvetica")
        .text(`Tracking ID: ${order.trackingId}`, { align: "right" })
        .text(`Tanggal: ${order.createdAt.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`, { align: "right" })
        .moveDown(1);

      // Divider
      doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).strokeColor("#e2e8f0").lineWidth(1).stroke();
      doc.moveDown(1);

      // Customer info
      doc
        .fontSize(10)
        .font("Helvetica-Bold")
        .text("Ditagihkan kepada:", { continued: false })
        .font("Helvetica")
        .text(`  ${order.customerName}`)
        .text(`  ${order.customerPhone}`)
        .text(`  ${order.customerAddress}`)
        .text(`  ${order.customerCity || ""}`)
        .moveDown(1);

      // Items table header
      doc
        .font("Helvetica-Bold")
        .text("Produk", 50, doc.y, { width: 250 })
        .text("Qty", 300, doc.y - 12, { width: 50, align: "center" })
        .text("Harga", 350, doc.y - 12, { width: 100, align: "right" })
        .text("Subtotal", 450, doc.y - 12, { width: 100, align: "right" })
        .moveDown(0.5);

      doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).strokeColor("#e2e8f0").lineWidth(0.5).stroke();
      doc.moveDown(0.3);

      // Items
      doc.font("Helvetica");
      for (const item of order.items) {
        const itemSubtotal = item.product.price * item.quantity;
        doc
          .fontSize(9)
          .text(item.product.name, 50, doc.y, { width: 250 })
          .text(String(item.quantity), 300, doc.y - 12, { width: 50, align: "center" })
          .text(formatIDR(item.product.price), 350, doc.y - 12, { width: 100, align: "right" })
          .text(formatIDR(itemSubtotal), 450, doc.y - 12, { width: 100, align: "right" })
          .moveDown(0.3);
      }

      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).strokeColor("#e2e8f0").lineWidth(0.5).stroke();
      doc.moveDown(0.5);

      // Summary
      doc.fontSize(10).font("Helvetica");
      doc.text("Subtotal:", 350, doc.y, { width: 100, align: "right" }).text(formatIDR(order.subtotal), 450, doc.y - 12, { width: 100, align: "right" }).moveDown(0.3);

      if (order.discount > 0) {
        doc.text("Diskan:", 350, doc.y, { width: 100, align: "right" }).text(`- ${formatIDR(order.discount)}`, 450, doc.y - 12, { width: 100, align: "right" }).moveDown(0.3);
      }

      doc.text("Ongkir:", 350, doc.y, { width: 100, align: "right" }).text(formatIDR(order.shipping), 450, doc.y - 12, { width: 100, align: "right" }).moveDown(0.5);

      // Total
      doc
        .font("Helvetica-Bold")
        .fontSize(12)
        .text("Total:", 350, doc.y, { width: 100, align: "right" })
        .text(formatIDR(order.total), 450, doc.y - 14, { width: 100, align: "right" })
        .moveDown(1);

      // Footer
      doc
        .fontSize(8)
        .font("Helvetica")
        .fillColor("#94a3b8")
        .text("Terima kasih telah berbelanja di SayurLogi!", { align: "center" })
        .text("Simpan invoice ini sebagai bukti pembelian.", { align: "center" });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// ============================================================
// Send order confirmation email with invoice PDF.
// ============================================================

export async function sendOrderConfirmationEmail(opts: {
  to: string;
  order: {
    trackingId: string;
    customerName: string;
    customerEmail: string | null;
    customerPhone: string;
    customerAddress: string;
    customerCity: string | null;
    items: Array<{ product: { name: string; price: number }; quantity: number }>;
    subtotal: number;
    shipping: number;
    discount: number;
    total: number;
    couponCode: string | null;
    createdAt: Date;
  };
}): Promise<{ success: boolean; message: string; mock?: boolean }> {
  try {
    const config = await getEmailConfig();
    if (!config.enabled) {
      return { success: true, message: "Email nonaktif. Invoice tidak dikirim.", mock: true };
    }

    // Generate PDF invoice
    const pdfBuffer = await generateInvoicePDF(opts.order);

    // Create transporter
    const transporter = await createTransporter(config);

    // Send email
    await transporter.sendMail({
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to: opts.to,
      subject: `Konfirmasi Pesanan ${opts.order.trackingId} — SayurLogi`,
      text: [
        `Halo ${opts.order.customerName},`,
        ``,
        `Pesanan Anda telah kami terima. Berikut detailnya:`,
        ``,
        `Tracking ID: ${opts.order.trackingId}`,
        `Total: ${formatIDR(opts.order.total)}`,
        ``,
        `Lacak pesanan Anda di website dengan Tracking ID di atas.`,
        ``,
        `— Tim SayurLogi`,
      ].join("\n"),
      html: [
        `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">`,
        `<h2 style="color: #16a34a;">Halo ${opts.order.customerName},</h2>`,
        `<p>Pesanan Anda telah kami terima. Berikut detailnya:</p>`,
        `<table style="width: 100%; border-collapse: collapse;">`,
        `<tr><td style="padding: 4px 0; color: #64748b;">Tracking ID</td><td style="padding: 4px 0; font-weight: bold;">${opts.order.trackingId}</td></tr>`,
        `<tr><td style="padding: 4px 0; color: #64748b;">Total</td><td style="padding: 4px 0; font-weight: bold;">${formatIDR(opts.order.total)}</td></tr>`,
        `</table>`,
        `<p style="margin-top: 16px;">Invoice lengkap terlampir dalam email ini (PDF).</p>`,
        `<p style="margin-top: 16px; color: #64748b; font-size: 12px;">— Tim SayurLogi</p>`,
        `</div>`,
      ].join(""),
      attachments: [
        {
          filename: `Invoice-${opts.order.trackingId}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });

    return { success: true, message: "Email konfirmasi + invoice terkirim." };
  } catch (err: any) {
    console.error("[email] sendOrderConfirmationEmail failed:", err.message);
    return { success: false, message: `Gagal kirim email: ${err.message}` };
  }
}

/** Send test email (for admin integration tab). */
export async function sendTestEmail(to: string): Promise<{ success: boolean; message: string }> {
  try {
    const config = await getEmailConfig();
    if (!config.enabled) {
      return { success: false, message: "Email belum dikonfigurasi atau dinonaktifkan." };
    }

    const transporter = await createTransporter(config);
    await transporter.sendMail({
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to,
      subject: "Test Email — SayurLogi",
      text: "Ini pesan test dari SayurLogi. Jika Anda menerima pesan ini, berarti konfigurasi email sudah benar ✅",
      html: '<p>Ini pesan test dari <strong>SayurLogi</strong>. Jika Anda menerima pesan ini, berarti konfigurasi email sudah benar ✅</p>',
    });

    return { success: true, message: "Test email terkirim! Cek inbox Anda." };
  } catch (err: any) {
    return { success: false, message: `Test email gagal: ${err.message}` };
  }
}
