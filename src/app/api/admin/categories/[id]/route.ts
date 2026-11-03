import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ id: string }>;
}

// PUT /api/admin/categories/[id] — update category
export async function PUT(req: NextRequest, { params }: Params) {
  if (!(await verifyAdmin())) {
    await logAdminAction({ action: "unauthorized_attempt", target: "category:update", success: false });
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }
  try {
    const { id } = await params;
    const body = await req.json();
    const data: Record<string, unknown> = {};

    if (typeof body.name === "string") {
      if (body.name.trim().length < 2) {
        return NextResponse.json({ success: false, message: "Nama kategori minimal 2 karakter." }, { status: 422 });
      }
      data.name = body.name.trim();
    }
    if (typeof body.emoji === "string") data.emoji = body.emoji;
    if (typeof body.description === "string") data.description = body.description.trim() || null;
    if (typeof body.gradient === "string") data.gradient = body.gradient;
    if (typeof body.published === "boolean") data.published = body.published;
    if (typeof body.order === "number") data.order = body.order;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ success: false, message: "Tidak ada field untuk diupdate." }, { status: 400 });
    }

    try {
      const item = await db.categorySetting.update({
        where: { id },
        data,
      });
      const action = "published" in data ? "publish_toggle" : "order" in data ? "reorder" : "update";
      await logAdminAction({ action, target: `category:${id}`, success: true });
      return NextResponse.json({ success: true, category: item });
    } catch (e: any) {
      if (e?.code === "P2002") {
        return NextResponse.json({ success: false, message: "Nama kategori sudah ada." }, { status: 409 });
      }
      throw e;
    }
  } catch (err: any) {
    console.error("[api/admin/categories/[id]] PUT error:", err);
    return NextResponse.json({ success: false, message: "Server error." }, { status: 500 });
  }
}

// DELETE /api/admin/categories/[id]
export async function DELETE(_req: NextRequest, { params }: Params) {
  if (!(await verifyAdmin())) {
    await logAdminAction({ action: "unauthorized_attempt", target: "category:delete", success: false });
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }
  try {
    const { id } = await params;
    await db.categorySetting.delete({ where: { id } });
    await logAdminAction({ action: "delete", target: `category:${id}`, success: true });
    return NextResponse.json({ success: true, message: "Kategori dihapus." });
  } catch (err: any) {
    console.error("[api/admin/categories/[id]] DELETE error:", err);
    return NextResponse.json({ success: false, message: "Server error." }, { status: 500 });
  }
}
