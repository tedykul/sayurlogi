import { NextRequest, NextResponse } from "next/server";
import { addVariant, type VariantInput } from "@/lib/products-db";
import { requirePermission, isAuthResult } from "@/lib/permissions";
import { logAdminAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/admin/products/[id]/variants — add a variant to a product
export async function POST(req: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("products:write");
  if (!isAuthResult(auth)) return auth;

  try {
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as Partial<VariantInput>;
    if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json(
        { success: false, message: "Nama varian diperlukan." },
        { status: 422 }
      );
    }
    const variant = await addVariant(id, {
      name: body.name,
      sku: body.sku,
      price: typeof body.price === "number" ? body.price : 0,
      oldPrice: body.oldPrice ?? null,
      stock: typeof body.stock === "number" ? body.stock : 0,
      unit: body.unit,
    });
    if (!variant) {
      return NextResponse.json(
        { success: false, message: "Produk tidak ditemukan." },
        { status: 404 }
      );
    }
    await logAdminAction({
      action: "create",
      target: `product-variant:${variant.id}`,
      success: true,
      userId: auth.userId,
      userEmail: auth.email,
    });
    return NextResponse.json({ success: true, variant }, { status: 201 });
  } catch (err: any) {
    console.error("[api/admin/products/[id]/variants] POST error:", err);
    return NextResponse.json(
      { success: false, message: "Server error." },
      { status: 500 }
    );
  }
}
