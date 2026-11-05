import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { CookieConsent } from "@/components/grocery/cookie-consent";
import { db } from "@/lib/db";

// ============================================================
// Font configuration — ALL system fonts (no Google Fonts).
// ============================================================
// VPS build fails when next/font/google tries to download fonts
// from fonts.googleapis.com during `next build`. The Turbopack
// font resolver errors with:
//   "Module not found: Can't resolve
//    '@vercel/turbopack-next/internal/font/google/font'"
//
// Fix: removed ALL next/font/google imports (Plus Jakarta Sans +
// Fraunces). Replaced with CSS variables set inline on <body>:
//   --font-jakarta-sans → system sans-serif stack (Arial → sans)
//   --font-fraunces → system serif stack (Georgia → serif)
//
// Visual impact: minimal. System fonts are still high-quality on
// modern OS (Arial/Georgia render crisply). Components using
// `font-sans` and `font-display` classes still work via CSS vars.
//
// To restore Google Fonts later (when VPS has stable internet):
//   1. Re-add: import { Plus_Jakarta_Sans } from "next/font/google";
//   2. Configure + add variable to body className.
//   3. Remove the inline style below.
// ============================================================

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
        className="antialiased bg-background text-foreground"
        style={{
          "--font-jakarta-sans": "Arial, 'Helvetica Neue', Helvetica, sans-serif",
          "--font-fraunces": "Georgia, 'Times New Roman', serif",
        } as React.CSSProperties}
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
