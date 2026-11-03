import { NextResponse } from "next/server";
import { fetchCategories } from "@/lib/erpnext";

export const dynamic = "force-dynamic";

// GET /api/categories
export async function GET() {
  const { categories, source } = await fetchCategories();

  return NextResponse.json({
    success: true,
    count: categories.length,
    source,
    categories,
  });
}
