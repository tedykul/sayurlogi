import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/audit";
import { db } from "@/lib/db";
import sharp from "sharp";
import { writeFile } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

// ============================================================
// POST /api/admin/upload-banner
// ============================================================
// Accepts multipart/form-data with field "banner" (image file).
// Resizes to 1200x630 (OG image ratio, good for welcome banner),
// converts to WebP for size efficiency, saves to /public/banner.webp.
// Updates SiteSetting.welcomeBannerImage to the public URL.
//
// Supported formats: PNG, JPG, JPEG, WebP
// Max size: 5MB
// ============================================================

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const OUTPUT_WIDTH = 1200;
const OUTPUT_HEIGHT = 630;

export async function POST(req: NextRequest) {
  const auth = await verifyAuth();
  if (!auth) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("banner") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, message: "File tidak ditemukan. Pastikan field name = 'banner'." },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, message: `Format tidak didukung: ${file.type}. Gunakan PNG, JPG, atau WebP.` },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { success: false, message: `File terlalu besar (max 5MB). Ukuran: ${(file.size / 1024 / 1024).toFixed(1)}MB` },
        { status: 400 }
      );
    }

    // Read file buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Process image with sharp:
    // - Resize to 1200x630 (cover, crop center)
    // - Convert to WebP (quality 85 — good balance size/quality)
    const outputBuffer = await sharp(buffer)
      .resize(OUTPUT_WIDTH, OUTPUT_HEIGHT, {
        fit: "cover",
        position: "center",
        withoutEnlargement: false,
      })
      .webp({ quality: 85 })
      .toBuffer();

    // Save to /public/banner.webp (overwrite previous)
    const outputPath = path.join(process.cwd(), "public", "banner.webp");
    await writeFile(outputPath, outputBuffer);

    // Update DB — set welcomeBannerImage to public URL path
    const imageUrl = "/banner.webp";
    await db.siteSetting.upsert({
      where: { id: "singleton" },
      update: { welcomeBannerImage: imageUrl },
      create: { id: "singleton", welcomeBannerImage: imageUrl },
    });

    await logAdminAction({
      action: "update",
      target: "content:welcomeBannerImage",
      success: true,
      userId: auth.userId || undefined,
      userEmail: auth.email,
    });

    return NextResponse.json({
      success: true,
      message: "Banner berhasil diupload.",
      imageUrl,
    });
  } catch (err: any) {
    console.error("[api/admin/upload-banner] error:", err);
    return NextResponse.json(
      { success: false, message: "Server error saat upload banner." },
      { status: 500 }
    );
  }
}
