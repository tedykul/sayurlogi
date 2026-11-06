"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight } from "lucide-react";

// ============================================================
// WelcomeBanner — full-screen modal shown on first visit.
// ============================================================
// Behavior:
//   - Shows when welcomeBannerEnabled = true AND user hasn't
//     dismissed this version yet (tracked in localStorage).
//   - Dismiss persists in localStorage keyed by welcomeBannerVersion.
//     Changing the version (via admin) resets dismiss state so
//     the banner reappears for all users.
//   - User can close via X button or clicking backdrop.
//   - Optional CTA button (link to promo/product page).
//
// Backward compatible: when welcomeBannerEnabled is null/false,
// the banner is not rendered at all (existing behavior).
// ============================================================

export interface WelcomeBannerContent {
  enabled: boolean | null;
  image: string | null;
  title: string | null;
  description: string | null;
  ctaText: string | null;
  ctaLink: string | null;
  version: string | null;
}

interface WelcomeBannerProps {
  content: WelcomeBannerContent;
}

const STORAGE_KEY_PREFIX = "welcome-banner-dismissed-";

function isDismissed(version: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEY_PREFIX + version) === "1";
  } catch {
    return false;
  }
}

function setDismissed(version: string) {
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + version, "1");
  } catch {
    // ignore storage errors
  }
}

export function WelcomeBanner({ content }: WelcomeBannerProps) {
  const version = content.version || "v1";
  const [show, setShow] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check if banner should show:
    // - enabled must be true
    // - must have an image
    // - must NOT be dismissed for this version
    if (
      content.enabled &&
      content.image &&
      !isDismissed(version)
    ) {
      setShow(true);
    }
  }, [content.enabled, content.image, version]);

  const handleClose = () => {
    setShow(false);
    setDismissed(version);
  };

  const handleCtaClick = () => {
    // Mark as dismissed so it doesn't show again after CTA click
    setDismissed(version);
    setShow(false);
    // If CTA link exists, navigate to it
    if (content.ctaLink) {
      window.location.href = content.ctaLink;
    }
  };

  // Don't render until mounted (avoid hydration mismatch)
  // Don't render if banner is disabled or has no image
  if (!mounted || !content.enabled || !content.image || !show) {
    return null;
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={handleClose}
          role="dialog"
          aria-modal="true"
          aria-label="Welcome banner"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="relative max-w-2xl w-full overflow-hidden rounded-2xl bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button — absolute positioned over image */}
            <button
              onClick={handleClose}
              className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-all hover:bg-black/70 hover:scale-105 active:scale-95"
              aria-label="Tutup banner"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Banner image (16:9 aspect ratio) */}
            {content.image && (
              <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
                <img
                  src={content.image}
                  alt={content.title || "Welcome banner"}
                  className="h-full w-full object-cover"
                />
              </div>
            )}

            {/* Content overlay (title + description + CTA) */}
            {(content.title || content.description || content.ctaText) && (
              <div className="p-5 sm:p-6">
                {content.title && (
                  <h2 className="text-xl font-bold leading-tight sm:text-2xl">
                    {content.title}
                  </h2>
                )}
                {content.description && (
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed sm:text-base">
                    {content.description}
                  </p>
                )}
                {content.ctaText && (
                  <button
                    onClick={handleCtaClick}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition-all hover:scale-[1.02] active:scale-95"
                  >
                    {content.ctaText}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
