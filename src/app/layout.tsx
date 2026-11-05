import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { CookieConsent } from "@/components/grocery/cookie-consent";
import { db } from "@/lib/db";

// ============================================================
// Font configuration
// ============================================================
// Primary sans font: Plus Jakarta Sans (Google Fonts).
// Display font (was Fraunces): replaced with Georgia (system
// serif font) to avoid build failures on VPS without internet
// access to fonts.googleapis.com during `next build`.
//
// The --font-display CSS variable is set to a serif font stack
// (Georgia → 'Times New Roman' → serif) so existing components
// that use `font-display` class (hero, contact-section, faq-
// section, testimonials-section) will still render in a serif
// typeface without requiring an external font download.
//
// If you want to restore Fraunces later (when VPS has stable
// internet during build), re-add this import + usage:
//
//   import { Fraunces } from "next/font/google";
//   const fraunces = Fraunces({
//     variable: "--font-fraunces",
//     subsets: ["latin"],
//     weight: ["400", "500", "600", "700", "800", "900"],
//     style: ["normal", "italic"],
//     display: "swap",
//   });
//   // ...and add `${fraunces.variable}` to body className.
// ============================================================

const jakartaSans = Plus_Jakarta_Sans({
  variable: "--font-jakarta-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

// Dynamic metadata from DB (brand name + meta description editable via admin)
export async function generateMetadata(): Promise<Metadata> {
  let brandName = "SayurLogi";
  let metaDescription = "Belanja sayuran dan buah segar langsung dari petani lokal. Antar cepat, kualitas terjamin.";

  try {
    const setting = await db.siteSetting.findUnique({ where: { id: "singleton" } });
    if (setting) {
      if (setting.brandName) brandName = setting.brandName;
      if (setting.metaDescription) metaDescription = setting.metaDescription;
    }
  } catch {
    // Fallback to defaults if DB unavailable
  }

  const title = `${brandName} — Toko Online Sayur & Buah Segar`;
  return {
    title,
    description: metaDescription,
    keywords: ["grocery", "sayur", "buah", "online", "segar", "toko online", "belanja sayur"],
    authors: [{ name: brandName }],
    icons: {
      icon: [
        { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
        { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
      shortcut: "/icon-192.png",
      apple: "/apple-touch-icon.png",
    },
    manifest: "/manifest.json",
    openGraph: {
      title,
      description: metaDescription,
      siteName: brandName,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: metaDescription,
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning className="scroll-smooth">
      <body
        className={`${jakartaSans.variable} antialiased bg-background text-foreground`}
        style={{ "--font-fraunces": "Georgia, 'Times New Roman', serif" } as React.CSSProperties}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
          <SonnerToaster position="top-center" richColors closeButton />
          <CookieConsent />
        </ThemeProvider>
      </body>
    </html>
  );
}
