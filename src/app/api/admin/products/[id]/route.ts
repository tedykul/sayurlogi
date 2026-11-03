import { NextRequest, NextResponse } from "next/server";
import {
  getProductById,
  updateProduct,
  deleteProduct,
  type ProductInput,
} from "@/lib/products-db";
import { requirePermission, isAuthResult } from "@/lib/permissions";
import { logAdminAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/admin/products/[id] — single product
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("products:read");
  if (!isAuthResult(auth)) return auth;

  try {
    const { id } = await params;
    const product = await getProductById(id);
    if (!product) {
      return NextResponse.json(
        { success: false, message: "Produk tidak ditemukan." },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, product });
  } catch (err: any) {
    console.error("[api/admin/products/[id]] GET error:", err);
    return NextResponse.json(
      { success: false, message: "Server error." },
      { status: 500 }
    );
  }
}

// PUT /api/admin/products/[id] — update product
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("products:write");
  if (!isAuthResult(auth)) return auth;

  try {
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as Partial<ProductInput>;
    const product = await updateProduct(id, body);
    if (!product) {
      return NextResponse.json(
        { success: false, message: "Produk tidak ditemukan." },
        { status: 404 }
      );
    }
    await logAdminAction({
      action: "update",
      target: `product:${id}`,
      success: true,
      userId: auth.userId,
      userEmail: auth.email,
    });
    return NextResponse.json({ success: true, product });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json(
        { success: false, message: "Item code sudah digunakan." },
        { status: 409 }
      );
    }
    console.error("[api/admin/products/[id]] PUT error:", err);
    return NextResponse.json(
      { success: false, message: err.message || "Server error." },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/products/[id] — delete product (cascades variants)
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("products:delete");
  if (!isAuthResult(auth)) return auth;

  try {
    const { id } = await params;
    const ok = await deleteProduct(id);
    if (!ok) {
      return NextResponse.json(
        { success: false, message: "Produk tidak ditemukan." },
        { status: 404 }
      );
    }
    await logAdminAction({
      action: "delete",
      target: `product:${id}`,
      success: true,
      userId: auth.userId,
      userEmail: auth.email,
    });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[api/admin/products/[id]] DELETE error:", err);
    return NextResponse.json(
      { success: false, message: "Server error." },
      { status: 500 }
    );
  }
}
