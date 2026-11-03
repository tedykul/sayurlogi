import { NextRequest, NextResponse } from "next/server";
import { updateVariant, deleteVariant, type VariantInput } from "@/lib/products-db";
import { requirePermission, isAuthResult } from "@/lib/permissions";
import { logAdminAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string; variantId: string }>;
}

// PUT /api/admin/products/[id]/variants/[variantId]
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("products:write");
  if (!isAuthResult(auth)) return auth;

  try {
    const { id, variantId } = await params;
    const body = (await req.json().catch(() => ({}))) as Partial<VariantInput>;
    const variant = await updateVariant(id, variantId, body);
    if (!variant) {
      return NextResponse.json(
        { success: false, message: "Varian tidak ditemukan." },
        { status: 404 }
      );
    }
    await logAdminAction({
      action: "update",
      target: `product-variant:${variantId}`,
      success: true,
      userId: auth.userId,
      userEmail: auth.email,
    });
    return NextResponse.json({ success: true, variant });
  } catch (err: any) {
    console.error("[api/admin/products/[id]/variants/[variantId]] PUT error:", err);
    return NextResponse.json(
      { success: false, message: err.message || "Server error." },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/products/[id]/variants/[variantId]
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("products:write");
  if (!isAuthResult(auth)) return auth;

  try {
    const { id, variantId } = await params;
    const ok = await deleteVariant(id, variantId);
    if (!ok) {
      return NextResponse.json(
        { success: false, message: "Varian tidak ditemukan." },
        { status: 404 }
      );
    }
    await logAdminAction({
      action: "delete",
      target: `product-variant:${variantId}`,
      success: true,
      userId: auth.userId,
      userEmail: auth.email,
    });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[api/admin/products/[id]/variants/[variantId]] DELETE error:", err);
    return NextResponse.json(
      { success: false, message: "Server error." },
      { status: 500 }
    );
  }
}
