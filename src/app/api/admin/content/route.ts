import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyAuth } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

// GET /api/admin/content — read singleton site content (no auth needed
// for read since content is public anyway; but kept under /admin for
// consistency with admin UI which always sends auth header).
export async function GET() {
  try {
    const row = await db.siteSetting.findUnique({ where: { id: "singleton" } });
    return NextResponse.json({ success: true, content: row });
  } catch (err: any) {
    console.error("[api/admin/content] GET error:", err);
    return NextResponse.json(
      { success: false, message: "Server error." },
      { status: 500 }
    );
  }
}

// POST /api/admin/content — update singleton site content.
// Body: partial SiteSetting fields (only provided fields are updated).
// Requires auth.
export async function POST(req: NextRequest) {
  const auth = await verifyAuth();
  if (!auth) {
    await logAdminAction({
      action: "unauthorized_attempt",
      target: "content:update",
      success: false,
    });
    return NextResponse.json(
      { success: false, message: "Unauthorized." },
      { status: 401 }
    );
  }
  try {
    const body = await req.json();
    // Whitelist allowed fields — ignore unknown keys for safety.
    const allowedFields = [
      "heroBadge", "heroTitleA", "heroTitleHighlight", "heroTitleB",
      "heroSubtitle", "heroCtaPrimary", "heroCtaSecondary",
      "promoId", "promoTitle", "promoDescription",
      "contactPhone", "contactEmail", "contactAddress", "contactHours",
      "aboutBadge", "aboutTitleA", "aboutTitleHighlight", "aboutTitleB",
      "aboutSubtitle", "aboutStoryH3", "aboutStoryP1", "aboutStoryP2",
      "aboutStat1Value", "aboutStat1Label", "aboutStat2Value", "aboutStat2Label",
      "aboutStat3Value", "aboutStat3Label", "aboutStat4Value", "aboutStat4Label",
      "aboutValue1Title", "aboutValue1Desc",
      "aboutValue2Title", "aboutValue2Desc",
      "aboutValue3Title", "aboutValue3Desc",
      "aboutValue4Title", "aboutValue4Desc",
      "footerBrandText", "footerTagline",
      // Branding (Sprint 11)
      "brandName", "metaDescription",
      "socialInstagram", "socialFacebook", "socialTwitter", "socialTiktok", "socialWhatsapp",
      // Sprints 12-24 — favicon, shipping, reward, about image,
      // testimonial, top bar, footer copyright.
      "faviconUrl",
      "aboutImage",
      "testimonialBadge",
      "testimonialTitleA", "testimonialTitleHighlight", "testimonialTitleB",
      "testimonialSubtitle",
      "testimonialStat1Value", "testimonialStat1Label", "testimonialStat1Subtext",
      "testimonialStat2Value", "testimonialStat2Label", "testimonialStat2Subtext",
      "testimonialStat3Value", "testimonialStat3Label", "testimonialStat3Subtext",
      "testimonialStat4Value", "testimonialStat4Label", "testimonialStat4Subtext",
      "topBarShipping", "topBarBadge",
      "footerCopyrightText",
    ];
    // Integer fields — parsed as Number, persisted as Int? on SiteSetting.
    const intFields = [
      "freeShippingThreshold",
      "shippingFee",
      "rewardOrderCount",
      "rewardDiscountPercent",
    ];

    const data: Record<string, string | number | null> = {};
    for (const key of allowedFields) {
      if (key in body) {
        const val = body[key];
        // Allow null (reset to default) or string
        data[key] = val === null || val === "" ? null : String(val);
      }
    }
    for (const key of intFields) {
      if (key in body) {
        const val = body[key];
        if (val === null || val === "" || val === undefined) {
          data[key] = null;
        } else {
          const n = Number(val);
          data[key] = Number.isFinite(n) ? Math.trunc(n) : null;
        }
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { success: false, message: "Tidak ada field untuk diupdate." },
        { status: 400 }
      );
    }

    // Upsert: create singleton if not exists
    const updated = await db.siteSetting.upsert({
      where: { id: "singleton" },
      update: data,
      create: { id: "singleton", ...data },
    });

    // Audit log: record which fields were updated
    await logAdminAction({
      action: "update",
      target: `content:${Object.keys(data).join(",")}`,
      success: true,
      userId: auth.userId || undefined,
      userEmail: auth.email,
    });

    return NextResponse.json({
      success: true,
      message: "Konten berhasil disimpan.",
      content: updated,
    });
  } catch (err: any) {
    console.error("[api/admin/content] POST error:", err);
    return NextResponse.json(
      { success: false, message: "Server error." },
      { status: 500 }
    );
  }
}
