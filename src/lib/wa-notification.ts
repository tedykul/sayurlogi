import { getWaConfig } from "@/lib/integration-config";
import { db } from "@/lib/db";

// ============================================================
// WhatsApp notification — provider abstraction (Fonnte/Wablas/mock).
// ============================================================
// When WA enabled + provider != mock + apiKey set, sends real WA
// on order events. When disabled or mock, logs to console (dev).
//
// Providers:
//   fonnte → POST https://api.fonnte.com/send-message
//            headers: { Authorization: token }
//            body:    { target, message, device (optional) }
//   wablas → POST https://console.wablas.com/api/send-message
//            headers: { Authorization: token }
//            body:    { phone, message, sender (optional) }
//   mock   → console.log (no real send)
//
// Phone format: 628xxx (Indonesia, no leading 0, no +).
// ============================================================

export interface SendMessageResult {
  success: boolean;
  message: string;
  providerResponse?: unknown;
}

// ============================================================
// normalizePhone — convert 08xxx / +628xxx / 628xxx to 628xxx.
// ============================================================

export function normalizePhone(phone: string): string {
  let p = phone.trim().replace(/[\s\-()]/g, "");
  if (p.startsWith("+")) p = p.slice(1);
  if (p.startsWith("0")) p = "62" + p.slice(1);
  if (!p.startsWith("62")) p = "62" + p;
  return p;
}

// ============================================================
// sendMessage — send a single WA message to a phone number.
// ============================================================
// Returns { success, message, providerResponse? }. Logs to console
// on mock provider. Best-effort: caller should not block on this.
// ============================================================

export async function sendMessage(
  phone: string,
  message: string
): Promise<SendMessageResult> {
  const config = await getWaConfig();
  const target = normalizePhone(phone);

  if (!target) {
    return { success: false, message: "Nomor telepon tidak valid." };
  }

  // Mock mode — log only, no real send
  if (config.provider === "mock" || !config.enabled) {
    console.log(`[wa-mock] To: ${target}\n${message}\n---`);
    return { success: true, message: "Mock send (logged to console)." };
  }

  if (!config.apiKey) {
    return { success: false, message: "WA API key belum dikonfigurasi." };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    let res: Response;
    if (config.provider === "fonnte") {
      res = await fetch("https://api.fonnte.com/send-message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: config.apiKey,
        },
        body: JSON.stringify({
          target,
          message,
          ...(config.sender ? { device: config.sender } : {}),
        }),
        signal: controller.signal,
      });
    } else {
      // wablas
      res = await fetch("https://console.wablas.com/api/send-message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: config.apiKey,
        },
        body: JSON.stringify({
          phone: target,
          message,
          ...(config.sender ? { sender: config.sender } : {}),
        }),
        signal: controller.signal,
      });
    }
    clearTimeout(timeout);

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("[wa] send failed:", res.status, data);
      return {
        success: false,
        message: `Provider error: ${res.status}`,
        providerResponse: data,
      };
    }

    return {
      success: true,
      message: "WA terkirim.",
      providerResponse: data,
    };
  } catch (err: any) {
    console.error("[wa] sendMessage error:", err.message);
    return { success: false, message: err.message || "Koneksi gagal." };
  }
}

// ============================================================
// Order event notification templates.
// ============================================================
// Each template returns a ready-to-send message string. Indonesian,
// friendly tone, includes tracking ID + key info.
// ============================================================

export function formatOrderCreatedMessage(opts: {
  customerName: string;
  trackingId: string;
  total: number;
  paymentMethod: string;
  estimatedDelivery?: string | null;
}): string {
  const paymentLabel =
    opts.paymentMethod === "cod"
      ? "Bayar di tempat (COD)"
      : opts.paymentMethod === "transfer"
      ? "Transfer Bank"
      : opts.paymentMethod === "ewallet"
      ? "E-Wallet"
      : opts.paymentMethod;
  return [
    `🌿 *SayurLogi — Pesanan Diterima!*`,
    ``,
    `Halo ${opts.customerName},`,
    `Pesanan Anda sudah kami terima. Terima kasih sudah belanja!`,
    ``,
    `*Detail Pesanan:*`,
    `Tracking ID: ${opts.trackingId}`,
    `Total: Rp ${opts.total.toLocaleString("id-ID")}`,
    `Pembayaran: ${paymentLabel}`,
    opts.estimatedDelivery
      ? `Estimasi tiba: ${new Date(opts.estimatedDelivery).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} WIB`
      : "",
    ``,
    `Lacak pesanan Anda di website. Simpan Tracking ID di atas.`,
    ``,
    `— Tim SayurLogi`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatOrderStatusMessage(opts: {
  customerName: string;
  trackingId: string;
  status: string;
  total: number;
}): string {
  const statusLabels: Record<string, string> = {
    confirmed: "✅ Pesanan Dikonfirmasi",
    preparing: "📦 Pesanan Disiapkan",
    out_for_delivery: "🚚 Pesanan Dikirim",
    delivered: "🎉 Pesanan Selesai",
    cancelled: "❌ Pesanan Dibatalkan",
  };
  const label = statusLabels[opts.status] || `Status: ${opts.status}`;

  const extra: Record<string, string> = {
    confirmed: "Pesanan Anda sudah kami konfirmasi dan sedang disiapkan.",
    preparing: "Tim kami sedang menyiapkan pesanan Anda dengan penuh kasih sayang 🌱",
    out_for_delivery: "Pesanan Anda sedang dalam perjalanan ke alamat Anda. Pastikan HP aktif ya!",
    delivered: "Pesanan telah sampai. Terima kasih sudah mempercayai SayurLogi! Jangan lupa review ya 😊",
    cancelled: "Pesanan dibatalkan. Untuk bantuan, hubungi customer service kami.",
  };

  return [
    `🌿 *SayurLogi*`,
    ``,
    `Halo ${opts.customerName},`,
    extra[opts.status] || "",
    ``,
    `*${label}*`,
    `Tracking ID: ${opts.trackingId}`,
    ``,
    `— Tim SayurLogi`,
  ]
    .filter(Boolean)
    .join("\n");
}

// ============================================================
// notifyOrderEvent — high-level: send WA on order status change.
// ============================================================
// Looks up order by id, formats message, sends WA. Best-effort:
// catches all errors, logs, never throws (caller not blocked).
// Used by checkout (order created) + admin (status update).
// ============================================================

export async function notifyOrderCreated(orderId: string): Promise<void> {
  try {
    const config = await getWaConfig();
    if (!config.enabled) return;
    // Note: mock provider still logs (dev). Real providers (fonnte/
    // wablas) send. isWaEnabled() returns false for mock, but we
    // want mock to log so devs can verify templates.

    const order = await db.order.findUnique({
      where: { id: orderId },
      select: { customerName: true, customerPhone: true, trackingId: true, total: true, paymentMethod: true, estimatedDelivery: true },
    });
    if (!order || !order.customerPhone) return;

    const message = formatOrderCreatedMessage({
      customerName: order.customerName,
      trackingId: order.trackingId,
      total: order.total,
      paymentMethod: order.paymentMethod,
      estimatedDelivery: order.estimatedDelivery,
    });

    const result = await sendMessage(order.customerPhone, message);
    if (!result.success) {
      console.warn(`[wa] notifyOrderCreated failed for ${order.trackingId}:`, result.message);
    }
  } catch (err: any) {
    console.warn("[wa] notifyOrderCreated error (non-blocking):", err.message);
  }
}

export async function notifyOrderStatusChanged(
  orderId: string,
  newStatus: string
): Promise<void> {
  try {
    const config = await getWaConfig();
    if (!config.enabled) return;

    const order = await db.order.findUnique({
      where: { id: orderId },
      select: { customerName: true, customerPhone: true, trackingId: true, total: true },
    });
    if (!order || !order.customerPhone) return;

    const message = formatOrderStatusMessage({
      customerName: order.customerName,
      trackingId: order.trackingId,
      status: newStatus,
      total: order.total,
    });

    const result = await sendMessage(order.customerPhone, message);
    if (!result.success) {
      console.warn(`[wa] notifyOrderStatusChanged failed for ${order.trackingId}:`, result.message);
    }
  } catch (err: any) {
    console.warn("[wa] notifyOrderStatusChanged error (non-blocking):", err.message);
  }
}

// ============================================================
// Test endpoint helper — send a test WA to verify config.
// ============================================================

export async function sendTestWa(phone: string): Promise<SendMessageResult> {
  const message = [
    `🌿 *SayurLogi — Test Notifikasi*`,
    ``,
    `Ini pesan test dari SayurLogi. Jika Anda menerima pesan ini, berarti konfigurasi WhatsApp sudah benar ✅`,
    ``,
    `— Tim SayurLogi`,
  ].join("\n");
  return sendMessage(phone, message);
}
