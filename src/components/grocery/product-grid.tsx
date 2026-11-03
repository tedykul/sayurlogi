"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { ProductCard } from "./product-card";
import type { Product } from "@/types/grocery";
import { Skeleton } from "@/components/ui/skeleton";

interface ProductGridProps {
  products: Product[];
  loading: boolean;
  source: "erpnext" | "db" | "mock" | null;
  /** Forwarded to each ProductCard. Optional for backward compat. */
  onOpenDetail?: (product: Product) => void;
}

const INITIAL_COUNT = 8;
const LOAD_MORE_COUNT = 8;

export function ProductGrid({ products, loading, source, onOpenDetail }: ProductGridProps) {
  const [visibleCount, setVisibleCount] = useState(INITIAL_COUNT);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Track the previous product list key so we can reset pagination
  // when category/search/filter changes — using the documented
  // "adjusting state during render" pattern (no setState in effect).
  const currentKey = useMemo(() => products.map((p) => p.id).join(","), [products]);
  const [prevKey, setPrevKey] = useState(currentKey);
  if (currentKey !== prevKey) {
    setPrevKey(currentKey);
    setVisibleCount(INITIAL_COUNT);
    setIsLoadingMore(false);
  }

  const visibleProducts = products.slice(0, visibleCount);
  const hasMore = visibleCount < products.length;

  // IntersectionObserver for infinite scroll
  // Loads LOAD_MORE_COUNT more products when sentinel becomes visible.
  // Cleanup on unmount. Reset observer when products list changes.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && !isLoadingMore) {
          setIsLoadingMore(true);
          // Small delay for smooth UX + loading indicator visibility
          setTimeout(() => {
            setVisibleCount((c) => Math.min(c + LOAD_MORE_COUNT, products.length));
            setIsLoadingMore(false);
          }, 300);
        }
      },
      {
        rootMargin: "200px", // trigger 200px before sentinel is visible = pre-load
        threshold: 0,
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, products.length]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 md:gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-5 xl:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex flex-col rounded-2xl bg-card">
            <Skeleton className="aspect-square w-full rounded-2xl" />
            <div className="flex flex-col gap-1.5 p-2.5">
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3 w-full" />
              <div className="flex justify-between pt-1">
                <Skeleton className="h-5 w-14" />
                <Skeleton className="h-8 w-8 rounded-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
        <span className="text-4xl">🔍</span>
        <h3 className="text-base font-semibold">Produk tidak ditemukan</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Coba ubah kata kunci pencarian atau pilih kategori lain.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs">
        <span className="text-foreground/80">
          Menampilkan <span className="font-bold text-foreground">{visibleProducts.length}</span> dari{" "}
          <span className="font-bold text-foreground">{products.length}</span> produk
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 md:gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-5 xl:grid-cols-5">
        {visibleProducts.map((p, i) => (
          <ProductCard key={p.id} product={p} index={i} onOpenDetail={onOpenDetail} />
        ))}
      </div>

      {/* Infinite scroll sentinel — invisible trigger element.
          When this enters viewport (200px margin), IntersectionObserver
          fires and loads LOAD_MORE_COUNT more products.
          Shows loading spinner while fetching.
          Hidden when all products are loaded (hasMore = false). */}
      {hasMore && (
        <div
          ref={sentinelRef}
          className="flex items-center justify-center py-6"
          aria-label="Memuat produk lainnya"
          role="status"
        >
          {isLoadingMore ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span>Memuat produk lainnya...</span>
            </div>
          ) : (
            <div className="h-4 w-4" aria-hidden="true" />
          )}
        </div>
      )}

      {/* End-of-list indicator — shows when all products are loaded */}
      {!hasMore && products.length > INITIAL_COUNT && (
        <div className="flex items-center justify-center py-4">
          <span className="text-xs text-muted-foreground">
            ✓ Semua {products.length} produk telah ditampilkan
          </span>
        </div>
      )}
    </div>
  );
}
