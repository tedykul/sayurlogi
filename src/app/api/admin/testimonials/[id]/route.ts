import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ id: string }>;
}

// PUT /api/admin/testimonials/[id] — update testimonial
export async function PUT(req: NextRequest, { params }: Params) {
  if (!(await verifyAdmin())) {
    await logAdminAction({ action: "unauthorized_attempt", target: "testimonial:update", success: false });
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }
  try {
    const { id } = await params;
    const body = await req.json();
    const data: Record<string, unknown> = {};

    if (typeof body.name === "string") {
      if (body.name.trim().length < 2) {
        return NextResponse.json({ success: false, message: "Nama minimal 2 karakter." }, { status: 422 });
      }
      data.name = body.name.trim();
    }
    if (typeof body.role === "string") data.role = body.role.trim();
    if (typeof body.avatar === "string") data.avatar = body.avatar || "👤";
    if (body.rating !== undefined) {
      const r = Number(body.rating);
      if (isNaN(r) || r < 0 || r > 5) {
        return NextResponse.json({ success: false, message: "Rating harus 0-5." }, { status: 422 });
      }
      data.rating = r;
    }
    if (typeof body.text === "string") {
      if (body.text.trim().length < 10) {
        return NextResponse.json({ success: false, message: "Testimoni minimal 10 karakter." }, { status: 422 });
      }
      data.text = body.text.trim();
    }
    if (typeof body.location === "string") data.location = body.location.trim();
    if (typeof body.published === "boolean") data.published = body.published;
    if (typeof body.order === "number") data.order = body.order;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ success: false, message: "Tidak ada field untuk diupdate." }, { status: 400 });
    }

    const item = await db.testimonial.update({
      where: { id },
      data,
    });
    const action = "published" in data ? "publish_toggle" : "order" in data ? "reorder" : "update";
    await logAdminAction({ action, target: `testimonial:${id}`, success: true });
    return NextResponse.json({ success: true, testimonial: item });
  } catch (err: any) {
    console.error("[api/admin/testimonials/[id]] PUT error:", err);
    return NextResponse.json({ success: false, message: "Server error." }, { status: 500 });
  }
}

// DELETE /api/admin/testimonials/[id]
export async function DELETE(_req: NextRequest, { params }: Params) {
  if (!(await verifyAdmin())) {
    await logAdminAction({ action: "unauthorized_attempt", target: "testimonial:delete", success: false });
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }
  try {
    const { id } = await params;
    await db.testimonial.delete({ where: { id } });
    await logAdminAction({ action: "delete", target: `testimonial:${id}`, success: true });
    return NextResponse.json({ success: true, message: "Testimoni dihapus." });
  } catch (err: any) {
    console.error("[api/admin/testimonials/[id]] DELETE error:", err);
    return NextResponse.json({ success: false, message: "Server error." }, { status: 500 });
  }
}
