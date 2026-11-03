"use client";

import { useRecentlyViewedStore } from "@/lib/store/recently-viewed";
import type { Product } from "@/types/grocery";

// ============================================================
// useRecentlyViewed — convenience hook wrapping the zustand store.
// Single source of truth via zustand (unlike local useState which
// creates separate state per component instance).
// ============================================================

export function useRecentlyViewed() {
  const items = useRecentlyViewedStore((s) => s.items);
  const add = useRecentlyViewedStore((s) => s.add);
  const clear = useRecentlyViewedStore((s) => s.clear);

  return { items, add, clear, mounted: true };
}
