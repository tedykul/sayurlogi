import { db } from "@/lib/db";
import { updateOrderStatus } from "@/lib/orders";

// ============================================================
// Payment helpers — mock payment gateway.
// ============================================================
// Sprint 9: mock implementation. Generates fake VA numbers + URLs.
// When upgrading to Midtrans: replace createPayment() with real
// Midtrans API call (snap.js + transaction create).
// ============================================================

export type PaymentMethod = "cod" | "transfer" | "ewallet";
export type PaymentStatus = "pending" | "paid" | "failed";

const VA_BANKS = ["BCA", "Mandiri", "BNI", "BRI"];
const EWALLET_PROVIDERS = ["GoPay", "OVO", "DANA", "ShopeePay"];

/** Generate a random 12-digit VA number (mock). */
function generateVaNumber(): string {
  let num = "8800"; // prefix
  for (let i = 0; i < 8; i++) {
    num += Math.floor(Math.random() * 10);
  }
  return num;
}

/** Generate a mock payment URL for e-wallet. */
function generatePaymentUrl(trackingId: string, provider: string): string {
  // Mock: in production, this would be Midtrans snap redirect URL
  return `https://pay.sayurbox.id/mock/${trackingId}/${provider.toLowerCase()}`;
}

export interface PaymentResult {
  success: boolean;
  paymentId: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  vaNumber?: string;
  vaBank?: string;
  paymentUrl?: string;
  ewalletProvider?: string;
  message: string;
}

/** Create a payment record for an order. Mock VA/URL generation. */
export async function createPayment(
  orderId: string,
  trackingId: string,
  method: PaymentMethod,
  amount: number
): Promise<PaymentResult> {
  // Check if payment already exists for this order
  const existing = await db.payment.findUnique({ where: { orderId } });
  if (existing && existing.status === "paid") {
    return {
      success: false,
      paymentId: existing.id,
      method: existing.method as PaymentMethod,
      status: "paid",
      amount: existing.amount,
      message: "Pesanan ini sudah dibayar.",
    };
  }

  const data: Record<string, unknown> = {
    orderId,
    trackingId,
    method,
    amount,
    status: "pending",
  };

  if (method === "transfer") {
    data.vaNumber = generateVaNumber();
    data.vaBank = VA_BANKS[Math.floor(Math.random() * VA_BANKS.length)];
  } else if (method === "ewallet") {
    const provider = EWALLET_PROVIDERS[Math.floor(Math.random() * EWALLET_PROVIDERS.length)];
    data.paymentUrl = generatePaymentUrl(trackingId, provider);
  }

  // Upsert: create or update if pending
  const payment = existing
    ? await db.payment.update({ where: { orderId }, data })
    : await db.payment.create({ data });

  const result: PaymentResult = {
    success: true,
    paymentId: payment.id,
    method,
    status: "pending",
    amount,
    message: getPaymentInstructions(method, data.vaNumber as string, data.vaBank as string, data.paymentUrl as string),
  };

  if (method === "transfer") {
    result.vaNumber = data.vaNumber as string;
    result.vaBank = data.vaBank as string;
  } else if (method === "ewallet") {
    result.paymentUrl = data.paymentUrl as string;
    result.ewalletProvider = EWALLET_PROVIDERS.find((p) =>
      (data.paymentUrl as string)?.toLowerCase().includes(p.toLowerCase())
    );
  }

  return result;
}

/** Simulate payment completion (mock only — no real money transfer). */
export async function simulatePayment(paymentId: string): Promise<{ success: boolean; message: string }> {
  const payment = await db.payment.findUnique({ where: { id: paymentId } });
  if (!payment) {
    return { success: false, message: "Payment tidak ditemukan." };
  }
  if (payment.status === "paid") {
    return { success: false, message: "Payment sudah lunas." };
  }

  // Mark as paid
  await db.payment.update({
    where: { id: paymentId },
    data: { status: "paid", paidAt: new Date() },
  });

  // Update order status to "confirmed"
  if (payment.method !== "cod") {
    await updateOrderStatus(payment.orderId, "confirmed");
  }

  return { success: true, message: "Pembayaran berhasil dikonfirmasi." };
}

/** Get payment by order ID. */
export async function getPaymentByOrderId(orderId: string) {
  const payment = await db.payment.findUnique({ where: { orderId } });
  return payment;
}

/** Get payment instructions text based on method. */
function getPaymentInstructions(
  method: PaymentMethod,
  vaNumber?: string,
  vaBank?: string,
  paymentUrl?: string
): string {
  if (method === "cod") {
    return "Pembayaran COD — bayar tunai saat pesanan tiba.";
  }
  if (method === "transfer" && vaNumber && vaBank) {
    return `Transfer ke Virtual Account ${vaBank}: ${vaNumber}. Bayar sebelum 24 jam.`;
  }
  if (method === "ewallet" && paymentUrl) {
    return `Klik link pembayaran untuk bayar via e-wallet.`;
  }
  return "Instruksi pembayaran akan diberikan.";
}
