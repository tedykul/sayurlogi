"use client";

import { useState, useEffect } from "react";
import { Sparkles, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface PromoBannerProps {
  /** Unique ID for this promo. Changing it resets dismiss state. */
  promoId?: string;
  /** Headline text (bold). */
  title?: string;
  /** Body text (muted). */
  description?: string;
  /** Optional emoji/icon to show before the title. */
  icon?: React.ReactNode;
}

/**
 * Read dismiss state from localStorage lazily on first client render.
 * Returns false (visible) during SSR — server-rendered HTML shows banner
 * by default. After hydration, the lazy useState initializer reads actual
 * localStorage value, so dismissed users see it hide on first paint.
 *
 * Note: this may cause a brief flash for dismissed users, but avoids
 * hydration mismatch (server & client must render same initial HTML).
 */
function readDismissed(promoId: string): boolean {
  if (typeof window === "undefined") return false; // SSR: visible by default
  try {
    return localStorage.getItem(`promo-dismissed-${promoId}`) === "1";
  } catch {
    return false;
  }
}

/**
 * Dismissible promo banner. Once dismissed, stays hidden until the
 * `promoId` changes (e.g., new promo campaign) — stored in localStorage
 * so dismiss persists across sessions.
 *
 * Default content matches the previous inline banner for backward compat.
 */
export function PromoBanner({
  promoId = "promo-akhir-pekan-v1",
  title = "Promo Akhir Pekan!",
  description = "Diskon hingga 25% untuk semua sayuran organik. Berlaku sampai akhir minggu.",
  icon,
}: PromoBannerProps) {
  // Lazy initializer reads localStorage once on first client render.
  // SSR returns false (visible) so server-rendered HTML includes banner.
  // After hydration, useState lazy init runs and may flip to true (hidden)
  // if user previously dismissed — React tolerates this single update.
  const [dismissed, setDismissed] = useState(() => readDismissed(promoId));

  // Subscribe to cross-tab storage events so dismiss syncs between tabs.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === `promo-dismissed-${promoId}`) {
        setDismissed(e.newValue === "1");
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [promoId]);

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(`promo-dismissed-${promoId}`, "1");
    } catch {
      // ignore storage errors (private mode, quota exceeded, etc.)
    }
  };

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          id="promo"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
          className="overflow-hidden border-b border-orange-200/40 bg-gradient-to-r from-orange-500/10 via-amber-400/10 to-orange-500/10 scroll-mt-24"
        >
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-2 px-4 py-2.5 text-center text-sm pr-10 relative">
            {icon ?? <Sparkles className="h-4 w-4 text-orange-500 shrink-0" />}
            <span className="font-bold text-orange-700 dark:text-orange-400">{title}</span>
            <span className="hidden sm:inline text-muted-foreground">{description}</span>
            <span className="inline-flex items-center rounded-full bg-orange-500 px-2 py-0.5 text-xs font-bold text-white shadow-sm">
              25% OFF
            </span>
            <button
              onClick={handleDismiss}
              className="absolute right-2 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-all hover:bg-background hover:text-foreground active:scale-90"
              aria-label="Tutup promo"
              title="Tutup promo"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
