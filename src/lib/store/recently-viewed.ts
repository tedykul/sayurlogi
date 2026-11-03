import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Product } from "@/types/grocery";

// ============================================================
// Recently Viewed Store — Zustand with localStorage persistence
// ============================================================
// Tracks products user opened in detail modal. Most recent first.
// Cap at 8 items. Single source of truth (unlike hook-based approach
// which creates separate state per component instance).
// ============================================================

const MAX_ITEMS = 8;

interface RecentlyViewedState {
  items: Product[];
  // actions
  add: (product: Product) => void;
  clear: () => void;
  // selectors
  getCount: () => number;
}

export const useRecentlyViewedStore = create<RecentlyViewedState>()(
  persist(
    (set, get) => ({
      items: [],

      add: (product) => {
        const items = get().items;
        // Remove if exists, prepend, cap at MAX_ITEMS
        const filtered = items.filter((p) => p.id !== product.id);
        set({ items: [product, ...filtered].slice(0, MAX_ITEMS) });
      },

      clear: () => set({ items: [] }),

      getCount: () => get().items.length,
    }),
    {
      name: "grocery-recently-viewed",
      partialize: (state) => ({ items: state.items }),
    }
  )
);
