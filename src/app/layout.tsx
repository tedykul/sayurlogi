import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SayurLogi — Toko Online Sayur & Buah Segar",
  description: "Belanja sayuran dan buah segar langsung dari petani lokal. Antar cepat, kualitas terjamin. Pakai kupon diskon dari WhatsApp!",
  keywords: ["grocery", "sayur", "buah", "online", "segar", "kupon", "diskon"],
  authors: [{ name: "SayurLogi" }],
  icons: { icon: "/logo.svg" },
  openGraph: {
    title: "SayurLogi",
    description: "Belanja sayur & buah segar + kupon diskon",
    siteName: "SayurLogi",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" suppressHydrationWarning className="scroll-smooth">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
        <SonnerToaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
