"use client";

import { motion } from "framer-motion";
import { Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRecentlyViewed } from "@/hooks/use-recently-viewed";
import { formatIDR } from "@/lib/mock-data";
import type { Product } from "@/types/grocery";
import { ProductImage } from "./product-image";

interface RecentlyViewedSectionProps {
  /** Called when user clicks a recently viewed product card. */
  onProductClick: (product: Product) => void;
}

/**
 * Section showing recently viewed products (horizontal scroll on mobile,
 * grid on desktop). Hidden until user has viewed at least 1 product.
 * Placed above the main product grid.
 */
export function RecentlyViewedSection({ onProductClick }: RecentlyViewedSectionProps) {
  const { items, clear, mounted } = useRecentlyViewed();

  // Don't render until mounted (avoid hydration flash)
  // Also hide if no items
  if (!mounted || items.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-8 rounded-2xl border border-border/60 bg-secondary/20 p-4 md:p-5"
      aria-label="Produk terakhir dilihat"
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold md:text-base">
          <Clock className="h-4 w-4 text-primary" />
          Terakhir Dilihat
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            {items.length}
          </span>
        </h3>
        <button
          onClick={clear}
          className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-destructive"
          aria-label="Hapus riwayat"
        >
          <X className="h-3 w-3" />
          <span className="hidden sm:inline">Hapus riwayat</span>
        </button>
      </div>

      {/* Horizontal scroll on mobile, grid on desktop */}
      <div className="flex gap-3 overflow-x-auto scrollbar-grocery pb-2 md:grid md:grid-cols-6 md:overflow-visible md:pb-0">
        {items.map((product, i) => (
          <motion.button
            key={product.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25, delay: Math.min(i * 0.04, 0.3) }}
            onClick={() => onProductClick(product)}
            className="group flex w-32 shrink-0 flex-col gap-1.5 rounded-xl border border-border/60 bg-card p-2 text-left transition-all hover:shadow-md hover:border-primary/40 md:w-auto"
            aria-label={`Lihat kembali ${product.name}`}
          >
            {/* Image / Emoji */}
            <div className="aspect-square w-full overflow-hidden rounded-lg">
              <ProductImage
                product={product}
                emojiClassName="text-4xl"
                animateOnHover
                className="h-full w-full"
              />
            </div>
            {/* Name + price */}
            <div className="min-w-0">
              <p className="line-clamp-1 text-xs font-semibold leading-tight">
                {product.name}
              </p>
              <p className="text-xs font-bold text-primary">
                {formatIDR(product.price)}
              </p>
            </div>
          </motion.button>
        ))}
      </div>
    </motion.section>
  );
}
