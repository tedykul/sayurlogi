import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

export const dynamic = "force-dynamic";

// ============================================================
// POST /api/newsletter — subscribe email to newsletter
// ============================================================
// Validates email with zod, persists to NewsletterSubscriber table.
// Unique constraint on email — if already subscribed, returns success
// with "already subscribed" message (idempotent).
// Returns 201 on new subscription, 200 on existing, 422 on invalid.

const newsletterSchema = z.object({
  email: z.string().email("Format email tidak valid").max(150).trim().toLowerCase(),
  source: z.enum(["footer", "promo", "manual"]).default("footer"),
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
  const parsed = newsletterSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return NextResponse.json(
      { success: false, message: firstError?.message || "Email tidak valid." },
      { status: 422 }
    );
  }

  const { email, source } = parsed.data;

  try {
    // Check if already subscribed (active or unsubscribed)
    const existing = await db.newsletterSubscriber.findUnique({
      where: { email },
      select: { id: true, status: true },
    });

    if (existing) {
      if (existing.status === "active") {
        return NextResponse.json(
          {
            success: true,
            message: "Email sudah terdaftar. Terima kasih sudah berlangganan!",
            alreadySubscribed: true,
          },
          { status: 200 }
        );
      }
      // Reactivate unsubscribed user
      await db.newsletterSubscriber.update({
        where: { id: existing.id },
        data: { status: "active", source },
      });
      return NextResponse.json(
        {
          success: true,
          message: "Langganan berhasil diaktifkan kembali. Selamat datang kembali!",
        },
        { status: 200 }
      );
    }

    // Create new subscriber
    await db.newsletterSubscriber.create({
      data: { email, source },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Berhasil berlangganan! Kamu akan dapat info promo & tips sehat.",
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("[api/newsletter] DB error:", err);
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan server. Coba lagi nanti." },
      { status: 500 }
    );
  }
}

// ============================================================
// DELETE /api/newsletter — unsubscribe (for future unsubscribe link)
// ============================================================
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email");

  if (!email) {
    return NextResponse.json(
      { success: false, message: "Email diperlukan." },
      { status: 400 }
    );
  }

  try {
    const existing = await db.newsletterSubscriber.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    if (!existing) {
      return NextResponse.json(
        { success: true, message: "Email tidak ditemukan." },
        { status: 200 }
      );
    }

    await db.newsletterSubscriber.update({
      where: { id: existing.id },
      data: { status: "unsubscribed" },
    });

    return NextResponse.json(
      { success: true, message: "Berhasil berhenti berlangganan." },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[api/newsletter] DB error:", err);
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan server." },
      { status: 500 }
    );
  }
}
