import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem, Product } from "@/types/grocery";

// ============================================================
// Cart Store — Zustand with localStorage persistence
// ============================================================

interface CartState {
  items: CartItem[];
  isOpen: boolean;
  // actions
  addItem: (product: Product, qty?: number) => void;
  removeItem: (productId: string) => void;
  updateQty: (productId: string, qty: number) => void;
  clear: () => void;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  // selectors
  getTotalItems: () => number;
  getTotalPrice: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,

      addItem: (product, qty = 1) => {
        // Block add if out of stock
        if (!product.stock || product.stock <= 0) return;
      if (!product.price || product.price <= 0) return;
        const items = get().items;
        const existing = items.find((i) => i.product.id === product.id);
        if (existing) {
          set({
            items: items.map((i) =>
              i.product.id === product.id
                ? { ...i, quantity: Math.min(i.quantity + qty, product.stock) }
                : i
            ),
          });
        } else {
          set({ items: [...items, { product, quantity: Math.min(qty, product.stock) }] });
        }
        set({ isOpen: true }); // open cart on add
      },

      removeItem: (productId) =>
        set({ items: get().items.filter((i) => i.product.id !== productId) }),

      updateQty: (productId, qty) =>
        set({
          items: get()
            .items.map((i) =>
              i.product.id === productId
                ? { ...i, quantity: Math.max(0, Math.min(qty, i.product.stock)) }
                : i
            )
            .filter((i) => i.quantity > 0),
        }),

      clear: () => set({ items: [] }),
      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),
      toggleCart: () => set({ isOpen: !get().isOpen }),

      getTotalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
      getTotalPrice: () =>
        get().items.reduce((sum, i) => sum + i.product.price * i.quantity, 0),
    }),
    {
      name: "grocery-cart",
      partialize: (state) => ({ items: state.items }), // persist only items
    }
  )
);
