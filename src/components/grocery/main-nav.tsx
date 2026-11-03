"use client";

import { useState, useCallback } from "react";
import { Menu, X, Leaf, ShoppingCart, Sun, Moon, Heart } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/lib/store/cart";
import { useWishlistStore } from "@/lib/store/wishlist";
import { useTheme } from "next-themes";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * Navigation items — anchor links to sections on the same page.
 * Convention: id must match the `id` attribute on the target <section>.
 */
export const NAV_ITEMS: { id: string; label: string; emoji: string }[] = [
  { id: "beranda", label: "Beranda", emoji: "🏠" },
  { id: "belanja", label: "Belanja", emoji: "🛒" },
  { id: "tentang", label: "Tentang", emoji: "🌱" },
  { id: "faq", label: "FAQ", emoji: "❓" },
  { id: "kontak", label: "Kontak", emoji: "✉️" },
];

interface MainNavProps {
  /** Called after a nav item is clicked (e.g., to close mobile menu, clear search). */
  onNavigate?: (sectionId: string) => void;
}

/**
 * Desktop navigation — horizontal links, hidden on mobile.
 * Uses anchor links (#id) for smooth scroll, with scroll-margin-top
 * handled by `scroll-mt-24` on each target section.
 */
export function MainNav({ onNavigate }: MainNavProps) {
  const handleClick = useCallback(
    (id: string) => (e: React.MouseEvent) => {
      e.preventDefault();
      const el = document.getElementById(id);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
      onNavigate?.(id);
    },
    [onNavigate]
  );

  return (
    <nav
      aria-label="Navigasi utama"
      className="hidden md:flex items-center gap-1"
    >
      {NAV_ITEMS.map((item) => (
        <a
          key={item.id}
          href={`#${item.id}`}
          onClick={handleClick(item.id)}
          className="rounded-full px-3.5 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}

/**
 * Mobile hamburger menu — opens a Sheet (right-side drawer) with vertical nav.
 * Sheet auto-closes on selection via SheetClose.
 */
export function MobileNav({ onNavigate }: MainNavProps) {
  const [open, setOpen] = useState(false);
  const totalItems = useCartStore((s) => s.getTotalItems());
  const openCart = useCartStore((s) => s.openCart);
  const wishlistCount = useWishlistStore((s) => s.getCount());
  const openWishlist = useWishlistStore((s) => s.openWishlist);

  const handleNavClick = (id: string) => {
    setOpen(false);
    // Defer scroll until sheet close animation begins
    setTimeout(() => {
      const el = document.getElementById(id);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
      onNavigate?.(id);
    }, 100);
  };

  const handleCartClick = () => {
    setOpen(false);
    setTimeout(() => openCart(), 100);
  };

  const handleWishlistClick = () => {
    setOpen(false);
    setTimeout(() => openWishlist(), 100);
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="hidden h-10 w-10 rounded-full"
        onClick={() => setOpen(true)}
        aria-label="Buka menu navigasi"
        aria-expanded={open}
      >
        <Menu className="h-5 w-5" />
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-sm p-0 flex flex-col border-l-2 border-primary/20">
          {/* Sheet header — gradient bg matching brand */}
          <SheetHeader className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-primary/5 to-card px-5 py-5">
            <div className="absolute inset-x-0 top-0 h-1 bg-primary" />
            <SheetTitle className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/20">
                <Leaf className="h-5 w-5" />
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-base font-bold">SayurLogi</span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Sayur & Buah Segar</span>
              </div>
              <SheetClose
                className="ml-auto rounded-full p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors ring-1 ring-border/50"
                aria-label="Tutup menu"
              >
                <X className="h-5 w-5" />
              </SheetClose>
            </SheetTitle>
          </SheetHeader>

          <nav aria-label="Navigasi mobile" className="flex-1 overflow-y-auto p-3">
            <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Menu</p>
            <ul className="space-y-1">
              {NAV_ITEMS.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => handleNavClick(item.id)}
                    className="group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-foreground transition-all hover:bg-accent hover:translate-x-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-lg ring-1 ring-border/50 transition-colors group-hover:bg-primary/10 group-hover:ring-primary/20" aria-hidden="true">{item.emoji}</span>
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>

            <div className="my-3 h-px bg-border/60" />

            <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Aksi Cepat</p>
            <div className="space-y-1">
              <button
                onClick={handleCartClick}
                className="group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-foreground transition-all hover:bg-accent hover:translate-x-1"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/10 transition-colors group-hover:bg-primary/15">
                  <ShoppingCart className="h-5 w-5" />
                </span>
                Keranjang
                {totalItems > 0 && (
                  <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground ring-2 ring-background">
                    {totalItems}
                  </span>
                )}
              </button>

              <button
                onClick={handleWishlistClick}
                className="group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-foreground transition-all hover:bg-accent hover:translate-x-1"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500/10 text-rose-500 ring-1 ring-rose-500/10 transition-colors group-hover:bg-rose-500/15">
                  <Heart className={`h-5 w-5 ${wishlistCount > 0 ? "fill-rose-500" : ""}`} />
                </span>
                Wishlist
                {wishlistCount > 0 && (
                  <span className="ml-auto rounded-full bg-rose-500 px-2 py-0.5 text-xs font-bold text-white ring-2 ring-background">
                    {wishlistCount}
                  </span>
                )}
              </button>

              <div className="group flex items-center gap-3 rounded-xl px-3 py-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-foreground ring-1 ring-border/50">
                  <ThemeToggle />
                </span>
                <span className="text-sm font-medium text-foreground">Ganti Tema</span>
              </div>
            </div>
          </nav>

          {/* Sheet footer — trust strip */}
          <div className="border-t border-border/60 bg-secondary/30 px-5 py-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Leaf className="h-3.5 w-3.5 text-primary" />
              <span className="font-medium text-foreground">SayurLogi</span>
              <span className="text-muted-foreground/60">·</span>
              <span>Petani lokal 🌱</span>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
