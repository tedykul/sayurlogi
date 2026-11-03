import { NextRequest, NextResponse } from "next/server";
import { bulkUpdateProducts, type BulkAction } from "@/lib/products-db";
import { requirePermission, isAuthResult } from "@/lib/permissions";
import { logAdminAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

// POST /api/admin/products/bulk
// Body: { ids: string[], action: "publish" | "unpublish" | "delete" }
export async function POST(req: NextRequest) {
  // Delete requires products:delete; others require products:write.
  // We pre-check write here; if action is delete we re-check delete perm.
  const auth = await requirePermission("products:write");
  if (!isAuthResult(auth)) return auth;

  try {
    const body = (await req.json().catch(() => ({}))) as {
      ids?: unknown;
      action?: unknown;
    };
    const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === "string") : [];
    const action = body.action as BulkAction;
    if (!["publish", "unpublish", "delete"].includes(action)) {
      return NextResponse.json(
        { success: false, message: "Aksi tidak valid. Gunakan: publish, unpublish, delete." },
        { status: 422 }
      );
    }
    if (ids.length === 0) {
      return NextResponse.json(
        { success: false, message: "Pilih minimal 1 produk." },
        { status: 422 }
      );
    }

    if (action === "delete") {
      const deleteAuth = await requirePermission("products:delete");
      if (!isAuthResult(deleteAuth)) return deleteAuth;
    }

    const result = await bulkUpdateProducts(ids, action);
    await logAdminAction({
      action: action === "delete" ? "delete" : "update",
      target: `products:bulk:${action}:${result.affected} items`,
      success: true,
      userId: auth.userId,
      userEmail: auth.email,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    console.error("[api/admin/products/bulk] POST error:", err);
    return NextResponse.json(
      { success: false, message: "Server error." },
      { status: 500 }
    );
  }
}
