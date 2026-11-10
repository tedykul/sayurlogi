"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Download, X, Smartphone, Share } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/lib/store/cart";

// ============================================================
// PWAInstallPrompt — shows install banner when eligible.
// ============================================================
// Trigger strategy (multi-layered so the banner reliably shows):
//   1. TIME-BASED: show after 45s on page (any user, no engagement
//      required). Catches the common case where the user is browsing
//      and would benefit from install.
//   2. ENGAGEMENT: show immediately when user adds 1+ item to cart
//      (strong intent signal — they're shopping for real now).
//   3. MANUAL: a dedicated "Install App" button in the footer (see
//      Footer component) opens this same banner on demand.
//
// Why not just rely on `beforeinstallprompt`?
//   - Chrome only fires it on HTTPS or localhost. In production over
//     HTTP (e.g. tailscale IP), the event NEVER fires → deferredPrompt
//     stays null → clicking "Install" would just dismiss the banner.
//   - Solution: detect when deferredPrompt is null and show manual
//     install instructions (browser menu / Share > Add to Home Screen)
//     instead of a dead-end "Install" button.
//
// Dismiss persistence: 7 days. After that, banner can show again.

const DISMISS_KEY = "pwa-install-dismissed";
const DISMISS_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_CART_ITEMS_FOR_PROMPT = 1;
const TIME_BASED_DELAY_MS = 45 * 1000; // 45s

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Module-level event listener so manual "Install App" button can trigger
// the banner even if `beforeinstallprompt` already fired before banner mount.
// We capture the latest deferredPrompt here.
let capturedDeferredPrompt: BeforeInstallPromptEvent | null = null;
export function triggerInstallPrompt() {
  window.dispatchEvent(new CustomEvent("sayurlogi-open-install-prompt"));
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [hasEngaged, setHasEngaged] = useState(false);
  const [showManualInstructions, setShowManualInstructions] = useState(false);
  const dismissedRef = useRef(false);

  // Track cart item count — show install prompt after user adds 1+ items
  const totalItems = useCartStore((s) => s.getTotalItems());

  useEffect(() => {
    if (totalItems >= MIN_CART_ITEMS_FOR_PROMPT) {
      setHasEngaged(true);
    }
  }, [totalItems]);

  // Detect iOS + standalone mode
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

  // Listen for `beforeinstallprompt` — only fires on HTTPS or localhost.
  // In production over HTTP, this never fires (see header comment).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone) return;

    const handler = (e: Event) => {
      e.preventDefault();
      capturedDeferredPrompt = e as BeforeInstallPromptEvent;
      setDeferredPrompt(capturedDeferredPrompt);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [isStandalone]);

  // Show banner when: engaged (1+ cart items) OR 45s elapsed.
  // Respects 7-day dismiss expiry.
  useEffect(() => {
    if (isStandalone) return;

    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed) {
      const dismissedTime = parseInt(dismissed, 10);
      if (!isNaN(dismissedTime) && Date.now() - dismissedTime < DISMISS_EXPIRY_MS) {
        dismissedRef.current = true;
        return;
      }
    }
    dismissedRef.current = false;

    // Layer 1: engagement trigger (immediate)
    if (hasEngaged) {
      const t = setTimeout(() => setShowBanner(true), 1500);
      return () => clearTimeout(t);
    }

    // Layer 2: time-based trigger (45s after mount)
    const timer = setTimeout(() => setShowBanner(true), TIME_BASED_DELAY_MS);
    return () => clearTimeout(timer);
  }, [hasEngaged, isStandalone]);

  // Allow manual trigger via footer "Install App" button
  useEffect(() => {
    const handler = () => {
      // Reset dismiss state so banner can show
      dismissedRef.current = false;
      setShowBanner(true);
    };
    window.addEventListener("sayurlogi-open-install-prompt", handler);
    return () => window.removeEventListener("sayurlogi-open-install-prompt", handler);
  }, []);

  const handleInstall = useCallback(async () => {
    // No deferredPrompt = production non-HTTPS, OR iOS Safari.
    // Show manual instructions instead of silently dismissing.
    if (!deferredPrompt) {
      setShowManualInstructions(true);
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
      // Fallback: show manual instructions
      setShowManualInstructions(true);
    } finally {
      setDeferredPrompt(null);
      capturedDeferredPrompt = null;
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
                {isIOS || showManualInstructions ? (
                  <>Akses cepat dari layar utama seperti aplikasi native.</>
                ) : (
                  <>Pasang sebagai aplikasi untuk akses cepat dan notifikasi promo.</>
                )}
              </p>
            </div>
          </div>

          {/* Manual instructions fallback — shown when beforeinstallprompt
              didn't fire (production non-HTTPS) or on iOS Safari. */}
          {(isIOS || showManualInstructions) ? (
            <div className="mt-3 space-y-2">
              {isIOS ? (
                <div className="rounded-lg border border-border bg-secondary/50 p-2.5 text-xs text-muted-foreground">
                  <p className="leading-snug">
                    Tekan <span className="font-semibold inline-flex items-center gap-0.5 align-middle"><Share className="h-3 w-3 inline" /> Share</span> lalu{" "}
                    <span className="font-semibold">Add to Home Screen</span>
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border border-border bg-secondary/50 p-2.5 text-xs text-muted-foreground">
                  <p className="leading-snug">
                    Buka menu browser <span className="font-semibold">⋮</span> lalu pilih{" "}
                    <span className="font-semibold">Install app</span> /{" "}
                    <span className="font-semibold">Add to Home screen</span>
                  </p>
                </div>
              )}
              <Button
                variant="outline"
                onClick={handleDismiss}
                className="h-9 w-full rounded-lg text-sm"
              >
                Mengerti
              </Button>
            </div>
          ) : (
            <div className="mt-3 flex gap-2">
              <Button
                onClick={handleInstall}
                className="h-9 flex-1 rounded-lg text-sm"
              >
                <Download className="h-4 w-4 mr-1.5" />
                Install
              </Button>
              <Button
                variant="outline"
                onClick={handleDismiss}
                className="h-9 rounded-lg text-sm"
              >
                Nanti
              </Button>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
