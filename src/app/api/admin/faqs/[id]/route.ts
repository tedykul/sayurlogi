import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ id: string }>;
}

// PUT /api/admin/faqs/[id] — update FAQ
// Body: partial { question, answer, published, order }
export async function PUT(req: NextRequest, { params }: Params) {
  if (!(await verifyAdmin())) {
    await logAdminAction({ action: "unauthorized_attempt", target: "faq:update", success: false });
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }
  try {
    const { id } = await params;
    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (typeof body.question === "string") {
      if (body.question.trim().length < 3) {
        return NextResponse.json({ success: false, message: "Pertanyaan minimal 3 karakter." }, { status: 422 });
      }
      data.question = body.question.trim();
    }
    if (typeof body.answer === "string") {
      if (body.answer.trim().length < 5) {
        return NextResponse.json({ success: false, message: "Jawaban minimal 5 karakter." }, { status: 422 });
      }
      data.answer = body.answer.trim();
    }
    if (typeof body.published === "boolean") data.published = body.published;
    if (typeof body.order === "number") data.order = body.order;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ success: false, message: "Tidak ada field untuk diupdate." }, { status: 400 });
    }

    const faq = await db.fAQ.update({
      where: { id },
      data,
    });
    const action = "published" in data ? "publish_toggle" : "order" in data ? "reorder" : "update";
    await logAdminAction({ action, target: `faq:${id}`, success: true });
    return NextResponse.json({ success: true, faq });
  } catch (err: any) {
    console.error("[api/admin/faqs/[id]] PUT error:", err);
    return NextResponse.json({ success: false, message: "Server error." }, { status: 500 });
  }
}

// DELETE /api/admin/faqs/[id] — delete FAQ
export async function DELETE(_req: NextRequest, { params }: Params) {
  if (!(await verifyAdmin())) {
    await logAdminAction({ action: "unauthorized_attempt", target: "faq:delete", success: false });
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }
  try {
    const { id } = await params;
    await db.fAQ.delete({ where: { id } });
    await logAdminAction({ action: "delete", target: `faq:${id}`, success: true });
    return NextResponse.json({ success: true, message: "FAQ dihapus." });
  } catch (err: any) {
    console.error("[api/admin/faqs/[id]] DELETE error:", err);
    return NextResponse.json({ success: false, message: "Server error." }, { status: 500 });
  }
}
