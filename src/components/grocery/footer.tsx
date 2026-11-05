"use client";

import { useState } from "react";
import { Leaf, Mail, Phone, MapPin, Facebook, Instagram, Twitter, ArrowUp, Send, Clock, ShieldCheck, Truck, CreditCard, ChevronDown, ChevronRight, HelpCircle } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { NewsletterForm } from "./newsletter-form";
import { cn } from "@/lib/utils";

interface FooterProps {
  /** Admin-editable content from DB. Null fields fall back to defaults. */
  content?: {
    footerBrandText: string | null;
    footerTagline: string | null;
    contactPhone: string | null;
    contactEmail: string | null;
    contactAddress: string | null;
    contactHours: string | null;
    brandName: string | null;
    socialInstagram: string | null;
    socialFacebook: string | null;
    socialTwitter: string | null;
    socialTiktok: string | null;
    socialWhatsapp: string | null;
  };
  /** Open order tracking dialog. */
  onTrackOrder?: () => void;
  /** Open order history dialog. */
  onOrderHistory?: () => void;
}

// Trust badges row — small visual proof of reliability
const TRUST_BADGES = [
  { icon: ShieldCheck, label: "100% Segar" },
  { icon: Truck, label: "Antar 2 Jam" },
  { icon: CreditCard, label: "Pembayaran Aman" },
];

// Payment methods — branded SVG logos from /public/payments/
const PAYMENT_METHODS = [
  { logo: "/payments/cod.svg", label: "COD" },
  { logo: "/payments/bca.svg", label: "BCA" },
  { logo: "/payments/mandiri.svg", label: "Mandiri" },
  { logo: "/payments/bni.svg", label: "BNI" },
  { logo: "/payments/bri.svg", label: "BRI" },
  { logo: "/payments/gopay.svg", label: "GoPay" },
  { logo: "/payments/ovo.svg", label: "OVO" },
  { logo: "/payments/dana.svg", label: "DANA" },
  { logo: "/payments/shopeepay.svg", label: "ShopeePay" },
];

/**
 * Footer — bottom of page.
 * Mobile: accordion collapsible sections (reduces cognitive load, bigger touch targets)
 * Desktop: 4-column grid (more real estate, no accordion needed)
 */
export function Footer({ content, onTrackOrder, onOrderHistory }: FooterProps = {}) {
  const brandName = content?.brandName ?? "SayurLogi";
  // Shortened brand text for mobile (1 line vs 3)
  const brandTextLong = content?.footerBrandText ?? "Marketplace sayur & buah segar langsung dari petani lokal. Mendukung ekonomi petani Indonesia.";
  const brandTextShort = "Sayur & buah segar dari petani lokal.";
  const tagline = content?.footerTagline ?? "Sayur & Buah Segar";
  const phone = content?.contactPhone ?? "0800-1234-5678";
  const email = content?.contactEmail ?? "halo@sayurlogi.id";
  const address = content?.contactAddress ?? "Jl. Petani Sejahtera No. 88, Jakarta Selatan";
  const hours = content?.contactHours ?? "Setiap hari, 08.00 - 21.00 WIB";

  // Accordion state (mobile only)
  const [openSection, setOpenSection] = useState<string | null>("bantuan");

  const toggleSection = (section: string) => {
    setOpenSection(openSection === section ? null : section);
  };

  // Social links — activate if URL provided, otherwise show disabled
  const socialLinks = [
    { Icon: Facebook, label: "Facebook", url: content?.socialFacebook },
    { Icon: Instagram, label: "Instagram", url: content?.socialInstagram },
    { Icon: Twitter, label: "Twitter", url: content?.socialTwitter },
  ].filter((s) => s.url);

  const handleNavClick = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    const el = document.getElementById(id);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="mt-auto border-t border-border/60 bg-secondary/30">
      {/* ============ Newsletter strip — elevated card (desktop only, mobile hidden for lighter footer) ============ */}
      <div className="hidden md:block mx-auto max-w-7xl px-4 pt-8">
        <p className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">Newsletter</p>
        <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-card p-5 ring-1 ring-primary/20 shadow-[0_2px_4px_rgba(0,0,0,0.05),0_8px_24px_-8px_rgba(0,0,0,0.18)] md:p-6">
          <div className="absolute inset-x-0 top-0 h-1.5 bg-primary" />
          <div className="grid items-center gap-4 md:grid-cols-2">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-inset ring-primary/20">
                <Send className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold md:text-lg">Dapatkan Promo & Tips Sehat 🌱</h3>
                <p className="mt-0.5 text-sm text-foreground/70">
                  Berlangganan newsletter untuk info diskon, resep sehat, dan tips pilih sayur segar.
                </p>
              </div>
            </div>
            <NewsletterForm />
          </div>
        </div>
      </div>

      {/* ============ Brand section — compact elevated card (mobile) ============ */}
      <div className="mx-auto max-w-7xl px-4 pt-4 pb-3 md:pt-10 md:pb-6">
        {/* Mobile: single compact brand card — logo + trust badges inline */}
        <div className="md:hidden">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-card via-card to-muted/50 p-3.5 ring-1 ring-border shadow-[0_2px_4px_rgba(0,0,0,0.05),0_8px_24px_-8px_rgba(0,0,0,0.18)]">
            <div className="absolute inset-x-0 top-0 h-1 bg-primary" />
            <div className="flex items-center gap-2.5 mb-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                <Leaf className="h-4.5 w-4.5" />
              </div>
              <div className="flex-1">
                <span className="text-base font-bold block leading-tight">{brandName}</span>
                <span className="text-xs uppercase tracking-wider text-muted-foreground">{tagline}</span>
              </div>
              {/* Trust badges inline right */}
              <div className="flex gap-1">
                {TRUST_BADGES.map((badge) => {
                  const Icon = badge.icon;
                  return (
                    <span key={badge.label} className="flex items-center justify-center rounded-md bg-primary/10 px-1.5 py-1 text-primary ring-1 ring-inset ring-primary/10" title={badge.label}>
                      <Icon className="h-3 w-3" />
                    </span>
                  );
                })}
              </div>
            </div>
            <p className="text-xs text-foreground/60">{brandTextShort}</p>
          </div>
        </div>

        {/* Desktop brand — full description */}
        <div className="hidden md:block space-y-4">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Leaf className="h-5 w-5" />
            </div>
            <div>
              <span className="text-lg font-bold block leading-tight">{brandName}</span>
              <span className="text-xs uppercase tracking-wider text-muted-foreground">{tagline}</span>
            </div>
          </div>
          <p className="text-sm text-foreground/70 leading-relaxed">{brandTextLong}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            {TRUST_BADGES.map((badge) => {
              const Icon = badge.icon;
              return (
                <span key={badge.label} className="inline-flex items-center gap-1 rounded-full bg-card px-2.5 py-1 text-xs font-semibold text-foreground ring-1 ring-border/50">
                  <Icon className="h-3 w-3 text-primary" />
                  {badge.label}
                </span>
              );
            })}
          </div>
          {socialLinks.length > 0 && (
            <div className="flex gap-2 pt-1">
              {socialLinks.map(({ Icon, label, url }) => (
                <a key={label} href={url!} target="_blank" rel="noopener noreferrer" aria-label={`${brandName} di ${label}`} title={label} className="flex h-10 w-10 items-center justify-center rounded-full bg-card text-muted-foreground ring-1 ring-border/50 transition-all hover:bg-primary hover:text-primary-foreground hover:ring-primary hover:-translate-y-0.5">
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ============ Mobile: Single unified card for Bantuan + Hubungi Kami ============ */}
      <div className="mx-auto max-w-7xl px-4 md:hidden space-y-3 pb-4">
        {/* Unified help + contact card */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-card via-card to-muted/50 ring-1 ring-border shadow-[0_2px_4px_rgba(0,0,0,0.05),0_8px_24px_-8px_rgba(0,0,0,0.18)]">
          <div className="absolute inset-y-0 left-0 w-1 bg-primary" />

          {/* Bantuan section (collapsible) */}
          <button
            onClick={() => toggleSection("bantuan")}
            className="flex w-full items-center gap-2.5 py-3.5 pl-4 pr-4 text-left active:scale-[0.99] transition-transform"
            aria-expanded={openSection === "bantuan"}
          >
            <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors", openSection === "bantuan" ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground")}>
              <HelpCircle className="h-4 w-4" />
            </span>
            <span className={cn("text-sm font-bold transition-colors", openSection === "bantuan" ? "text-foreground" : "text-foreground/80")}>Bantuan</span>
            <ChevronDown className={cn("ml-auto h-4 w-4 transition-all duration-300", openSection === "bantuan" ? "rotate-180 text-primary" : "text-muted-foreground")} />
          </button>
          {openSection === "bantuan" && (
            <div className="px-4 pb-1">
              {[
                { label: "Cara Pemesanan", id: "faq" },
                { label: "Kebijakan Pengiriman", id: "faq" },
                { label: "Pembayaran", id: "faq" },
                { label: "Refund & Retur", id: "faq" },
                { label: "Layanan Pelanggan", id: "kontak" },
              ].map((item) => (
                <a key={item.label} href={`#${item.id}`} onClick={handleNavClick(item.id)} className="flex items-center justify-between py-2.5 text-sm text-foreground/70 active:bg-accent/50 active:scale-[0.98] transition-all rounded-lg px-2 -mx-2">
                  <span>{item.label}</span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
                </a>
              ))}
              {onTrackOrder && (
                <button onClick={onTrackOrder} className="flex w-full items-center justify-between py-2.5 text-sm text-foreground/70 active:bg-accent/50 active:scale-[0.98] transition-all rounded-lg px-2 -mx-2">
                  <span>Lacak Pesanan</span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
                </button>
              )}
              {onOrderHistory && (
                <button onClick={onOrderHistory} className="flex w-full items-center justify-between py-2.5 text-sm text-foreground/70 active:bg-accent/50 active:scale-[0.98] transition-all rounded-lg px-2 -mx-2">
                  <span>Riwayat Pesanan</span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
                </button>
              )}
            </div>
          )}

          {/* Divider between sections */}
          <div className="mx-4 h-px bg-border/40" />

          {/* Hubungi Kami section (collapsible) */}
          <button
            onClick={() => toggleSection("kontak")}
            className="flex w-full items-center gap-2.5 py-3.5 pl-4 pr-4 text-left active:scale-[0.99] transition-transform"
            aria-expanded={openSection === "kontak"}
          >
            <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors", openSection === "kontak" ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground")}>
              <Phone className="h-4 w-4" />
            </span>
            <span className={cn("text-sm font-bold transition-colors", openSection === "kontak" ? "text-foreground" : "text-foreground/80")}>Hubungi Kami</span>
            <ChevronDown className={cn("ml-auto h-4 w-4 transition-all duration-300", openSection === "kontak" ? "rotate-180 text-primary" : "text-muted-foreground")} />
          </button>
          {openSection === "kontak" && (
            <div className="px-4 pb-3">
              <a href={`tel:${phone.replace(/[^0-9+]/g, "")}`} className="flex items-center gap-3 py-2.5 text-sm text-foreground/70 active:bg-accent/50 active:scale-[0.98] transition-all rounded-lg px-2 -mx-2">
                <Phone className="h-3.5 w-3.5 text-primary shrink-0" />
                <span>{phone}</span>
              </a>
              <a href={`mailto:${email}`} className="flex items-center gap-3 py-2.5 text-sm text-foreground/70 active:bg-accent/50 active:scale-[0.98] transition-all rounded-lg px-2 -mx-2">
                <Mail className="h-3.5 w-3.5 text-primary shrink-0" />
                <span>{email}</span>
              </a>
              <div className="flex items-start gap-3 py-2.5 text-sm text-foreground/70 px-2 -mx-2">
                <MapPin className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                <span>{address}</span>
              </div>
              <div className="flex items-center gap-3 py-2.5 text-sm text-foreground/70 px-2 -mx-2">
                <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
                <span>{hours}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ============ Desktop: 4-column grid ============ */}
      <div className="hidden mx-auto max-w-7xl px-4 pb-8 md:block">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-foreground">Navigasi</h4>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li><a href="#beranda" onClick={handleNavClick("beranda")} className="block py-1.5 hover:text-primary hover:translate-x-1 transition-all">Beranda</a></li>
              <li><a href="#belanja" onClick={handleNavClick("belanja")} className="block py-1.5 hover:text-primary hover:translate-x-1 transition-all">Belanja Produk</a></li>
              <li><a href="#tentang" onClick={handleNavClick("tentang")} className="block py-1.5 hover:text-primary hover:translate-x-1 transition-all">Tentang Kami</a></li>
              <li><a href="#faq" onClick={handleNavClick("faq")} className="block py-1.5 hover:text-primary hover:translate-x-1 transition-all">FAQ</a></li>
              <li><a href="#kontak" onClick={handleNavClick("kontak")} className="block py-1.5 hover:text-primary hover:translate-x-1 transition-all">Hubungi Kami</a></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-foreground">Bantuan</h4>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li><a href="#faq" onClick={handleNavClick("faq")} className="block py-1.5 hover:text-primary hover:translate-x-1 transition-all">Cara Pemesanan</a></li>
              <li><a href="#faq" onClick={handleNavClick("faq")} className="block py-1.5 hover:text-primary hover:translate-x-1 transition-all">Kebijakan Pengiriman</a></li>
              <li><a href="#faq" onClick={handleNavClick("faq")} className="block py-1.5 hover:text-primary hover:translate-x-1 transition-all">Pembayaran</a></li>
              <li><a href="#faq" onClick={handleNavClick("faq")} className="block py-1.5 hover:text-primary hover:translate-x-1 transition-all">Refund & Retur</a></li>
              <li><a href="#kontak" onClick={handleNavClick("kontak")} className="block py-1.5 hover:text-primary hover:translate-x-1 transition-all">Customer Service</a></li>
              {onTrackOrder && (
                <li><button onClick={onTrackOrder} className="block w-full text-left py-1.5 hover:text-primary hover:translate-x-1 transition-all">📦 Lacak Pesanan</button></li>
              )}
              {onOrderHistory && (
                <li><button onClick={onOrderHistory} className="block w-full text-left py-1.5 hover:text-primary hover:translate-x-1 transition-all">📋 Riwayat Pesanan</button></li>
              )}
            </ul>
          </div>
          <div>
            <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-foreground">Hubungi Kami</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-primary shrink-0" />
                <a href={`tel:${phone.replace(/[^0-9+]/g, "")}`} className="hover:text-primary transition-colors">{phone}</a>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary shrink-0" />
                <a href={`mailto:${email}`} className="hover:text-primary transition-colors">{email}</a>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>{address}</span>
              </li>
              <li className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary shrink-0" />
                <span>{hours}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* ============ Payment methods — 3-column grid, branded logos (mobile + desktop) ============ */}
      <div className="mx-auto max-w-7xl px-4 pb-4">
        {/* Mobile: 3-column grid of branded logo chips */}
        <div className="md:hidden">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-card via-card to-muted/50 p-3.5 ring-1 ring-border shadow-[0_2px_4px_rgba(0,0,0,0.05),0_8px_24px_-8px_rgba(0,0,0,0.18)]">
            <div className="absolute inset-x-0 top-0 h-1 bg-primary" />
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <CreditCard className="h-3 w-3 text-primary" />
              Metode Pembayaran
            </p>
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_METHODS.map((m) => (
                <div
                  key={m.label}
                  className="flex items-center justify-center gap-1.5 rounded-md bg-background px-2 py-2 ring-1 ring-border/60 shadow-sm"
                  title={m.label}
                >
                  <Image
                    src={m.logo}
                    alt={m.label}
                    width={28}
                    height={20}
                    className="h-5 w-auto"
                    unoptimized
                  />
                  <span className="text-xs font-bold text-foreground">{m.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Desktop: elevated card with 3-column grid of branded logos */}
        <div className="hidden md:block rounded-2xl bg-gradient-to-br from-card via-card to-muted p-4 ring-1 ring-border shadow-[0_2px_4px_rgba(0,0,0,0.05),0_8px_24px_-8px_rgba(0,0,0,0.18)]">
          <div className="flex items-center gap-2 mb-3">
            <CreditCard className="h-4 w-4 text-primary" />
            <span className="text-xs font-bold uppercase tracking-wider text-foreground">Metode Pembayaran</span>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-9">
            {PAYMENT_METHODS.map((m) => (
              <div
                key={m.label}
                className="flex items-center justify-center gap-1.5 rounded-md bg-background px-2.5 py-2 ring-1 ring-border shadow-sm"
                title={m.label}
              >
                <Image
                  src={m.logo}
                  alt={m.label}
                  width={32}
                  height={22}
                  className="h-5 w-auto"
                  unoptimized
                />
                <span className="text-xs font-bold text-foreground">{m.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ============ Bottom bar — copyright + legal (no tech credits) ============ */}
      <div className="border-t border-border/60 bg-secondary/50">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-3.5 text-xs text-muted-foreground sm:flex-row md:py-4">
          <p className="text-center sm:text-left">© {new Date().getFullYear()} {brandName}. Semua hak dilindungi.</p>
          <div className="flex items-center gap-3">
            <a href="#faq" onClick={handleNavClick("faq")} className="hover:text-primary transition-colors">
              Syarat
            </a>
            <span className="text-border">·</span>
            <a href="#faq" onClick={handleNavClick("faq")} className="hover:text-primary transition-colors">
              Privasi
            </a>
            <Button variant="ghost" size="icon" onClick={scrollToTop} className="h-7 w-7 rounded-full hover:bg-primary hover:text-primary-foreground" aria-label="Kembali ke atas" title="Kembali ke atas">
              <ArrowUp className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ============ Mobile elevated card component (native app feel) ============
function MobileCard({
  title,
  icon,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl bg-gradient-to-br from-card via-card to-muted/50 ring-1 transition-all duration-300",
        isOpen
          ? "ring-primary/30 shadow-[0_2px_4px_rgba(0,0,0,0.05),0_8px_24px_-8px_rgba(0,0,0,0.18)]"
          : "ring-border shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
      )}
    >
      {/* Left accent bar — brand green, visible when open */}
      <div className={cn(
        "absolute inset-y-0 left-0 w-1 transition-colors",
        isOpen ? "bg-primary" : "bg-transparent"
      )} />
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2.5 py-4 pl-4 pr-4 text-left active:scale-[0.99] transition-transform"
        aria-expanded={isOpen}
      >
        <span className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors",
          isOpen ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"
        )}>
          {icon}
        </span>
        <span className={cn(
          "text-sm font-bold transition-colors",
          isOpen ? "text-foreground" : "text-foreground/80"
        )}>
          {title}
        </span>
        <ChevronDown className={cn(
          "ml-auto h-4 w-4 transition-all duration-300",
          isOpen ? "rotate-180 text-primary" : "text-muted-foreground"
        )} />
      </button>
      {isOpen && (
        <div className="px-4 pb-2">
          {children}
        </div>
      )}
    </div>
  );
}
