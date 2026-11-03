import { db } from "@/lib/db";

// ============================================================
// Content fetchers — read admin-editable content from DB.
// ============================================================
// All fetchers return null if DB row missing or field null.
// Section components use these with fallback to hardcoded defaults
// (backward compatible — site works even if DB empty).
// ============================================================

export interface SiteContent {
  // Hero
  heroBadge: string | null;
  heroTitleA: string | null;
  heroTitleHighlight: string | null;
  heroTitleB: string | null;
  heroSubtitle: string | null;
  heroCtaPrimary: string | null;
  heroCtaSecondary: string | null;
  // Promo
  promoId: string | null;
  promoTitle: string | null;
  promoDescription: string | null;
  // Contact
  contactPhone: string | null;
  contactEmail: string | null;
  contactAddress: string | null;
  contactHours: string | null;
  // About
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
  // Footer
  footerBrandText: string | null;
  footerTagline: string | null;
}

const NULL_CONTENT: SiteContent = {
  heroBadge: null,
  heroTitleA: null,
  heroTitleHighlight: null,
  heroTitleB: null,
  heroSubtitle: null,
  heroCtaPrimary: null,
  heroCtaSecondary: null,
  promoId: null,
  promoTitle: null,
  promoDescription: null,
  contactPhone: null,
  contactEmail: null,
  contactAddress: null,
  contactHours: null,
  aboutBadge: null,
  aboutTitleA: null,
  aboutTitleHighlight: null,
  aboutTitleB: null,
  aboutSubtitle: null,
  aboutStoryH3: null,
  aboutStoryP1: null,
  aboutStoryP2: null,
  aboutStat1Value: null,
  aboutStat1Label: null,
  aboutStat2Value: null,
  aboutStat2Label: null,
  aboutStat3Value: null,
  aboutStat3Label: null,
  aboutStat4Value: null,
  aboutStat4Label: null,
  aboutValue1Title: null,
  aboutValue1Desc: null,
  aboutValue2Title: null,
  aboutValue2Desc: null,
  aboutValue3Title: null,
  aboutValue3Desc: null,
  aboutValue4Title: null,
  aboutValue4Desc: null,
  footerBrandText: null,
  footerTagline: null,
};

/** Get singleton site content. Returns nulls for missing fields (fallback). */
export async function getSiteContent(): Promise<SiteContent> {
  try {
    const row = await db.siteSetting.findUnique({ where: { id: "singleton" } });
    if (!row) return NULL_CONTENT;
    return row as unknown as SiteContent;
  } catch (err) {
    console.error("[content] getSiteContent failed:", err);
    return NULL_CONTENT;
  }
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  order: number;
  published: boolean;
}

/** Get all published FAQs ordered by `order` field. Empty array if DB empty. */
export async function getFaqs(): Promise<FaqItem[]> {
  try {
    const rows = await db.fAQ.findMany({
      where: { published: true },
      orderBy: { order: "asc" },
    });
    return rows as unknown as FaqItem[];
  } catch (err) {
    console.error("[content] getFaqs failed:", err);
    return [];
  }
}

export interface TestimonialItem {
  id: string;
  name: string;
  role: string;
  avatar: string;
  rating: number;
  text: string;
  location: string;
  order: number;
  published: boolean;
}

/** Get all published testimonials ordered by `order` field. */
export async function getTestimonials(): Promise<TestimonialItem[]> {
  try {
    const rows = await db.testimonial.findMany({
      where: { published: true },
      orderBy: { order: "asc" },
    });
    return rows as unknown as TestimonialItem[];
  } catch (err) {
    console.error("[content] getTestimonials failed:", err);
    return [];
  }
}

export interface CategoryItem {
  id: string;
  name: string;
  emoji: string;
  description: string | null;
  gradient: string;
  order: number;
  published: boolean;
}

/** Get all published category settings ordered by `order` field. */
export async function getCategorySettings(): Promise<CategoryItem[]> {
  try {
    const rows = await db.categorySetting.findMany({
      where: { published: true },
      orderBy: { order: "asc" },
    });
    return rows as unknown as CategoryItem[];
  } catch (err) {
    console.error("[content] getCategorySettings failed:", err);
    return [];
  }
}
