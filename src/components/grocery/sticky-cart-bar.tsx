"use client";

import { useEffect, useState } from "react";
import { ShoppingCart, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useCartStore } from "@/lib/store/cart";
import { formatIDR } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

// ============================================================
// StickyCartBar — fixed bottom bar showing cart summary.
// ============================================================
// Appears when cart has items + cart sheet is closed.
// Hidden on desktop (md:hidden) — desktop uses header cart.
// Mobile-only conversion booster (Shopee/Tokopedia pattern).
// ============================================================

export function StickyCartBar() {
  const totalItems = useCartStore((s) => s.getTotalItems());
  const totalPrice = useCartStore((s) => s.getTotalPrice());
  const isOpen = useCartStore((s) => s.isOpen);
  const openCart = useCartStore((s) => s.openCart);
  const [visible, setVisible] = useState(false);

  // Show bar when cart has items + sheet not open
  // Small delay to avoid flash on add
  useEffect(() => {
    if (totalItems > 0 && !isOpen) {
      const t = setTimeout(() => setVisible(true), 300);
      return () => clearTimeout(t);
    }
    setVisible(false);
  }, [totalItems, isOpen]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed inset-x-0 bottom-0 z-40 md:hidden"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="mx-2 mb-2 flex items-center gap-3 rounded-2xl border border-primary/20 bg-background/95 p-2.5 shadow-2xl ring-1 ring-primary/10 backdrop-blur-lg">
            {/* Cart icon + badge */}
            <button
              onClick={openCart}
              className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"
              aria-label="Buka keranjang"
            >
              <ShoppingCart className="h-5 w-5" />
              <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground ring-2 ring-background">
                {totalItems}
              </span>
            </button>

            {/* Item count + total */}
            <button
              onClick={openCart}
              className="flex flex-1 flex-col items-start justify-center min-w-0"
              aria-label={`${totalItems} item, total ${formatIDR(totalPrice)}`}
            >
              <span className="text-[10px] font-medium text-muted-foreground">
                {totalItems} item
              </span>
              <span className="text-base font-extrabold text-foreground tabular-nums leading-tight">
                {formatIDR(totalPrice)}
              </span>
            </button>

            {/* Checkout button */}
            <button
              onClick={openCart}
              className="flex items-center gap-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-md active:scale-95 transition-transform shrink-0"
            >
              Keranjang
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
