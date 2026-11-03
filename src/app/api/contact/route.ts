import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

export const dynamic = "force-dynamic";

// ============================================================
// POST /api/contact — submit a contact message
// ============================================================
// Validates payload with zod, persists to ContactMessage table.
// Returns 201 on success, 422 on validation error, 500 on server error.

const contactSchema = z.object({
  name: z
    .string()
    .min(2, "Nama minimal 2 karakter")
    .max(100, "Nama terlalu panjang")
    .trim(),
  email: z.string().email("Format email tidak valid").max(150).trim().toLowerCase(),
  phone: z
    .string()
    .max(30, "Nomor telepon terlalu panjang")
    .regex(/^[0-9+\-\s()]*$/, "Format nomor telepon tidak valid")
    .optional()
    .or(z.literal("")),
  subject: z
    .string()
    .min(3, "Subjek minimal 3 karakter")
    .max(200, "Subjek terlalu panjang")
    .trim(),
  message: z
    .string()
    .min(10, "Pesan minimal 10 karakter")
    .max(2000, "Pesan terlalu panjang (maks 2000 karakter)")
    .trim(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Body request bukan JSON valid." },
      { status: 400 }
    );
  }

  // Validate
  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return NextResponse.json(
      {
        success: false,
        message: firstError?.message || "Data tidak valid.",
        errors: parsed.error.issues.map((e) => ({ field: e.path.join("."), message: e.message })),
      },
      { status: 422 }
    );
  }

  const { name, email, phone, subject, message } = parsed.data;

  try {
    const record = await db.contactMessage.create({
      data: {
        name,
        email,
        phone: phone && phone.length > 0 ? phone : null,
        subject,
        message,
      },
      select: {
        id: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Pesan berhasil dikirim. Tim kami akan menghubungi dalam 1x24 jam.",
        ticketId: record.id,
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("[api/contact] DB error:", err);
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan server. Coba lagi nanti." },
      { status: 500 }
    );
  }
}
