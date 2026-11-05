import { db } from "../src/lib/db";

// ============================================================
// Fix brand name: replace all "SayurBox" → "SayurLogi" in DB.
// ============================================================
// Run on VPS after git pull + before pm2 restart:
//   bun run scripts/fix-brand-name.ts
// ============================================================

async function main() {
  console.log("🔄 Updating SiteSetting...");
  const setting = await db.siteSetting.findFirst();
  if (!setting) {
    console.log("No SiteSetting found — skipping.");
    return;
  }

  const replace = (s: string | null) => (s ? s.replace(/SayurBox/g, "SayurLogi") : s);

  await db.siteSetting.update({
    where: { id: "singleton" },
    data: {
      brandName: replace(setting.brandName) || "SayurLogi",
      contactEmail: "halo@sayurlogi.id",
      aboutSubtitle: replace(setting.aboutSubtitle),
      aboutStoryP1: replace(setting.aboutStoryP1),
      aboutStoryP2: replace(setting.aboutStoryP2),
      footerBrandText: replace(setting.footerBrandText),
      footerTagline: replace(setting.footerTagline),
      metaDescription: replace(setting.metaDescription),
    },
  });
  console.log("  ✓ SiteSetting updated");

  // Update FAQ
  const faqs = await db.fAQ.findMany();
  for (const faq of faqs) {
    if (faq.question.includes("SayurBox") || faq.answer.includes("SayurBox")) {
      await db.fAQ.update({
        where: { id: faq.id },
        data: {
          question: faq.question.replace(/SayurBox/g, "SayurLogi"),
          answer: faq.answer.replace(/SayurBox/g, "SayurLogi"),
        },
      });
      console.log(`  ✓ FAQ updated: ${faq.question.slice(0, 40)}...`);
    }
  }

  // Update Testimonials
  const testimonials = await db.testimonial.findMany();
  for (const t of testimonials) {
    if (t.text.includes("SayurBox")) {
      await db.testimonial.update({
        where: { id: t.id },
        data: { text: t.text.replace(/SayurBox/g, "SayurLogi") },
      });
      console.log(`  ✓ Testimonial updated: ${t.text.slice(0, 40)}...`);
    }
  }

  // Verify
  const updated = await db.siteSetting.findFirst({ select: { brandName: true, contactEmail: true }});
  console.log("\n✅ Done! DB now:");
  console.log("  brandName:", updated?.brandName);
  console.log("  contactEmail:", updated?.contactEmail);
}

main().catch(console.error).finally(() => process.exit(0));
