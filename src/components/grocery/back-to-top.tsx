"use client";

import { useState, useEffect, useCallback } from "react";
import { ArrowUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface BackToTopProps {
  /** Scroll threshold in px before button appears. Default 500. */
  threshold?: number;
  /** Bottom offset in px. Default 24. */
  bottom?: number;
  /** Right offset in px. Default 24. */
  right?: number;
}

/**
 * Floating "back to top" button — appears after user scrolls down past
 * `threshold` pixels. Smooth scroll on click. Accessible (aria-label),
 * touch-friendly (h-11 w-11 ≥ 44px), respects reduced motion via CSS.
 *
 * Mount once at page root. No props required for default behavior.
 */
export function BackToTop({ threshold = 500, bottom = 24, right = 24 }: BackToTopProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        setVisible(window.scrollY > threshold);
        ticking = false;
      });
    };
    // Initial check (in case page loads already scrolled)
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [threshold]);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          initial={{ opacity: 0, scale: 0.5, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.5, y: 20 }}
          transition={{ duration: 0.2 }}
          onClick={scrollToTop}
          className="fixed z-30 flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          style={{ bottom: `${bottom}px`, right: `${right}px` }}
          aria-label="Kembali ke atas"
          title="Kembali ke atas"
        >
          <ArrowUp className="h-5 w-5" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
