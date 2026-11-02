"use client";

import { useState, useEffect } from "react";
import { publicFetch } from "@/lib/api";
import type { Product } from "@/types";
import { ProductCard } from "./product-card";
import { Skeleton } from "@/components/ui/skeleton";

interface ProductGridProps {
  category?: string;
  searchQuery?: string;
}

// ============================================================
// ProductGrid — fetches products by category, filters by search.
// ============================================================
// Uses derived loading state (loadedCategory !== category) to
// comply with React 19's "no setState in effect body" rule.
// ============================================================

export function ProductGrid({ category, searchQuery }: ProductGridProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Track which category we've successfully loaded, so loading
  // state is derived (no setState(true) needed in effect body).
  const [loadedCategory, setLoadedCategory] = useState<string | null | undefined>(undefined);

  const currentCategory = category ?? null;
  const loading = loadedCategory !== currentCategory;

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const url = currentCategory
      ? `/api/products?category=${encodeURIComponent(currentCategory)}`
      : "/api/products";

    publicFetch<{ success: boolean; products: Product[] }>(url, { signal: controller.signal })
      .then((data) => {
        if (cancelled) return;
        setProducts(data.products);
        setError(null);
        setLoadedCategory(currentCategory);
      })
      .catch((err) => {
        if (cancelled || err.name === "AbortError") return;
        setError(err.message);
        setProducts([]);
        setLoadedCategory(currentCategory);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [currentCategory]);

  const filtered = searchQuery
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : products;

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-48 rounded-xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Gagal memuat produk: {error}
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Tidak ada produk ditemukan.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {filtered.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}
