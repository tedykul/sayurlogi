import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/audit";
import sharp from "sharp";
import { writeFile, readFile } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

// ============================================================
// POST /api/admin/upload-logo
// ============================================================
// Accepts multipart/form-data with field "logo" (image file).
// Converts to PNG via sharp, saves to /public/logo-uploaded.png.
// Regenerates PWA icons (192, 512, maskable, apple-touch).
//
// Supported formats: PNG, JPG, JPEG, SVG, WebP
// Max size: 5MB
// ============================================================

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];

export async function POST(req: NextRequest) {
  const auth = await verifyAuth();
  if (!auth) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("logo") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, message: "File tidak ditemukan. Pastikan field name = 'logo'." },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, message: `Format tidak didukung: ${file.type}. Gunakan PNG, JPG, SVG, atau WebP.` },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { success: false, message: `Ukuran file terlalu besar (max 5MB). File: ${(file.size / 1024 / 1024).toFixed(1)}MB` },
        { status: 400 }
      );
    }

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const publicDir = path.join(process.cwd(), "public");
    const logoPath = path.join(publicDir, "logo-uploaded.png");

    // Convert to PNG via sharp (handles SVG, JPG, PNG, WebP input)
    // Resize to 512x512 max (preserve aspect ratio, don't upscale)
    await sharp(buffer)
      .resize(512, 512, { fit: "inside", withoutEnlargement: true })
      .png()
      .toFile(logoPath);

    // Regenerate PWA icons from uploaded logo
    const icon192Path = path.join(publicDir, "icon-192.png");
    const icon512Path = path.join(publicDir, "icon-512.png");
    const maskablePath = path.join(publicDir, "maskable-512.png");
    const appleTouchPath = path.join(publicDir, "apple-touch-icon.png");

    // 192x192 (any purpose)
    await sharp(buffer)
      .resize(192, 192, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png()
      .toFile(icon192Path);

    // 512x512 (any purpose)
    await sharp(buffer)
      .resize(512, 512, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png()
      .toFile(icon512Path);

    // 512x512 maskable (with safe zone padding)
    await sharp(buffer)
      .resize(400, 400, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .extend({ top: 56, bottom: 56, left: 56, right: 56, background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png()
      .toFile(maskablePath);

    // 180x180 (Apple touch icon)
    await sharp(buffer)
      .resize(180, 180, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png()
      .toFile(appleTouchPath);

    // Bump SW cache version to force refresh
    const swPath = path.join(publicDir, "sw.js");
    let swContent = await readFile(swPath, "utf-8").catch(() => "");
    if (swContent) {
      const currentVersion = swContent.match(/CACHE_VERSION = "v(\d+)"/);
      if (currentVersion) {
        const newVersion = `v${parseInt(currentVersion[1], 10) + 1}`;
        swContent = swContent.replace(/CACHE_VERSION = "v\d+"/, `CACHE_VERSION = "${newVersion}"`);
        await writeFile(swPath, swContent, "utf-8");
      }
    }

    await logAdminAction({
      action: "update",
      target: "branding:logo",
      success: true,
      userId: auth.userId,
      userEmail: auth.email,
    });

    return NextResponse.json({
      success: true,
      message: "Logo berhasil di-upload. PWA icons juga di-regenerate.",
      logoUrl: "/logo-uploaded.png",
      icons: {
        "192": "/icon-192.png",
        "512": "/icon-512.png",
        "maskable": "/maskable-512.png",
        "apple": "/apple-touch-icon.png",
      },
    });
  } catch (err: any) {
    console.error("[api/admin/upload-logo] error:", err);
    return NextResponse.json(
      { success: false, message: `Upload gagal: ${err.message}` },
      { status: 500 }
    );
  }
}
