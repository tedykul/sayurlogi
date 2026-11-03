import { NextRequest, NextResponse } from "next/server";
import { getPublishedProducts } from "@/lib/products-db";

export const dynamic = "force-dynamic";

// GET /api/products?category=Sayuran
// Public storefront endpoint — reads published products from DB
// first. If DB is empty, falls back to mock data so the storefront
// always has something to show during initial setup.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category") || undefined;

  try {
    const { products, source } = await getPublishedProducts(category);
    return NextResponse.json({
      success: true,
      count: products.length,
      source, // "db" | "mock"
      products,
    });
  } catch (err: any) {
    console.error("[api/products] GET error:", err);
    return NextResponse.json(
      { success: false, message: "Server error." },
      { status: 500 }
    );
  }
}
