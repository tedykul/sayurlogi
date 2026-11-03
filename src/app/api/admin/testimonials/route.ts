import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

// GET /api/admin/testimonials — list all (including unpublished), ordered
export async function GET() {
  try {
    const items = await db.testimonial.findMany({ orderBy: { order: "asc" } });
    return NextResponse.json({ success: true, testimonials: items });
  } catch (err: any) {
    console.error("[api/admin/testimonials] GET error:", err);
    return NextResponse.json({ success: false, message: "Server error." }, { status: 500 });
  }
}

// POST /api/admin/testimonials — create new testimonial
// Body: { name, role, avatar, rating, text, location, published?, order? }
export async function POST(req: NextRequest) {
  if (!(await verifyAdmin())) {
    await logAdminAction({ action: "unauthorized_attempt", target: "testimonial:create", success: false });
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }
  try {
    const body = await req.json();
    const { name, role, avatar, rating, text, location, published = true, order } = body;

    // Validation
    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return NextResponse.json({ success: false, message: "Nama minimal 2 karakter." }, { status: 422 });
    }
    if (!text || typeof text !== "string" || text.trim().length < 10) {
      return NextResponse.json({ success: false, message: "Testimoni minimal 10 karakter." }, { status: 422 });
    }
    const ratingNum = Number(rating);
    if (isNaN(ratingNum) || ratingNum < 0 || ratingNum > 5) {
      return NextResponse.json({ success: false, message: "Rating harus 0-5." }, { status: 422 });
    }

    let orderVal = typeof order === "number" ? order : 0;
    if (order === undefined) {
      const count = await db.testimonial.count();
      orderVal = count;
    }

    const item = await db.testimonial.create({
      data: {
        name: name.trim(),
        role: (role || "").trim(),
        avatar: avatar || "👤",
        rating: ratingNum,
        text: text.trim(),
        location: (location || "").trim(),
        published,
        order: orderVal,
      },
    });
    await logAdminAction({ action: "create", target: `testimonial:${item.id}`, success: true });
    return NextResponse.json({ success: true, testimonial: item }, { status: 201 });
  } catch (err: any) {
    console.error("[api/admin/testimonials] POST error:", err);
    return NextResponse.json({ success: false, message: "Server error." }, { status: 500 });
  }
}
