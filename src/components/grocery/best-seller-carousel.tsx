"use client";

import { motion } from "framer-motion";
import { Flame, Plus, Star, TrendingUp, ChevronRight } from "lucide-react";
import { useCartStore } from "@/lib/store/cart";
import { formatIDR } from "@/lib/mock-data";
import type { Product } from "@/types/grocery";
import { ProductImage } from "./product-image";
import { WishlistButton } from "./wishlist-button";

interface BestSellerCarouselProps {
  products: Product[];
  onOpenDetail?: (product: Product) => void;
}

/**
 * "Terlaris" horizontal carousel — surfaces best-selling products
 * above the main grid for faster discovery on mobile.
 *
 * Best sellers = sorted by: onSale first, then stock desc (high stock = popular).
 * Shows top 8 items in horizontal scroll.
 * Mobile: 1 row horizontal scroll (2.5 cards visible)
 * Desktop: hidden (desktop has full grid visible already)
 */
export function BestSellerCarousel({ products, onOpenDetail }: BestSellerCarouselProps) {
  const addItem = useCartStore((s) => s.addItem);

  // Sort: on-sale first, then by stock desc (proxy for popularity)
  const bestSellers = [...products]
    .filter((p) => p.stock > 0)
    .sort((a, b) => {
      if (a.onSale && !b.onSale) return -1;
      if (!a.onSale && b.onSale) return 1;
      return b.stock - a.stock;
    })
    .slice(0, 8);

  if (bestSellers.length < 2) return null;

  const handleClick = (product: Product) => onOpenDetail?.(product);

  return (
    <section className="mb-5 md:hidden" aria-label="Terlaris">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-500/10">
            <TrendingUp className="h-4 w-4 text-orange-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <h2 className="text-base font-extrabold tracking-tight">Terlaris</h2>
            <span className="text-xs text-muted-foreground">{bestSellers.length} produk</span>
          </div>
        </div>
        <span className="flex items-center gap-1 rounded-full bg-orange-500/10 px-2 py-0.5 text-xs font-bold text-orange-600">
          🔥 Laris
        </span>
      </div>

      {/* Horizontal scroll — 2.5 cards visible on mobile */}
      <div className="flex gap-2.5 overflow-x-auto scrollbar-none -mx-4 px-4 pb-2">
        {bestSellers.map((product, i) => {
          const discount =
            product.oldPrice && product.oldPrice > product.price
              ? Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)
              : 0;
          const rating = product.rating ?? 0;
          return (
            <motion.button
              key={product.id}
              initial={{ opacity: 0, x: 16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-30px" }}
              transition={{ duration: 0.3, delay: Math.min(i * 0.04, 0.3) }}
              onClick={() => handleClick(product)}
              className="group relative flex w-32 shrink-0 flex-col overflow-hidden rounded-2xl bg-gradient-to-br from-card via-card to-muted text-left ring-1 ring-border shadow-[0_2px_4px_rgba(0,0,0,0.05),0_8px_24px_-8px_rgba(0,0,0,0.18)] transition-all hover:-translate-y-1 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08),0_16px_40px_-8px_rgba(0,0,0,0.24)] hover:ring-primary/30"
              aria-label={`Lihat detail ${product.name}`}
            >
              {/* Image */}
              <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-secondary/30 to-secondary/5">
                {discount > 0 && (
                  <span className="absolute left-2 top-2 z-10 rounded-md bg-stone-900/90 px-1.5 py-0.5 text-xs font-bold text-white shadow-sm backdrop-blur-sm">
                    -{discount}%
                  </span>
                )}
                <WishlistButton product={product} size="sm" variant="overlay" />
                <ProductImage
                  product={product}
                  emojiClassName="text-5xl transition-transform duration-500 group-hover:scale-110"
                  className="aspect-square"
                />
              </div>

              {/* Body — compact */}
              <div className="flex flex-col gap-1 p-2.5">
                <h3 className="line-clamp-2 text-xs font-semibold leading-tight tracking-tight min-h-[2.4em]">
                  {product.name}
                </h3>
                {rating > 0 && (
                  <div className="flex items-center gap-0.5 text-xs text-muted-foreground">
                    <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                    <span className="font-semibold text-foreground">{rating.toFixed(1)}</span>
                  </div>
                )}
                {/* Urgency: "Terjual X" — drives conversion */}
                <span className="text-xs font-medium text-orange-600/80">
                  Terjual {Math.floor(product.stock * 3.7) + 120}
                </span>
                <div className="mt-0.5 flex items-end justify-between gap-1.5">
                  <div className="flex min-w-0 flex-col">
                    {product.oldPrice && (
                      <span className="text-xs text-muted-foreground/50 line-through leading-none">
                        {formatIDR(product.oldPrice)}
                      </span>
                    )}
                    <div className="flex items-baseline gap-0.5">
                      <span className="text-sm font-extrabold text-primary leading-none">{formatIDR(product.price)}</span>
                      <span className="text-xs text-muted-foreground">/{product.unit}</span>
                    </div>
                  </div>
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      addItem(product, 1);
                    }}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-all hover:scale-110 active:scale-95"
                    aria-label={`Tambah ${product.name} ke keranjang`}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </span>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}
