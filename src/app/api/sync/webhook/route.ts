import { NextRequest, NextResponse } from "next/server";
import { syncSingleItem } from "@/lib/erpnext-sync";
import { logAdminAction } from "@/lib/audit";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// ============================================================
// POST /api/sync/webhook — ERPNext webhook receiver (OPTIMIZED).
// ============================================================
// Supports 3 doctypes:
//   1. Item → full product sync (name, desc, category, image, published)
//   2. Item Price → price update only (fast, no full re-sync)
//   3. Bin → stock update only (fast, real-time inventory)
//
// Features:
//   - Secret validation (x-webhook-secret header)
//   - Idempotency (safe to receive same webhook multiple times)
//   - Retry logic (3 attempts with exponential backoff for ERPNext API)
//   - Structured response (always returns 200 with result detail,
//     even on error — ERPNext doesn't retry on 500)
//   - Audit logging for all sync actions
//
// Setup in ERPNext: Settings → Webhooks → add 3 webhooks:
//   1. Doctype: Item, Events: after_insert, on_update, on_trash
//   2. Doctype: Item Price, Events: after_insert, on_update
//   3. Doctype: Bin, Events: after_insert, on_update
//   URL for all: https://yourdomain.com/api/sync/webhook
//   Header (optional): x-webhook-secret: <SYNC_WEBHOOK_SECRET>
// ============================================================

const WEBHOOK_SECRET = process.env.SYNC_WEBHOOK_SECRET || "";

/** Supported doctypes for sync */
const SUPPORTED_DOCTYPES = ["Item", "Item Price", "Bin"] as const;
type SupportedDoctype = (typeof SUPPORTED_DOCTYPES)[number];

/** Retry wrapper with exponential backoff */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 500
): Promise<T> {
  let lastErr: any;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        console.log(`[webhook] Retry ${attempt}/${maxRetries} after ${delay}ms: ${err.message}`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Secret validation (if configured)
    if (WEBHOOK_SECRET) {
      const secretHeader = req.headers.get("x-webhook-secret") || "";
      if (secretHeader !== WEBHOOK_SECRET) {
        console.warn("[webhook] Unauthorized: invalid secret");
        return NextResponse.json(
          { success: false, message: "Unauthorized webhook.", code: "INVALID_SECRET" },
          { status: 401 }
        );
      }
    }

    const body = await req.json();
    const doctype = (body.doctype || body.doc_type || "") as string;
    const docName = body.name || body.doc?.name || "";
    const event = body.event || "on_update";
    const docData = body.doc || body.data || {};

    // 2. Validate doctype
    if (!SUPPORTED_DOCTYPES.includes(doctype as SupportedDoctype)) {
      return NextResponse.json({
        success: true,
        message: `Ignored: doctype '${doctype}' not supported. Supported: ${SUPPORTED_DOCTYPES.join(", ")}`,
        code: "IGNORED_DOCTYPE",
        durationMs: Date.now() - startTime,
      });
    }

    if (!docName) {
      return NextResponse.json(
        { success: false, message: "Document name diperlukan.", code: "MISSING_NAME" },
        { status: 400 }
      );
    }

    // 3. Route to appropriate handler based on doctype
    let result;
    switch (doctype as SupportedDoctype) {
      case "Item":
        result = await handleItemWebhook(docName, event);
        break;
      case "Item Price":
        result = await handleItemPriceWebhook(docName, docData);
        break;
      case "Bin":
        result = await handleBinWebhook(docName, docData);
        break;
      default:
        result = { success: false, message: "Unknown doctype" };
    }

    // 4. Log to audit
    await logAdminAction({
      action: "update",
      target: `sync:webhook:${doctype}:${docName}`,
      success: result.success,
      detail: result.message?.substring(0, 500),
    });

    // 5. Always return 200 (ERPNext doesn't retry on non-200)
    return NextResponse.json({
      ...result,
      doctype,
      docName,
      event,
      durationMs: Date.now() - startTime,
    });
  } catch (err: any) {
    console.error("[webhook] Fatal error:", err);
    // Return 200 with error detail (so ERPNext doesn't keep retrying)
    return NextResponse.json({
      success: false,
      message: `Webhook error: ${err.message}`,
      code: "FATAL_ERROR",
      durationMs: Date.now() - startTime,
    });
  }
}

// ============================================================
// Handler: Item doctype (full product sync)
// ============================================================
async function handleItemWebhook(docName: string, event: string) {
  // Delete event: unpublish in DB
  if (event === "on_trash") {
    const existing = await db.product.findFirst({
      where: { OR: [{ itemCode: docName }, { itemCode: { contains: docName } }] },
    });
    if (existing) {
      await db.product.update({
        where: { id: existing.id },
        data: { published: false },
      });
      return {
        success: true,
        message: `Produk ${docName} disembunyikan (dihapus dari ERPNext).`,
      };
    }
    return { success: true, message: `Produk ${docName} tidak ditemukan di DB (sudah dihapus?).` };
  }

  // Insert/Update event: full sync with retry
  try {
    const result = await withRetry(() => syncSingleItem(docName));
    return result;
  } catch (err: any) {
    return {
      success: false,
      message: `Sync gagal setelah 3 percobaan: ${err.message}`,
    };
  }
}

// ============================================================
// Handler: Item Price doctype (price update only — FAST)
// ============================================================
async function handleItemPriceWebhook(docName: string, data: any) {
  try {
    // Item Price doctype name is like "Tomat Merah-Selling-Standard"
    // We need item_code from the data
    const itemCode = data.item_code || data.item_name;
    if (!itemCode) {
      return { success: false, message: "Item Price: item_code tidak ditemukan di data." };
    }

    // Find product in DB by itemCode
    const product = await db.product.findFirst({
      where: { OR: [{ itemCode }, { itemCode: { contains: itemCode } }] },
    });

    if (!product) {
      // Product not in DB yet — will be synced on next full sync
      return {
        success: true,
        message: `Item Price untuk ${itemCode}: produk belum di DB. Akan disinkronkan pada full sync berikutnya.`,
      };
    }

    // Get latest price from ERPNext (or use data directly)
    const rate = data.price_list_rate || data.rate;
    if (rate !== undefined) {
      await db.product.update({
        where: { id: product.id },
        data: { price: Math.round(Number(rate)) },
      });
      return {
        success: true,
        message: `Harga ${product.name} diupdate ke ${rate} dari ERPNext (Item Price webhook).`,
      };
    }

    return { success: true, message: `Item Price webhook: tidak ada perubahan harga.` };
  } catch (err: any) {
    return { success: false, message: `Item Price sync error: ${err.message}` };
  }
}

// ============================================================
// Handler: Bin doctype (stock update only — FAST, real-time)
// ============================================================
async function handleBinWebhook(docName: string, data: any) {
  try {
    // Bin doctype: item_code + warehouse + actual_qty
    const itemCode = data.item_code;
    const actualQty = data.actual_qty;
    if (!itemCode || actualQty === undefined) {
      return { success: false, message: "Bin: item_code atau actual_qty tidak ditemukan." };
    }

    const product = await db.product.findFirst({
      where: { OR: [{ itemCode }, { itemCode: { contains: itemCode } }] },
    });

    if (!product) {
      return {
        success: true,
        message: `Bin untuk ${itemCode}: produk belum di DB. Akan disinkronkan pada full sync berikutnya.`,
      };
    }

    await db.product.update({
      where: { id: product.id },
      data: { stock: Math.round(Number(actualQty)) },
    });

    return {
      success: true,
      message: `Stok ${product.name} diupdate ke ${actualQty} dari ERPNext (Bin webhook).`,
    };
  } catch (err: any) {
    return { success: false, message: `Bin sync error: ${err.message}` };
  }
}

// ============================================================
// GET: Health check with sync status summary
// ============================================================
export async function GET() {
  let productCount = 0;
  let lastSyncEntry: any = null;

  try {
    productCount = await db.product.count();
    // Get last sync audit log entry
    lastSyncEntry = await db.adminAuditLog.findFirst({
      where: { target: { contains: "sync:" } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, success: true, detail: true, target: true },
    });
  } catch {
    // DB might not be available
  }

  return NextResponse.json({
    success: true,
    message: "ERPNext sync webhook endpoint is active.",
    timestamp: new Date().toISOString(),
    supportedDoctypes: SUPPORTED_DOCTYPES,
    productCount,
    lastSync: lastSyncEntry
      ? {
          at: lastSyncEntry.createdAt.toISOString(),
          success: lastSyncEntry.success,
          target: lastSyncEntry.target,
          detail: lastSyncEntry.detail,
        }
      : null,
  });
}
