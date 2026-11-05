"use client";

import { motion } from "framer-motion";
import { Plus, Minus, Leaf, Star } from "lucide-react";
import { useCartStore } from "@/lib/store/cart";
import { formatIDR } from "@/lib/mock-data";
import type { Product } from "@/types/grocery";
import { cn } from "@/lib/utils";
import { WishlistButton } from "./wishlist-button";
import { ProductImage } from "./product-image";

interface ProductCardProps {
  product: Product;
  index?: number;
  /** Called when user clicks the card (not the action buttons). Optional for backward compat. */
  onOpenDetail?: (product: Product) => void;
}

export function ProductCard({ product, index = 0, onOpenDetail }: ProductCardProps) {
  const addItem = useCartStore((s) => s.addItem);
  const items = useCartStore((s) => s.items);
  const updateQty = useCartStore((s) => s.updateQty);

  const inCart = items.find((i) => i.product.id === product.id);
  const outOfStock = !product.stock || product.stock <= 0 || !product.price || product.price <= 0;
  const discount =
    product.oldPrice && product.oldPrice > product.price
      ? Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)
      : 0;
  const rating = product.rating ?? 0;

  const handleCardClick = () => onOpenDetail?.(product);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-30px" }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.03, 0.3) }}
      className="group relative flex flex-col rounded-2xl bg-card shadow-sm ring-1 ring-border/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/10 hover:ring-primary/30"
    >
      {/* Image — photo-forward, no border, rounded top */}
      <div
        role={onOpenDetail ? "button" : undefined}
        tabIndex={onOpenDetail ? 0 : undefined}
        onClick={handleCardClick}
        onKeyDown={(e) => {
          if (onOpenDetail && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            handleCardClick();
          }
        }}
        className={`relative aspect-square overflow-hidden rounded-2xl bg-gradient-to-br from-secondary/30 to-secondary/5 ${onOpenDetail ? "cursor-pointer" : "cursor-default"}`}
        aria-label={`Lihat detail ${product.name}`}
      >
        {/* Discount badge — single, minimal */}
        {product.onSale && discount > 0 && (
          <span className="absolute left-2 top-2 z-10 rounded-md bg-stone-900/90 px-1.5 py-0.5 text-xs font-bold text-white shadow-sm backdrop-blur-sm">
            -{discount}%
          </span>
        )}

        {/* Organic — subtle leaf icon only (no text) */}
        {product.organic && (
          <span className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
            <Leaf className="h-3 w-3" />
          </span>
        )}

        <WishlistButton product={product} size="sm" variant="overlay" />

        <ProductImage
          product={product}
          emojiClassName="text-6xl transition-transform duration-500 group-hover:scale-110"
          animateOnHover
          className="aspect-square"
        />

        {outOfStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-stone-900/50 backdrop-blur-[2px]">
            <span className="text-sm font-bold text-white tracking-wide uppercase drop-shadow-lg">
              Stok Habis
            </span>
          </div>
        )}
        {product.stock > 0 && product.stock <= 10 && !outOfStock && (
          <span className="absolute bottom-2 right-2 z-10 rounded-md bg-stone-900/90 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-sm backdrop-blur-sm">
            Sisa {product.stock}
          </span>
        )}
      </div>

      {/* Body — tight, price-forward */}
      <div
        onClick={handleCardClick}
        role={onOpenDetail ? "button" : undefined}
        tabIndex={onOpenDetail ? 0 : undefined}
        onKeyDown={(e) => {
          if (onOpenDetail && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            handleCardClick();
          }
        }}
        className="flex flex-1 cursor-pointer flex-col gap-1 px-2 py-2.5"
      >
        <h3 className="line-clamp-2 text-[13px] font-semibold leading-tight tracking-tight text-foreground min-h-[2.4em]">{product.name}</h3>

        {/* Rating — ultra compact, single line */}
        {rating > 0 && (
          <div className="flex items-center gap-0.5 text-xs text-muted-foreground">
            <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
            <span className="font-semibold text-foreground">{rating.toFixed(1)}</span>
            <span className="opacity-70">({product.reviewCount ?? 0})</span>
          </div>
        )}

        {/* Price + add button — price is hero, button is icon-only */}
        <div className="mt-1 flex items-end justify-between gap-1.5">
          <div className="flex min-w-0 flex-col">
            {product.oldPrice && (
              <span className="text-xs text-muted-foreground/50 line-through leading-none">
                {formatIDR(product.oldPrice)}
              </span>
            )}
            <div className="flex items-baseline gap-0.5">
              <span className="text-base font-extrabold text-foreground tracking-tight leading-none">{formatIDR(product.price)}</span>
              <span className="text-xs font-medium text-muted-foreground">/{product.unit}</span>
            </div>
          </div>

          <div onClick={(e) => e.stopPropagation()} className="shrink-0">
            {outOfStock ? (
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground/40">
                <Plus className="h-4 w-4" />
              </span>
            ) : inCart ? (
              <QtyStepper
                qty={inCart.quantity}
                max={product.stock}
                onDec={() => updateQty(product.id, inCart.quantity - 1)}
                onInc={() => updateQty(product.id, inCart.quantity + 1)}
              />
            ) : (
              <button
                onClick={() => addItem(product, 1)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-all duration-200 hover:scale-110 hover:shadow-md active:scale-95"
                aria-label={`Tambah ${product.name} ke keranjang`}
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function QtyStepper({
  qty,
  max,
  onDec,
  onInc,
}: {
  qty: number;
  max: number;
  onDec: () => void;
  onInc: () => void;
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-full border border-primary/30 bg-primary/5 p-0.5">
      <button
        onClick={onDec}
        className="flex h-7 w-7 items-center justify-center rounded-full text-primary transition-colors hover:bg-primary/10"
        aria-label="Kurangi"
      >
        <Minus className="h-3 w-3" />
      </button>
      <span className="min-w-5 text-center text-xs font-bold text-primary tabular-nums">{qty}</span>
      <button
        onClick={onInc}
        disabled={qty >= max}
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-full text-primary transition-colors hover:bg-primary/10",
          qty >= max && "opacity-40 cursor-not-allowed"
        )}
        aria-label="Tambah"
      >
        <Plus className="h-3 w-3" />
      </button>
    </div>
  );
}
