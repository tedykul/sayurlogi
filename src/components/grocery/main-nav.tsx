"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
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

// ============================================================
// Animation variants for staggered menu items.
// ============================================================
// When the drawer opens, each item slides in from the right with a
// slight delay (cascade effect). This gives a "premium" feel similar
// to native iOS/Android drawer animations.
// ============================================================

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.15,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: 30 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      type: "spring" as const,
      stiffness: 300,
      damping: 24,
    },
  },
};

/**
 * Mobile hamburger menu — opens a Sheet (right-side drawer) with vertical nav.
 * Sheet auto-closes on selection via SheetClose.
 *
 * Animations (Phase 1):
 * 1. Staggered menu items — each item slides in from right with cascade delay
 * 2. Icon morphing — hamburger button morphs from Menu (≡) to X when open
 * 3. Hover/tap micro-interactions — items translate-x + scale on hover/tap
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
      {/* Hamburger button with icon morphing (Menu ≡ → X) */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden h-10 w-10 rounded-full relative"
        onClick={() => setOpen(true)}
        aria-label="Buka menu navigasi"
        aria-expanded={open}
      >
        {/* Icon morphing: Menu icon scales out + rotates, X scales in + rotates.
            AnimatePresence mode="wait" ensures clean swap. */}
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.span
              key="x"
              initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
              animate={{ rotate: 0, opacity: 1, scale: 1 }}
              exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.2 }}
            >
              <X className="h-5 w-5" />
            </motion.span>
          ) : (
            <motion.span
              key="menu"
              initial={{ rotate: 90, opacity: 0, scale: 0.5 }}
              animate={{ rotate: 0, opacity: 1, scale: 1 }}
              exit={{ rotate: -90, opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.2 }}
            >
              <Menu className="h-5 w-5" />
            </motion.span>
          )}
        </AnimatePresence>
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-sm p-0 flex flex-col border-l-2 border-primary/20">
          {/* Sheet header — gradient bg matching brand */}
          <SheetHeader className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-primary/5 to-card px-5 py-5">
            <div className="absolute inset-x-0 top-0 h-1 bg-primary" />
            <SheetTitle className="flex items-center gap-2.5">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/20"
              >
                <Leaf className="h-5 w-5" />
              </motion.div>
              <motion.div
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.15, type: "spring", stiffness: 300, damping: 24 }}
                className="flex flex-col leading-none"
              >
                <span className="text-base font-bold">SayurLogi</span>
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Sayur & Buah Segar</span>
              </motion.div>
              <SheetClose
                className="ml-auto rounded-full p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors ring-1 ring-border/50"
                aria-label="Tutup menu"
              >
                <X className="h-5 w-5" />
              </SheetClose>
            </SheetTitle>
          </SheetHeader>

          {/* Nav items with staggered animation */}
          <motion.nav
            aria-label="Navigasi mobile"
            className="flex-1 overflow-y-auto p-3"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <motion.p
              variants={itemVariants}
              className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground"
            >
              Menu
            </motion.p>
            <ul className="space-y-1">
              {NAV_ITEMS.map((item) => (
                <motion.li key={item.id} variants={itemVariants}>
                  <motion.button
                    onClick={() => handleNavClick(item.id)}
                    whileHover={{ x: 4 }}
                    whileTap={{ scale: 0.97 }}
                    className="group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <motion.span
                      whileHover={{ scale: 1.1 }}
                      className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-lg ring-1 ring-border/50 transition-colors group-hover:bg-primary/10 group-hover:ring-primary/20"
                      aria-hidden="true"
                    >
                      {item.emoji}
                    </motion.span>
                    {item.label}
                  </motion.button>
                </motion.li>
              ))}
            </ul>

            <motion.div variants={itemVariants} className="my-3 h-px bg-border/60" />

            <motion.p
              variants={itemVariants}
              className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground"
            >
              Aksi Cepat
            </motion.p>
            <div className="space-y-1">
              <motion.div variants={itemVariants}>
                <motion.button
                  onClick={handleCartClick}
                  whileHover={{ x: 4 }}
                  whileTap={{ scale: 0.97 }}
                  className="group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-foreground transition-colors hover:bg-accent"
                >
                  <motion.span
                    whileHover={{ scale: 1.1 }}
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/10 transition-colors group-hover:bg-primary/15"
                  >
                    <ShoppingCart className="h-5 w-5" />
                  </motion.span>
                  Keranjang
                  {totalItems > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 400, damping: 15 }}
                      className="ml-auto rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground ring-2 ring-background"
                    >
                      {totalItems}
                    </motion.span>
                  )}
                </motion.button>
              </motion.div>

              <motion.div variants={itemVariants}>
                <motion.button
                  onClick={handleWishlistClick}
                  whileHover={{ x: 4 }}
                  whileTap={{ scale: 0.97 }}
                  className="group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-foreground transition-colors hover:bg-accent"
                >
                  <motion.span
                    whileHover={{ scale: 1.1 }}
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500/10 text-rose-500 ring-1 ring-rose-500/10 transition-colors group-hover:bg-rose-500/15"
                  >
                    <Heart className={`h-5 w-5 ${wishlistCount > 0 ? "fill-rose-500" : ""}`} />
                  </motion.span>
                  Wishlist
                  {wishlistCount > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 400, damping: 15 }}
                      className="ml-auto rounded-full bg-rose-500 px-2 py-0.5 text-xs font-bold text-white ring-2 ring-background"
                    >
                      {wishlistCount}
                    </motion.span>
                  )}
                </motion.button>
              </motion.div>

              <motion.div
                variants={itemVariants}
                className="group flex items-center gap-3 rounded-xl px-3 py-3"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-foreground ring-1 ring-border/50">
                  <ThemeToggle />
                </span>
                <span className="text-sm font-medium text-foreground">Ganti Tema</span>
              </motion.div>
            </div>
          </motion.nav>

          {/* Sheet footer — trust strip */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4, type: "spring", stiffness: 300, damping: 24 }}
            className="border-t border-border/60 bg-secondary/30 px-5 py-4"
          >
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Leaf className="h-3.5 w-3.5 text-primary" />
              <span className="font-medium text-foreground">SayurLogi</span>
              <span className="text-muted-foreground/60">·</span>
              <span>Petani lokal 🌱</span>
            </div>
          </motion.div>
        </SheetContent>
      </Sheet>
    </>
  );
}
