"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Star,
  Leaf,
  MapPin,
  Package,
  Truck,
  ShieldCheck,
  Plus,
  Minus,
  ShoppingCart,
  CheckCircle2,
  Snowflake,
  Sparkles,
  X,
  Clock,
  Scale,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useCartStore } from "@/lib/store/cart";
import { formatIDR } from "@/lib/mock-data";
import type { Product, ProductVariant } from "@/types/grocery";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ProductImage } from "./product-image";
import { WishlistButton } from "./wishlist-button";

// ============================================================
// Swipe thresholds — tuned for grocery detail dialog.
// ============================================================
// - SWIPE_MIN_DISTANCE: minimum px traveled to register a swipe
//   (prevents accidental taps from triggering navigation)
// - SWIPE_MAX_VERTICAL: max vertical travel before we treat it
//   as a vertical scroll (not a horizontal swipe)
// ============================================================
const SWIPE_MIN_DISTANCE = 50;
const SWIPE_MAX_VERTICAL = 80;

interface ProductDetailDialogProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called when user clicks "Beli Sekarang" (Buy Now). Optional. */
  onBuyNow?: () => void;
  /** Related products for cross-sell ("Beli ini juga"). Optional. */
  relatedProducts?: Product[];
  /** Called when user clicks a related product. Optional. */
  onSelectRelated?: (product: Product) => void;
  /**
   * Full product list (for swipe navigation between products).
   * When provided, prev/next arrow buttons + swipe gestures become active.
   * The dialog computes the current index from `product` and calls
   * `onNavigate` when the user swipes or clicks an arrow.
   * Optional — if omitted, swipe navigation is disabled (backward compat).
   */
  products?: Product[];
  /** Called when user swipes/clicks to navigate to prev/next product. */
  onNavigate?: (product: Product) => void;
}

/**
 * Wrapper that mounts a fresh inner component (keyed by product id) so the
 * qty state resets automatically when the user opens a different product —
 * no useEffect needed. Also handles swipe gesture detection.
 */
export function ProductDetailDialog({
  product,
  open,
  onOpenChange,
  onBuyNow,
  relatedProducts,
  onSelectRelated,
  products,
  onNavigate,
}: ProductDetailDialogProps) {
  // Compute current index in the products list (for prev/next nav).
  const currentIndex = product && products ? products.findIndex((p) => p.id === product.id) : -1;
  const hasPrev = currentIndex > 0;
  const hasNext = products ? currentIndex >= 0 && currentIndex < products.length - 1 : false;
  const canNavigate = !!products && !!onNavigate && currentIndex >= 0;

  const goToPrev = useCallback(() => {
    if (!canNavigate || !hasPrev || !products || !onNavigate) return;
    onNavigate(products[currentIndex - 1]);
  }, [canNavigate, hasPrev, products, currentIndex, onNavigate]);

  const goToNext = useCallback(() => {
    if (!canNavigate || !hasNext || !products || !onNavigate) return;
    onNavigate(products[currentIndex + 1]);
  }, [canNavigate, hasNext, products, currentIndex, onNavigate]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-hidden p-0 sm:max-w-3xl gap-0">
        <DialogDescription className="sr-only">
          Detail produk SayurLogi
        </DialogDescription>
        {product ? (
          <ProductDetailContent
            key={product.id}
            product={product}
            onOpenChange={onOpenChange}
            onBuyNow={onBuyNow}
            relatedProducts={relatedProducts}
            onSelectRelated={onSelectRelated}
            canNavigate={canNavigate}
            hasPrev={hasPrev}
            hasNext={hasNext}
            onPrev={goToPrev}
            onNext={goToNext}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ProductDetailContent({
  product,
  onOpenChange,
  onBuyNow,
  relatedProducts,
  onSelectRelated,
  canNavigate,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
}: {
  product: Product;
  onOpenChange: (open: boolean) => void;
  onBuyNow?: () => void;
  relatedProducts?: Product[];
  onSelectRelated?: (product: Product) => void;
  canNavigate: boolean;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  const [qty, setQty] = useState(1);

  const addItem = useCartStore((s) => s.addItem);
  const items = useCartStore((s) => s.items);
  const updateQty = useCartStore((s) => s.updateQty);

  // ============================================================
  // Swipe gesture detection — touch start/move/end.
  // ============================================================
  // We capture touchstart coordinates, then on touchend compute the
  // delta. If horizontal travel > SWIPE_MIN_DISTANCE AND vertical
  // travel < SWIPE_MAX_VERTICAL, it's a swipe (left → next, right → prev).
  // We use passive listeners to not block scrolling.
  //
  // Keyboard navigation (Alt+ArrowLeft/Right) is also wired for
  // desktop accessibility.
  // ============================================================
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (!canNavigate) return;
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  }, [canNavigate]);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!canNavigate || !touchStart.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    touchStart.current = null;

    // Ignore if mostly vertical (it's a scroll, not a swipe)
    if (Math.abs(dy) > SWIPE_MAX_VERTICAL) return;
    if (Math.abs(dx) < SWIPE_MIN_DISTANCE) return;

    if (dx > 0) {
      // Swipe right → previous product
      if (hasPrev) onPrev();
    } else {
      // Swipe left → next product
      if (hasNext) onNext();
    }
  }, [canNavigate, hasPrev, hasNext, onPrev, onNext]);

  // Keyboard navigation (Alt+Arrow) for desktop accessibility
  useEffect(() => {
    if (!canNavigate) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.key === "ArrowLeft" && hasPrev) {
        e.preventDefault();
        onPrev();
      } else if (e.altKey && e.key === "ArrowRight" && hasNext) {
        e.preventDefault();
        onNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canNavigate, hasPrev, hasNext, onPrev, onNext]);

  const outOfStock = !product.stock || product.stock <= 0 || !product.price || product.price <= 0;
  // Variant state
  const variants = product.variants || [];
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  
  // Effective price/stock (variant overrides if selected)
  const effectivePrice = selectedVariant?.price ?? product.price;
  const effectiveOldPrice = selectedVariant?.oldPrice ?? product.oldPrice;
  const effectiveStock = selectedVariant?.stock ?? product.stock;
  const effectiveUnit = selectedVariant?.unit ?? product.unit;
  const effectiveOutOfStock = !effectiveStock || effectiveStock <= 0 || !effectivePrice || effectivePrice <= 0;
  const discount =
    effectiveOldPrice && effectiveOldPrice > effectivePrice
      ? Math.round(((effectiveOldPrice - effectivePrice) / effectiveOldPrice) * 100)
      : 0;
  const savings = effectiveOldPrice ? effectiveOldPrice - effectivePrice : 0;

  const inCart = items.find((i) => i.product.id === product.id);
  // Dynamic rating from OrderReview (store-wide, fetched on mount)
  const [realRating, setRealRating] = useState<number | null>(null);
  const [realReviewCount, setRealReviewCount] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/reviews?aggregate=true&limit=1")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (cancelled || !data?.aggregate) return;
        if (data.aggregate.count > 0) {
          setRealRating(data.aggregate.average);
          setRealReviewCount(data.aggregate.count);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [product.id]);

  const rating = realRating ?? product.rating ?? 4.5;
  const reviewCount = realReviewCount || product.reviewCount || 0;
  const hasReviews = reviewCount > 0;

  const handleAddToCart = () => {
    if (inCart) {
      const newQty = Math.min(inCart.quantity + qty, effectiveStock);
      updateQty(product.id, newQty);
      toast.success(`Diperbarui — ${product.name} jadi ${newQty} di keranjang`);
    } else {
      addItem(product, qty);
      toast.success(`${qty} × ${product.name} ditambahkan ke keranjang`);
    }
    onOpenChange(false);
  };

  const handleBuyNow = () => {
    if (inCart) {
      const newQty = Math.min(inCart.quantity + qty, effectiveStock);
      updateQty(product.id, newQty);
    } else {
      addItem(product, qty);
    }
    onOpenChange(false);
    onBuyNow?.();
  };

  return (
    <div
      className="grid max-h-[92vh] grid-cols-1 overflow-hidden md:grid-cols-2 relative"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* ============ Swipe navigation arrows (desktop + touch fallback) ============ */}
      {canNavigate && (
        <>
          <button
            onClick={onPrev}
            disabled={!hasPrev}
            aria-label="Produk sebelumnya"
            className={cn(
              "absolute left-1 top-1/2 z-20 -translate-y-1/2",
              "flex h-9 w-9 items-center justify-center rounded-full",
              "bg-background/80 backdrop-blur-sm border border-border/60 shadow-md",
              "transition-all hover:bg-background hover:scale-110",
              "disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            )}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={onNext}
            disabled={!hasNext}
            aria-label="Produk berikutnya"
            className={cn(
              "absolute right-1 top-1/2 z-20 -translate-y-1/2",
              "flex h-9 w-9 items-center justify-center rounded-full",
              "bg-background/80 backdrop-blur-sm border border-border/60 shadow-md",
              "transition-all hover:bg-background hover:scale-110",
              "disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            )}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}
      {/* ============ Left: visual ============ */}
      <div className="relative hidden md:block bg-gradient-to-br from-secondary/40 via-secondary/20 to-background border-r border-border/40">
        <div className="flex h-full min-h-[400px] items-center justify-center p-8">
          <motion.div
            key={product.id}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="h-full w-full"
          >
            <ProductImage
              product={product}
              emojiClassName="text-[200px]"
              className="h-full min-h-[360px] rounded-2xl"
            />
          </motion.div>
        </div>
        {/* Single savings badge (was 2 redundant badges) */}
        {discount > 0 && (
          <div className="absolute left-4 top-4">
            <Badge className="bg-orange-500 text-white text-xs font-bold shadow-sm hover:bg-orange-500">
              -{discount}%
            </Badge>
          </div>
        )}
        {product.organic && (
          <div className={cn("absolute", discount > 0 ? "left-4 top-12" : "left-4 top-4")}>
            <Badge className="bg-primary text-primary-foreground text-xs font-bold shadow-sm">
              <Leaf className="h-3 w-3 mr-0.5" /> Organik
            </Badge>
          </div>
        )}
      </div>

      {/* ============ Right: info + actions ============ */}
      <div className="relative flex flex-col max-h-[92vh] md:max-h-[88vh]">
        {/* Design system accent bar — green top strip for modal consistency */}
        <div className="absolute inset-x-0 top-0 h-1 bg-primary z-10" />

        {/* Mobile visual header */}
        <div className="md:hidden relative bg-gradient-to-br from-secondary/40 to-background p-6 flex items-center justify-center pt-8">
          <div className="h-40 w-40">
            <ProductImage
              product={product}
              emojiClassName="text-7xl"
              className="h-full rounded-2xl"
            />
          </div>
          {discount > 0 && (
            <div className="absolute left-3 top-5">
              <Badge className="bg-orange-500 text-white text-xs font-bold">
                -{discount}%
              </Badge>
            </div>
          )}
          {product.organic && (
            <div className={cn("absolute", discount > 0 ? "left-3 top-11" : "left-3 top-5")}>
              <Badge className="bg-primary text-primary-foreground text-xs font-bold">
                <Leaf className="h-2.5 w-2.5 mr-0.5" /> Organik
              </Badge>
            </div>
          )}
          {/* Swipe hint — subtle dots showing position in product list (mobile) */}
          {canNavigate && (hasPrev || hasNext) && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 text-[10px] text-muted-foreground/60">
              <ChevronLeft className="h-3 w-3" />
              <span>Geser untuk lihat produk lain</span>
              <ChevronRight className="h-3 w-3" />
            </div>
          )}
        </div>

        <DialogHeader className="px-6 pt-6 pb-2 shrink-0 md:pt-7">
          <div className="flex items-start justify-between gap-3">
            <DialogTitle className="text-2xl font-bold leading-tight flex-1">
              {product.name}
            </DialogTitle>
            {/* Wishlist button — let user wishlist directly from detail
                dialog (before, only available on product card — E2 audit bug #1). */}
            <WishlistButton
              product={product}
              size="md"
              variant="inline"
              className="shrink-0 -mr-2 -mt-1"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <div className="flex items-center gap-1">
              <div className="flex" aria-label={`Rating ${rating.toFixed(1)} dari 5`}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={cn(
                      "h-4 w-4",
                      i < Math.round(rating)
                        ? "fill-amber-400 text-amber-400"
                        : "fill-muted text-muted"
                    )}
                  />
                ))}
              </div>
              <span className="font-semibold">{rating.toFixed(1)}</span>
              <span className="text-muted-foreground">
                {hasReviews ? `(${reviewCount} ulasan)` : "· Baru"}
              </span>
            </div>
            <Separator orientation="vertical" className="h-4" />
            <span className="flex items-center gap-1 text-muted-foreground">
              <Package className="h-3.5 w-3.5" />
              Stok: {effectiveStock} {effectiveUnit}
            </span>
          </div>
          {/* Weight/unit specification — critical for grocery context */}
          <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-foreground/70">
            <Scale className="h-3.5 w-3.5 text-primary" />
            <span>
              {product.category === "Paket"
                ? `Isi: campuran ${product.unit}`
                : `Berat: ±1 ${product.unit}`}
            </span>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 scrollbar-grocery max-h-[50vh] px-6">
          <div className="space-y-5 pb-4">
            {/* Price — single savings message (was 2 redundant badges) */}
            <div className="flex items-end gap-3">
              <div className="flex flex-col">
                {effectiveOldPrice && (
                  <span className="text-sm font-medium text-foreground/60 line-through decoration-red-500/70 decoration-2">
                    {formatIDR(effectiveOldPrice)}
                  </span>
                )}
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-extrabold text-primary">
                    {formatIDR(effectivePrice)}
                  </span>
                  <span className="text-sm text-muted-foreground">/{effectiveUnit}</span>
                </div>
              </div>
              {savings > 0 && (
                <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 mb-1 font-bold whitespace-nowrap shrink-0">
                  Hemat {formatIDR(savings)}
                </Badge>
              )}
            </div>

            {/* Delivery context — "Pengiriman besok" (green tint for brand harmony) */}
            <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-xs font-medium text-primary">
              <Truck className="h-4 w-4 shrink-0" />
              <span>Pengiriman besok — pilih slot saat checkout</span>
            </div>

            {/* Tags */}
            {product.tags && product.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {product.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="rounded-full text-xs capitalize">
                    #{tag}
                  </Badge>
                ))}
              </div>
            )}

            {/* Variant selector — pill buttons */}
            {variants.length > 0 && (
              <section>
                <h3 className="mb-2 text-sm font-semibold">Pilih Varian</h3>
                <div className="flex flex-wrap gap-2">
                  {variants.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVariant(v)}
                      className={cn(
                        "rounded-xl border px-3 py-2 text-xs font-semibold transition-all",
                        selectedVariant?.id === v.id
                          ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
                          : v.stock <= 0
                          ? "border-border/40 bg-muted/30 text-muted-foreground/50 cursor-not-allowed"
                          : "border-border hover:border-primary/50 hover:bg-accent/50"
                      )}
                      disabled={v.stock <= 0}
                    >
                      {v.name}
                      <span className="block text-xs font-normal text-muted-foreground">
                        {v.stock <= 0 ? "Habis" : formatIDR(v.price)}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Long description — relaxed line-height for readability */}
            <section>
              <h3 className="mb-2 text-sm font-semibold">Deskripsi</h3>
              <p className="text-sm text-foreground/70 leading-loose">
                {product.longDescription || product.description}
              </p>
            </section>

            {/* Benefits — elevated card matching design system */}
            {product.benefits && product.benefits.length > 0 && (
              <section className="relative overflow-hidden rounded-xl bg-gradient-to-br from-card via-card to-muted p-4 ring-1 ring-border shadow-[0_2px_4px_rgba(0,0,0,0.05),0_8px_24px_-8px_rgba(0,0,0,0.18)]">
                <div className="absolute inset-x-0 top-0 h-0.5 bg-primary" />
                <h3 className="mb-2.5 text-sm font-semibold flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Manfaat & Kandungan
                </h3>
                <ul className="space-y-1.5">
                  {product.benefits.map((benefit, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground/70">
                      <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Info grid: origin, storage, category — elevated cards matching design system */}
            <section className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <InfoRow
                icon={<MapPin className="h-4 w-4" />}
                label="Asal"
                value={product.origin || "Petani mitra SayurLogi"}
              />
              <InfoRow
                icon={<Package className="h-4 w-4" />}
                label="Kategori"
                value={product.category}
              />
              <InfoRow
                icon={<Snowflake className="h-4 w-4" />}
                label="Penyimpanan"
                value={product.storageTip || "Simpan di tempat sejuk."}
                full
              />
            </section>

            {/* Trust badges — elevated card matching design system */}
            <section className="relative overflow-hidden rounded-xl bg-gradient-to-br from-card via-card to-muted p-3 ring-1 ring-border shadow-[0_2px_4px_rgba(0,0,0,0.05),0_8px_24px_-8px_rgba(0,0,0,0.18)]">
              <div className="absolute inset-x-0 top-0 h-0.5 bg-primary" />
              <div className="grid grid-cols-3 gap-2">
                <TrustBadge icon={<Truck className="h-4 w-4" />} label="Antar 2 jam" />
                <TrustBadge icon={<ShieldCheck className="h-4 w-4" />} label="Garansi segar" />
                <TrustBadge icon={<Leaf className="h-4 w-4" />} label="Petani lokal" />
              </div>
            </section>
          </div>

          {/* Related Products — "Beli ini juga" cross-sell */}
          {relatedProducts && relatedProducts.length > 0 && onSelectRelated && (
            <section className="border-t border-border/40 pt-4">
              <h3 className="mb-3 text-sm font-semibold flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-primary" />
                Beli Ini Juga
              </h3>
              <div className="flex gap-3 overflow-x-auto scrollbar-grocery pb-2">
                {relatedProducts.slice(0, 6).map((rp) => (
                  <button
                    key={rp.id}
                    onClick={() => onSelectRelated(rp)}
                    className="group flex w-28 shrink-0 flex-col gap-1.5 text-left"
                  >
                    <div className="relative aspect-square overflow-hidden rounded-xl bg-secondary/30 ring-1 ring-border/50 transition-all group-hover:ring-primary/30">
                      <ProductImage
                        product={rp}
                        emojiClassName="text-3xl"
                        className="h-full w-full"
                      />
                      {rp.onSale && rp.oldPrice && (
                        <span className="absolute left-1.5 top-1.5 rounded bg-stone-900/90 px-1 py-0.5 text-[8px] font-bold text-white">
                          -{Math.round(((rp.oldPrice - rp.price) / rp.oldPrice) * 100)}%
                        </span>
                      )}
                    </div>
                    <p className="line-clamp-1 text-xs font-semibold leading-tight">{rp.name}</p>
                    <p className="text-xs font-extrabold text-primary">{formatIDR(rp.price)}</p>
                  </button>
                ))}
              </div>
            </section>
          )}
        </ScrollArea>

        {/* Sticky footer: qty stepper + add to cart.
            On mobile, this is the critical conversion bar — always visible above fold. */}
        {!effectiveOutOfStock ? (
          <div className="sticky bottom-0 border-t border-border/60 bg-background/95 backdrop-blur-lg supports-[backdrop-filter]:bg-background/85 p-3 md:p-4 shrink-0 shadow-[0_-2px_8px_-4px_rgba(0,0,0,0.1)]">
            {inCart && (
              <div className="mb-2.5 flex items-center justify-between rounded-lg bg-primary/5 px-3 py-2 text-xs">
                <span className="flex items-center gap-1.5 text-foreground/70">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                  Sudah ada <strong className="text-foreground">{inCart.quantity}</strong> di keranjang
                </span>
                <button
                  onClick={() => onOpenChange(false)}
                  className="font-semibold text-primary hover:underline"
                >
                  Lihat keranjang
                </button>
              </div>
            )}
            <div className="space-y-2">
              {/* Row 1: qty stepper + Tambah ke Keranjang (PRIMARY — grocery flow) */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-0.5 rounded-xl border border-border bg-secondary/30 p-1">
                  <button
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-foreground hover:bg-background transition-colors disabled:opacity-40 md:h-10 md:w-10"
                    aria-label="Kurangi jumlah"
                    disabled={qty <= 1}
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="min-w-8 text-center text-base font-bold tabular-nums md:min-w-10">{qty}</span>
                  <button
                    onClick={() => setQty((q) => Math.min(effectiveStock, q + 1))}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-foreground hover:bg-background transition-colors disabled:opacity-40 md:h-10 md:w-10"
                    aria-label="Tambah jumlah"
                    disabled={qty >= effectiveStock}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <Button
                  onClick={handleAddToCart}
                  size="lg"
                  className="h-11 flex-1 rounded-xl text-sm font-bold shadow-md transition-transform hover:scale-[1.01] md:h-12"
                >
                  <ShoppingCart className="h-4 w-4 mr-1.5" />
                  {inCart ? "Perbarui Keranjang" : "Tambah ke Keranjang"}
                </Button>
              </div>
              {/* Row 2: Beli Langsung (single secondary, no "Lanjut Belanja") */}
              <Button
                onClick={handleBuyNow}
                size="lg"
                variant="outline"
                className="h-11 w-full rounded-xl text-sm font-medium border-primary/40 text-primary hover:bg-primary/5 transition-transform hover:scale-[1.01] md:h-12"
              >
                Beli Langsung
              </Button>
            </div>
          </div>
        ) : (
          <div className="sticky bottom-0 border-t border-border/60 bg-destructive/5 p-4 shrink-0">
            <div className="flex items-center justify-center gap-2 text-destructive font-semibold">
              <Package className="h-5 w-5" />
              Maaf, varian ini sedang habis
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
  full,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  full?: boolean;
}) {
  return (
    <div className={cn(
      "relative flex items-start gap-2.5 overflow-hidden rounded-lg bg-gradient-to-br from-card via-card to-muted p-2.5 ring-1 ring-border/50",
      full && "sm:col-span-2"
    )}>
      <span className="text-primary mt-0.5">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-xs font-medium text-foreground break-words">{value}</p>
      </div>
    </div>
  );
}

function TrustBadge({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <span className="text-primary">{icon}</span>
      <span className="text-xs font-semibold text-foreground/70 leading-tight">{label}</span>
    </div>
  );
}
