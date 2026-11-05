"use client";

import { motion } from "framer-motion";
import { Flame, Plus, Star, ChevronRight } from "lucide-react";
import { useCartStore } from "@/lib/store/cart";
import { formatIDR } from "@/lib/mock-data";
import type { Product } from "@/types/grocery";
import { ProductImage } from "./product-image";
import { WishlistButton } from "./wishlist-button";

interface PromoCarouselProps {
  products: Product[];
  onOpenDetail?: (product: Product) => void;
}

/**
 * Horizontal scroll carousel for on-sale products.
 * Breaks vertical monotony of the main grid, surfaces deals above the fold.
 * Hidden if fewer than 2 promo items.
 */
export function PromoCarousel({ products, onOpenDetail }: PromoCarouselProps) {
  const addItem = useCartStore((s) => s.addItem);
  // Sort by discount % descending, take top 4 — acts as "highlight" not full list.
  // This avoids visual duplication with the main grid which shows all products.
  const allPromos = products
    .filter((p) => p.onSale && p.stock > 0)
    .map((p) => ({
      product: p,
      discount: p.oldPrice && p.oldPrice > p.price
        ? Math.round(((p.oldPrice - p.price) / p.oldPrice) * 100)
        : 0,
    }))
    .sort((a, b) => b.discount - a.discount)
    .slice(0, 4);
  const promos = allPromos.map((x) => x.product);

  if (promos.length < 2) return null;

  const handleClick = (product: Product) => onOpenDetail?.(product);

  return (
    <section className="mb-6" aria-label="Sedang Promo">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-500/10">
            <Flame className="h-4 w-4 text-orange-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <h2 className="text-base font-extrabold tracking-tight md:text-lg">Sedang Promo</h2>
            <span className="text-xs text-muted-foreground">{promos.length} produk</span>
          </div>
        </div>
        <span className="flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-bold text-red-600">
          ⏰ Berakhir cepat
        </span>
      </div>

      {/* Horizontal scroll — no visible scrollbar */}
      <div className="flex gap-3 overflow-x-auto scrollbar-none -mx-1 px-1 pb-2">
        {promos.map((product, i) => {
          const discount =
            product.oldPrice && product.oldPrice > product.price
              ? Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)
              : 0;
          const rating = product.rating ?? 0;
          return (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, x: 16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-30px" }}
              transition={{ duration: 0.3, delay: Math.min(i * 0.05, 0.3) }}
              onClick={() => handleClick(product)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleClick(product);
                }
              }}
              role="button"
              tabIndex={0}
              className="group relative flex w-36 shrink-0 flex-col overflow-hidden rounded-2xl bg-gradient-to-br from-card via-card to-muted text-left ring-1 ring-border shadow-[0_2px_4px_rgba(0,0,0,0.05),0_8px_24px_-8px_rgba(0,0,0,0.18)] transition-all hover:-translate-y-1 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08),0_16px_40px_-8px_rgba(0,0,0,0.24)] hover:ring-primary/30 md:w-44 cursor-pointer"
              aria-label={`Lihat detail ${product.name}`}
            >
              {/* Image */}
              <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-secondary/30 to-secondary/5">
                {discount > 0 && (
                  <span className="absolute left-2 top-2 z-10 rounded-md bg-stone-900/90 px-1.5 py-0.5 text-xs font-bold text-white shadow-sm backdrop-blur-sm">
                    -{discount}%
                  </span>
                )}
                {/* Wishlist button — consistent with main grid cards */}
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
                <div className="mt-0.5 flex items-end justify-between gap-1.5">
                  <div className="flex min-w-0 flex-col">
                    {product.oldPrice && (
                      <span className="text-xs text-muted-foreground/50 line-through leading-none">
                        {formatIDR(product.oldPrice)}
                      </span>
                    )}
                    <div className="flex items-baseline gap-0.5">
                      <span className="text-sm font-extrabold text-orange-600 leading-none">{formatIDR(product.price)}</span>
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
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
