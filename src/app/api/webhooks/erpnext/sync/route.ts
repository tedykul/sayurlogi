import { NextRequest, NextResponse } from "next/server";
import { syncAllFromErpnext } from "@/lib/erpnext-sync";

// ============================================================
// ERPNext Webhook Handler — auto-sync on Item changes
// ============================================================
// ERPNext triggers this endpoint when an Item is created, updated,
// or deleted. We respond immediately (200 OK) and run the sync in
// the background so the webhook doesn't time out.
//
// Security: optionally validate a shared secret header
// (X-Sayurlogi-Webhook-Secret) if WEBHOOK_SECRET env is set.
// If env not set, we trust the request (fine for internal network
// where ERPNext is the only caller).
// ============================================================

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  // Optional: validate secret header
  const expectedSecret = process.env.WEBHOOK_SECRET;
  if (expectedSecret) {
    const providedSecret = req.headers.get("x-sayurlogi-webhook-secret");
    if (providedSecret !== expectedSecret) {
      return NextResponse.json(
        { success: false, message: "Invalid webhook secret" },
        { status: 401 }
      );
    }
  }

  // Respond immediately so ERPNext doesn't time out
  // Run sync in background (fire-and-forget)
  syncAllFromErpnext()
    .then((result) => {
      console.log(
        `[webhook] ERPNext sync triggered: ${result.synced}/${result.total} products`
      );
    })
    .catch((err) => {
      console.error("[webhook] ERPNext sync failed:", err);
    });

  return NextResponse.json({
    success: true,
    message: "Sync triggered in background",
  });
}

// GET endpoint for testing
export async function GET() {
  return NextResponse.json({
    success: true,
    message: "ERPNext webhook endpoint. Send POST to trigger sync.",
  });
}
