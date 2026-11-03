"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cookie, X } from "lucide-react";
import { Button } from "@/components/ui/button";

// ============================================================
// CookieConsent — slim bottom-sheet banner (GDPR-style).
// ============================================================
// Shows on first visit only. User can Accept or Decline. Choice
// persists in localStorage (key: cookie-consent-v1). Once decided,
// banner stays hidden until key changes (e.g., policy update).
//
// Design: full-width slim bar anchored to bottom, slides up from
// below viewport. Does NOT obstruct product grid like a modal would.
// Mount once in root layout. No props required.
// ============================================================

const STORAGE_KEY = "cookie-consent-v1";

type ConsentChoice = "accepted" | "declined";

function readConsent(): ConsentChoice | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "accepted" || stored === "declined") return stored;
    return null;
  } catch {
    return null;
  }
}

export function CookieConsent() {
  // Start with null (hidden) on SSR & first paint. After mount, read
  // localStorage to check if user already consented. This avoids
  // hydration mismatch (server & client both render null initially).
  const [choice, setChoice] = useState<ConsentChoice | null>(null);
  const [mounted, setMounted] = useState(false);

  // Sync with localStorage after mount — legitimate external system sync.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const stored = readConsent();
    setChoice(stored);
    setMounted(true);

    // Auto-dismiss after 6 seconds on mobile (reduces obstruction)
    if (!stored) {
      const timer = setTimeout(() => {
        setChoice("accepted");
        try { localStorage.setItem(STORAGE_KEY, "accepted"); } catch {}
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const persist = (value: ConsentChoice) => {
    setChoice(value);
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // ignore storage errors
    }
  };

  // Show banner only after mount & if no choice made yet (null = first visit).
  const showBanner = mounted && choice === null;

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="fixed bottom-16 left-0 right-0 z-50 md:bottom-0"
          role="dialog"
          aria-label="Pemberitahuan cookie"
          aria-live="polite"
        >
          {/* Full-width slim bar — no max-w constraint, no card shadow ring.
              Mobile: single column. Desktop: 3-column row (icon | text | actions). */}
          <div className="border-t border-border/60 bg-card/95 backdrop-blur-lg supports-[backdrop-filter]:bg-card/85 shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.1)]">
            <div className="mx-auto max-w-7xl px-4 py-2.5 md:py-3.5">
              {/* Mobile: ultra-compact single row */}
              <div className="flex items-center gap-2 md:hidden">
                <span className="flex-1 text-[11px] font-medium text-foreground/70 leading-tight">
                  Cookie untuk pengalaman terbaik
                </span>
                <button
                  onClick={() => persist("declined")}
                  className="shrink-0 rounded-full px-3 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                >
                  Tolak
                </button>
                <button
                  onClick={() => persist("accepted")}
                  className="shrink-0 rounded-full bg-primary px-4 py-1.5 text-[11px] font-medium text-primary-foreground shadow-sm"
                >
                  Setuju
                </button>
              </div>
              {/* Desktop: full 3-column row */}
              <div className="hidden md:flex md:items-center md:gap-4">
                {/* Icon + text — inline on mobile, row on desktop */}
                <div className="flex items-start gap-2.5 md:flex-1 md:min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary md:h-9 md:w-9">
                    <Cookie className="h-4 w-4 md:h-4.5 md:w-4.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[13px] font-semibold leading-tight">
                      Kami menggunakan cookie untuk pengalaman terbaik
                    </h3>
                    <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug md:text-xs">
                      Simpan keranjang, wishlist & preferensi.{" "}
                      <a
                        href="#faq"
                        onClick={(e) => {
                          e.preventDefault();
                          document.getElementById("faq")?.scrollIntoView({ behavior: "smooth" });
                        }}
                        className="font-medium text-primary hover:underline"
                      >
                        Pelajari lebih lanjut
                      </a>
                    </p>
                  </div>
                </div>

                {/* Actions — row on mobile, shrink on desktop */}
                <div className="flex shrink-0 items-center gap-2 md:gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => persist("declined")}
                    className="h-8 rounded-full px-3 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Tolak
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => persist("accepted")}
                    className="h-8 rounded-full px-4 text-xs shadow-sm"
                  >
                    Setuju
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
