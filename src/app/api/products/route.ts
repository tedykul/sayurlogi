import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// ============================================================
// GET /api/products — minimal storefront catalog.
// Optional: ?category=Sayuran
// Returns: { products: Product[] }
// ============================================================

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");

    const products = await db.product.findMany({
      where: category ? { category } : undefined,
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ success: true, products });
  } catch (err) {
    console.error("[api/products] GET error:", err);
    return NextResponse.json(
      { success: false, message: "Server error." },
      { status: 500 }
    );
  }
}
