import { NextRequest, NextResponse } from "next/server";
import { createSharedWishlist, type SharedWishlistItem } from "@/lib/shared-wishlist";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// ============================================================
// POST /api/wishlist/share
// ============================================================
// Public endpoint (no auth — wishlist is localStorage-based).
// Rate limited: 10 per 15 min (prevent DB spam).
// ============================================================

export async function POST(req: NextRequest) {
  // Rate limit: prevent spamming SharedWishlist table
  const rateLimit = await checkRateLimit("wishlist-share");
  if (rateLimit.blocked) {
    return NextResponse.json(
      {
        success: false,
        message: "Terlalu banyak permintaan. Coba lagi nanti.",
        retryAfter: rateLimit.retryAfterSeconds,
      },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      }
    );
  }
  try {
    const body = await req.json().catch(() => ({}));
    const rawItems = Array.isArray(body.items) ? body.items : [];
    const title = typeof body.title === "string" ? body.title : undefined;

    // Validate + sanitize items.
    const items: SharedWishlistItem[] = [];
    for (const raw of rawItems.slice(0, 50)) {
      if (typeof raw !== "object" || raw === null) continue;
      const item = raw as Record<string, unknown>;
      const id = typeof item.id === "string" ? item.id : "";
      const name = typeof item.name === "string" ? item.name : "";
      if (!id || !name) continue;
      items.push({
        id,
        name,
        price: typeof item.price === "number" ? Math.max(0, Math.floor(item.price)) : 0,
        emoji: typeof item.emoji === "string" ? item.emoji : "🛒",
        image: typeof item.image === "string" ? item.image : null,
        unit: typeof item.unit === "string" ? item.unit : "pcs",
        itemCode: typeof item.itemCode === "string" ? item.itemCode : "",
        category: typeof item.category === "string" ? item.category : "Lainnya",
      });
    }

    if (items.length === 0) {
      return NextResponse.json(
        { success: false, message: "Wishlist kosong — tidak ada yang dibagikan." },
        { status: 400 }
      );
    }

    const result = await createSharedWishlist({ items, title });

    return NextResponse.json({
      success: true,
      message: "Link wishlist berhasil dibuat!",
      token: result.token,
      url: result.url,
      expiresAt: result.expiresAt.toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message || "Server error." },
      { status: 500 }
    );
  }
}
