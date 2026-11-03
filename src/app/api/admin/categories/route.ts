import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

// GET /api/admin/categories — list all (including unpublished), ordered
export async function GET() {
  try {
    const items = await db.categorySetting.findMany({ orderBy: { order: "asc" } });
    return NextResponse.json({ success: true, categories: items });
  } catch (err: any) {
    console.error("[api/admin/categories] GET error:", err);
    return NextResponse.json({ success: false, message: "Server error." }, { status: 500 });
  }
}

// POST /api/admin/categories — create new category
// Body: { name, emoji, description?, gradient, published?, order? }
export async function POST(req: NextRequest) {
  if (!(await verifyAdmin())) {
    await logAdminAction({ action: "unauthorized_attempt", target: "category:create", success: false });
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }
  try {
    const body = await req.json();
    const { name, emoji, description, gradient, published = true, order } = body;

    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return NextResponse.json({ success: false, message: "Nama kategori minimal 2 karakter." }, { status: 422 });
    }
    if (!emoji || typeof emoji !== "string") {
      return NextResponse.json({ success: false, message: "Emoji diperlukan." }, { status: 422 });
    }
    if (!gradient || typeof gradient !== "string") {
      return NextResponse.json({ success: false, message: "Gradient diperlukan." }, { status: 422 });
    }

    let orderVal = typeof order === "number" ? order : 0;
    if (order === undefined) {
      const count = await db.categorySetting.count();
      orderVal = count;
    }

    try {
      const item = await db.categorySetting.create({
        data: {
          name: name.trim(),
          emoji,
          description: description?.trim() || null,
          gradient,
          published,
          order: orderVal,
        },
      });
      await logAdminAction({ action: "create", target: `category:${item.id}`, success: true });
      return NextResponse.json({ success: true, category: item }, { status: 201 });
    } catch (e: any) {
      if (e?.code === "P2002") {
        return NextResponse.json({ success: false, message: "Nama kategori sudah ada." }, { status: 409 });
      }
      throw e;
    }
  } catch (err: any) {
    console.error("[api/admin/categories] POST error:", err);
    return NextResponse.json({ success: false, message: "Server error." }, { status: 500 });
  }
}
