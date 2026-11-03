import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Product } from "@/types/grocery";

// ============================================================
// Wishlist Store — Zustand with localStorage persistence
// ============================================================
// Stores full Product objects so wishlist drawer can render
// without re-fetching. Cap at 50 items to avoid bloat.
// ============================================================

const MAX_WISHLIST = 50;

interface WishlistState {
  items: Product[];
  isOpen: boolean;
  // actions
  toggle: (product: Product) => void;
  remove: (productId: string) => void;
  clear: () => void;
  has: (productId: string) => boolean;
  openWishlist: () => void;
  closeWishlist: () => void;
  // selectors
  getCount: () => number;
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,

      toggle: (product) => {
        const items = get().items;
        const exists = items.find((p) => p.id === product.id);
        if (exists) {
          set({ items: items.filter((p) => p.id !== product.id) });
        } else {
          // Prepend new item, cap at MAX_WISHLIST
          set({ items: [product, ...items].slice(0, MAX_WISHLIST) });
        }
      },

      remove: (productId) =>
        set({ items: get().items.filter((p) => p.id !== productId) }),

      clear: () => set({ items: [] }),

      has: (productId) => get().items.some((p) => p.id === productId),

      openWishlist: () => set({ isOpen: true }),
      closeWishlist: () => set({ isOpen: false }),

      getCount: () => get().items.length,
    }),
    {
      name: "grocery-wishlist",
      partialize: (state) => ({ items: state.items }),
    }
  )
);
