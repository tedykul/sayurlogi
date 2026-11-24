import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { normalizePhone } from "@/lib/customer-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email")?.trim().toLowerCase();
    const phone = searchParams.get("phone")?.trim();

    if (!email && !phone) {
      return NextResponse.json(
        { success: false, message: "Parameter email atau phone diperlukan." },
        { status: 400 }
      );
    }

    const normalizedPhone = phone ? normalizePhone(phone) : null;

    const [emailTaken, phoneTaken] = await Promise.all([
      email
        ? db.customer
            .findUnique({ where: { email }, select: { id: true } })
            .then((c) => !!c)
            .catch(() => false)
        : false,
      normalizedPhone
        ? db.customer
            .findUnique({ where: { phone: normalizedPhone }, select: { id: true } })
            .then((c) => !!c)
            .catch(() => false)
        : false,
    ]);

    return NextResponse.json({ success: true, emailTaken, phoneTaken });
  } catch {
    return NextResponse.json(
      { success: false, message: "Gagal mengecek data." },
      { status: 500 }
    );
  }
}
