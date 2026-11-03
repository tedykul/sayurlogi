import { db } from "@/lib/db";
import type { Product, Category } from "@/types/grocery";
import { MOCK_CATEGORIES } from "@/lib/mock-data";

// ============================================================
// Server-side content fetcher for page.tsx.
// ============================================================
// Called from a server component, returns content from DB with
// fallback to null (section components use hardcoded defaults
// when null). This keeps page.tsx a client component while
// letting sections read DB-driven content via initial props.
// ============================================================

export interface PageContent {
  // SiteSetting fields (null = use hardcoded default)
  heroBadge: string | null;
  heroTitleA: string | null;
  heroTitleHighlight: string | null;
  heroTitleB: string | null;
  heroSubtitle: string | null;
  heroCtaPrimary: string | null;
  heroCtaSecondary: string | null;
  promoId: string | null;
  promoTitle: string | null;
  promoDescription: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  contactAddress: string | null;
  contactHours: string | null;
  aboutBadge: string | null;
  aboutTitleA: string | null;
  aboutTitleHighlight: string | null;
  aboutTitleB: string | null;
  aboutSubtitle: string | null;
  aboutStoryH3: string | null;
  aboutStoryP1: string | null;
  aboutStoryP2: string | null;
  aboutStat1Value: string | null;
  aboutStat1Label: string | null;
  aboutStat2Value: string | null;
  aboutStat2Label: string | null;
  aboutStat3Value: string | null;
  aboutStat3Label: string | null;
  aboutStat4Value: string | null;
  aboutStat4Label: string | null;
  aboutValue1Title: string | null;
  aboutValue1Desc: string | null;
  aboutValue2Title: string | null;
  aboutValue2Desc: string | null;
  aboutValue3Title: string | null;
  aboutValue3Desc: string | null;
  aboutValue4Title: string | null;
  aboutValue4Desc: string | null;
  footerBrandText: string | null;
  footerTagline: string | null;
  // Branding
  brandName: string | null;
  metaDescription: string | null;
  socialInstagram: string | null;
  socialFacebook: string | null;
  socialTwitter: string | null;
  socialTiktok: string | null;
  socialWhatsapp: string | null;
  // Sprints 12-24 — favicon, shipping, reward, about image,
  // testimonial, top bar, footer copyright.
  faviconUrl: string | null;
  freeShippingThreshold: number | null;
  shippingFee: number | null;
  rewardOrderCount: number | null;
  rewardDiscountPercent: number | null;
  aboutImage: string | null;
  testimonialBadge: string | null;
  testimonialTitleA: string | null;
  testimonialTitleHighlight: string | null;
  testimonialTitleB: string | null;
  testimonialSubtitle: string | null;
  testimonialStat1Value: string | null;
  testimonialStat1Label: string | null;
  testimonialStat1Subtext: string | null;
  testimonialStat2Value: string | null;
  testimonialStat2Label: string | null;
  testimonialStat2Subtext: string | null;
  testimonialStat3Value: string | null;
  testimonialStat3Label: string | null;
  testimonialStat3Subtext: string | null;
  testimonialStat4Value: string | null;
  testimonialStat4Label: string | null;
  testimonialStat4Subtext: string | null;
  topBarShipping: string | null;
  topBarBadge: string | null;
  footerCopyrightText: string | null;
  faqs: { id: string; q: string; a: string }[];
  testimonials: {
    id: string;
    name: string;
    role: string;
    avatar: string;
    rating: number;
    text: string;
    location: string;
  }[];
  categories: Category[];
}

const NULL_CONTENT = {
  heroBadge: null, heroTitleA: null, heroTitleHighlight: null, heroTitleB: null,
  heroSubtitle: null, heroCtaPrimary: null, heroCtaSecondary: null,
  promoId: null, promoTitle: null, promoDescription: null,
  contactPhone: null, contactEmail: null, contactAddress: null, contactHours: null,
  aboutBadge: null, aboutTitleA: null, aboutTitleHighlight: null, aboutTitleB: null,
  aboutSubtitle: null, aboutStoryH3: null, aboutStoryP1: null, aboutStoryP2: null,
  aboutStat1Value: null, aboutStat1Label: null,
  aboutStat2Value: null, aboutStat2Label: null,
  aboutStat3Value: null, aboutStat3Label: null,
  aboutStat4Value: null, aboutStat4Label: null,
  aboutValue1Title: null, aboutValue1Desc: null,
  aboutValue2Title: null, aboutValue2Desc: null,
  aboutValue3Title: null, aboutValue3Desc: null,
  aboutValue4Title: null, aboutValue4Desc: null,
  footerBrandText: null, footerTagline: null,
  brandName: null, metaDescription: null,
  socialInstagram: null, socialFacebook: null, socialTwitter: null,
  socialTiktok: null, socialWhatsapp: null,
  // Sprints 12-24
  faviconUrl: null,
  freeShippingThreshold: null,
  shippingFee: null,
  rewardOrderCount: null,
  rewardDiscountPercent: null,
  aboutImage: null,
  testimonialBadge: null,
  testimonialTitleA: null, testimonialTitleHighlight: null, testimonialTitleB: null,
  testimonialSubtitle: null,
  testimonialStat1Value: null, testimonialStat1Label: null, testimonialStat1Subtext: null,
  testimonialStat2Value: null, testimonialStat2Label: null, testimonialStat2Subtext: null,
  testimonialStat3Value: null, testimonialStat3Label: null, testimonialStat3Subtext: null,
  testimonialStat4Value: null, testimonialStat4Label: null, testimonialStat4Subtext: null,
  topBarShipping: null, topBarBadge: null,
  footerCopyrightText: null,
};

/** Fetch all page content from DB. Safe to call from server component. */
export async function getPageContent(): Promise<PageContent> {
  try {
    const [setting, faqs, testimonials, categorySettings] = await Promise.all([
      db.siteSetting.findUnique({ where: { id: "singleton" } }),
      db.fAQ.findMany({
        where: { published: true },
        orderBy: { order: "asc" },
      }),
      db.testimonial.findMany({
        where: { published: true },
        orderBy: { order: "asc" },
      }),
      db.categorySetting.findMany({
        where: { published: true },
        orderBy: { order: "asc" },
      }),
    ]);

    // Categories: prefer DB settings, fallback to MOCK_CATEGORIES
    const categories: Category[] =
      categorySettings.length > 0
        ? categorySettings.map((c) => ({
            id: c.name,
            name: c.name,
            emoji: c.emoji,
            gradient: c.gradient,
            description: c.description || "",
          }))
        : MOCK_CATEGORIES;

    return {
      ...NULL_CONTENT,
      ...(setting as unknown as Omit<PageContent, "faqs" | "testimonials" | "categories">),
      faqs: faqs.map((f) => ({ id: f.id, q: f.question, a: f.answer })),
      testimonials: testimonials.map((t) => ({
        id: t.id,
        name: t.name,
        role: t.role,
        avatar: t.avatar,
        rating: t.rating,
        text: t.text,
        location: t.location,
      })),
      categories,
    };
  } catch (err) {
    console.error("[getPageContent] failed, using defaults:", err);
    return {
      ...NULL_CONTENT,
      faqs: [],
      testimonials: [],
      categories: MOCK_CATEGORIES,
    };
  }
}
