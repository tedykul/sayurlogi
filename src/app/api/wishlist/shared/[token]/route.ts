import { NextRequest, NextResponse } from "next/server";
import { getSharedWishlistByToken } from "@/lib/shared-wishlist";

export const dynamic = "force-dynamic";

// ============================================================
// GET /api/wishlist/shared/[token]
// ============================================================
// Public endpoint — returns the shared wishlist snapshot by
// token. Increments view count (best-effort). Returns 404 if
// the token is not found or has expired.
// ============================================================

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const snapshot = await getSharedWishlistByToken(token);
    if (!snapshot) {
      return NextResponse.json(
        { success: false, message: "Wishlist tidak ditemukan atau sudah kedaluwarsa." },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, wishlist: snapshot });
  } catch {
    return NextResponse.json(
      { success: false, message: "Server error." },
      { status: 500 }
    );
  }
}
