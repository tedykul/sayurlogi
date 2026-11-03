import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

// GET /api/admin/faqs — list all (including unpublished), ordered
export async function GET() {
  try {
    const faqs = await db.fAQ.findMany({ orderBy: { order: "asc" } });
    return NextResponse.json({ success: true, faqs });
  } catch (err: any) {
    console.error("[api/admin/faqs] GET error:", err);
    return NextResponse.json({ success: false, message: "Server error." }, { status: 500 });
  }
}

// POST /api/admin/faqs — create new FAQ
// Body: { question, answer, published?, order? }
export async function POST(req: NextRequest) {
  if (!(await verifyAdmin())) {
    await logAdminAction({ action: "unauthorized_attempt", target: "faq:create", success: false });
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }
  try {
    const { question, answer, published = true, order } = await req.json();
    if (!question || typeof question !== "string" || question.trim().length < 3) {
      return NextResponse.json({ success: false, message: "Pertanyaan minimal 3 karakter." }, { status: 422 });
    }
    if (!answer || typeof answer !== "string" || answer.trim().length < 5) {
      return NextResponse.json({ success: false, message: "Jawaban minimal 5 karakter." }, { status: 422 });
    }
    // Determine order: if not provided, append to end
    let orderVal = typeof order === "number" ? order : 0;
    if (order === undefined) {
      const count = await db.fAQ.count();
      orderVal = count;
    }
    const faq = await db.fAQ.create({
      data: { question: question.trim(), answer: answer.trim(), published, order: orderVal },
    });
    await logAdminAction({ action: "create", target: `faq:${faq.id}`, success: true });
    return NextResponse.json({ success: true, faq }, { status: 201 });
  } catch (err: any) {
    console.error("[api/admin/faqs] POST error:", err);
    return NextResponse.json({ success: false, message: "Server error." }, { status: 500 });
  }
}
