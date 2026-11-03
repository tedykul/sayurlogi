"use client";

import { useEffect, useState, useCallback } from "react";
import { Download, X, Smartphone } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/lib/store/cart";

// ============================================================
// PWAInstallPrompt — shows install banner when eligible.
// ============================================================
// Trigger strategy: only show AFTER user has added 3+ items to
// cart (engagement signal). Showing immediately on page load
// interrupts shopping flow and hurts conversion. Waiting for
// cart engagement ensures the user has shown real intent before
// we ask them to install the app.

const DISMISS_KEY = "pwa-install-dismissed";
const DISMISS_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_CART_ITEMS_FOR_PROMPT = 3;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [hasEngaged, setHasEngaged] = useState(false);

  // Track cart item count — only show install prompt after user adds 3+ items
  const totalItems = useCartStore((s) => s.getTotalItems());

  useEffect(() => {
    if (totalItems >= MIN_CART_ITEMS_FOR_PROMPT) {
      setHasEngaged(true);
    }
  }, [totalItems]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);

    const ua = window.navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
    setIsIOS(ios);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Don't show immediately — wait for cart engagement (hasEngaged flag)
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [isStandalone]);

  // Show banner only when: user has engaged (3+ cart items) + not dismissed + not standalone
  useEffect(() => {
    if (!hasEngaged || isStandalone) return;

    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed) {
      const dismissedTime = parseInt(dismissed, 10);
      if (!isNaN(dismissedTime) && Date.now() - dismissedTime < DISMISS_EXPIRY_MS) {
        return;
      }
    }

    // Small delay after engagement threshold reached (feels less aggressive)
    const timer = setTimeout(() => setShowBanner(true), 1500);
    return () => clearTimeout(timer);
  }, [hasEngaged, isStandalone]);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) {
      // iOS or unsupported — just dismiss
      handleDismiss();
      return;
    }

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setShowBanner(false);
      } else {
        handleDismiss();
      }
    } catch (err) {
      console.error("[PWA] install prompt failed:", err);
    } finally {
      setDeferredPrompt(null);
    }
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setShowBanner(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // ignore
    }
  }, []);

  if (isStandalone || !showBanner) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed bottom-4 left-1/2 z-[150] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2"
        role="dialog"
        aria-label="Install aplikasi"
      >
        <div className="rounded-2xl border border-border bg-card p-4 shadow-2xl">
          <button
            onClick={handleDismiss}
            className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer"
            aria-label="Tutup notifikasi install"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Smartphone className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0 pr-4">
              <h3 className="text-sm font-bold leading-tight">
                Install SayurLogi
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground leading-snug">
                {isIOS ? (
                  <>Tambahkan ke layar utama untuk akses cepat seperti aplikasi native.</>
                ) : (
                  <>Pasang sebagai aplikasi untuk akses cepat dan notifikasi promo.</>
                )}
              </p>
            </div>
          </div>

          <div className="mt-3 flex gap-2">
            {isIOS ? (
              <div className="flex-1 rounded-lg border border-border bg-secondary/50 p-2.5 text-xs text-muted-foreground">
                <p className="leading-snug">
                  Tekan <span className="font-semibold">Share</span> lalu{" "}
                  <span className="font-semibold">Add to Home Screen</span>
                </p>
              </div>
            ) : (
              <Button
                onClick={handleInstall}
                className="h-9 flex-1 rounded-lg text-sm"
              >
                <Download className="h-4 w-4 mr-1.5" />
                Install
              </Button>
            )}
            <Button
              variant="outline"
              onClick={handleDismiss}
              className="h-9 rounded-lg text-sm"
            >
              Nanti
            </Button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

