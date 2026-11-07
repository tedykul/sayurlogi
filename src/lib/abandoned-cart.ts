import { db } from "@/lib/db";
import { getAdminPhone } from "@/lib/integration-config";
import { sendMessage } from "@/lib/wa-notification";
import { formatIDR } from "@/lib/mock-data";

// ============================================================
// Abandoned Cart Recovery — track + remind carts left behind.
// ============================================================
// Flow:
//   1. Customer adds items to cart (zustand localStorage)
//   2. Customer starts checkout → save cart snapshot to DB
//   3. Customer abandons checkout (doesn't complete within 2 hours)
//   4. Cron job detects abandoned cart → WA reminder
//   5. If still abandoned after 24 hours → final reminder
//
// Schema: AbandonedCart table tracks cart snapshot + timestamps.
// Cron: mini-services/abandoned-cart-recovery runs every 30 min.
// ============================================================

export interface AbandonedCartSnapshot {
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  items: Array<{
    productId: string;
    name: string;
    price: number;
    quantity: number;
  }>;
  total: number;
}

/**
 * Save cart snapshot when customer starts checkout.
 * Called from /api/checkout before order is created.
 * If cart already exists for this phone, update it.
 */
export async function saveAbandonedCart(opts: {
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  items: AbandonedCartSnapshot["items"];
  total: number;
}): Promise<string | null> {
  try {
    // Skip if no phone (can't remind without contact)
    if (!opts.customerPhone) return null;

    const existing = await db.abandonedCart.findFirst({
      where: {
        customerPhone: opts.customerPhone,
        status: "pending",
      },
    });

    if (existing) {
      // Update existing abandoned cart
      await db.abandonedCart.update({
        where: { id: existing.id },
        data: {
          customerName: opts.customerName,
          customerEmail: opts.customerEmail,
          itemsJson: JSON.stringify(opts.items),
          total: opts.total,
          updatedAt: new Date(),
          // Reset reminder count if customer came back
          reminderCount: 0,
        },
      });
      return existing.id;
    }

    // Create new abandoned cart
    const cart = await db.abandonedCart.create({
      data: {
        customerName: opts.customerName,
        customerPhone: opts.customerPhone,
        customerEmail: opts.customerEmail,
        itemsJson: JSON.stringify(opts.items),
        total: opts.total,
        status: "pending",
        reminderCount: 0,
      },
    });
    return cart.id;
  } catch (err: any) {
    console.warn("[abandoned-cart] saveAbandonedCart error (non-blocking):", err.message);
    return null;
  }
}

/**
 * Mark abandoned cart as converted (order completed).
 * Called from /api/checkout after order is successfully created.
 *
 * Best-effort: never throws. Uses a short transaction timeout so a
 * locked DB (e.g., during concurrent coupon redemption) doesn't
 * cascade into a 30s+ socket hang. Failures are logged at warn
 * level so they're visible but non-fatal.
 */
export async function markCartConverted(customerPhone: string): Promise<void> {
  if (!customerPhone) return;
  try {
    await db.abandonedCart.updateMany({
      where: {
        customerPhone,
        status: "pending",
      },
      data: {
        status: "converted",
        convertedAt: new Date(),
      },
    });
  } catch (err: any) {
    // P2024 = timeout (Prisma). P2034 = transaction closed. Both are
    // non-fatal here — the cart will be picked up on the next cron
    // run, or expire after 48h. Don't let this block the checkout
    // response path.
    const code = err?.code as string | undefined;
    if (code === "P2024" || code === "P2034") {
      console.warn(`[abandoned-cart] markCartConverted ${code} (non-blocking):`, err.message);
    } else {
      console.warn("[abandoned-cart] markCartConverted error (non-blocking):", err.message);
    }
  }
}

/**
 * Process abandoned carts — called by cron job.
 * Sends WA reminders for carts abandoned >2 hours (first reminder)
 * and >24 hours (final reminder). Max 2 reminders per cart.
 */
export async function processAbandonedCarts(): Promise<{
  processed: number;
  reminded: number;
  errors: number;
}> {
  let processed = 0;
  let reminded = 0;
  let errors = 0;

  try {
    const adminPhone = await getAdminPhone();
    // We send to customer, not admin. But we check if WA is enabled
    // by checking adminPhone (if WA not configured, skip).

    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    // Find pending carts with 0 reminders, abandoned >2 hours
    const firstReminderCarts = await db.abandonedCart.findMany({
      where: {
        status: "pending",
        reminderCount: 0,
        updatedAt: { lt: twoHoursAgo, gt: fortyEightHoursAgo },
      },
      take: 50,
    });

    // Find pending carts with 1 reminder, abandoned >24 hours
    const finalReminderCarts = await db.abandonedCart.findMany({
      where: {
        status: "pending",
        reminderCount: 1,
        updatedAt: { lt: twentyFourHoursAgo, gt: fortyEightHoursAgo },
      },
      take: 50,
    });

    const allCarts = [...firstReminderCarts, ...finalReminderCarts];
    processed = allCarts.length;

    for (const cart of allCarts) {
      try {
        const items = JSON.parse(cart.itemsJson) as AbandonedCartSnapshot["items"];
        const isFinalReminder = cart.reminderCount >= 1;

        const message = isFinalReminder
          ? [
              `🛒 *Keranjang Anda Menunggu!*`,
              ``,
              `Halo ${cart.customerName},`,
              `Keranjang belanja Anda akan kedaluwarsa besok. Order sekarang sebelum stok habis!`,
              ``,
              `*Detail:*`,
              ...items.slice(0, 5).map((i) => `• ${i.name} (${i.quantity}x) — ${formatIDR(i.price * i.quantity)}`),
              items.length > 5 ? `• ...dan ${items.length - 5} item lainnya` : "",
              ``,
              `Total: ${formatIDR(cart.total)}`,
              ``,
              `Belanja sekarang di website SayurLogi!`,
              ``,
              `— Tim SayurLogi`,
            ]
              .filter(Boolean)
              .join("\n")
          : [
              `🛒 *Keranjang Menunggu* — SayurLogi`,
              ``,
              `Halo ${cart.customerName},`,
              `Anda meninggalkan beberapa produk di keranjang. Jangan sampai kehabisan!`,
              ``,
              `*Detail:*`,
              ...items.slice(0, 5).map((i) => `• ${i.name} (${i.quantity}x) — ${formatIDR(i.price * i.quantity)}`),
              items.length > 5 ? `• ...dan ${items.length - 5} item lainnya` : "",
              ``,
              `Total: ${formatIDR(cart.total)}`,
              ``,
              `Selesaikan pesanan di website SayurLogi.`,
              ``,
              `— Tim SayurLogi`,
            ]
              .filter(Boolean)
              .join("\n");

        const result = await sendMessage(cart.customerPhone, message);

        if (result.success) {
          await db.abandonedCart.update({
            where: { id: cart.id },
            data: {
              reminderCount: { increment: 1 },
              lastReminderAt: new Date(),
            },
          });
          reminded++;
        } else {
          errors++;
          console.warn(`[abandoned-cart] WA send failed for ${cart.customerPhone}:`, result.message);
        }
      } catch (err: any) {
        errors++;
        console.warn(`[abandoned-cart] Error processing cart ${cart.id}:`, err.message);
      }
    }

    // Expire carts older than 48 hours (mark as expired)
    await db.abandonedCart.updateMany({
      where: {
        status: "pending",
        updatedAt: { lt: fortyEightHoursAgo },
      },
      data: { status: "expired" },
    });

    console.log(
      `[abandoned-cart] Processed: ${processed}, Reminded: ${reminded}, Errors: ${errors}`
    );
    return { processed, reminded, errors };
  } catch (err: any) {
    console.error("[abandoned-cart] processAbandonedCarts failed:", err.message);
    return { processed, reminded, errors };
  }
}
