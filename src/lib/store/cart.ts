import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem, Product } from "@/types/grocery";

// ============================================================
// Cart Store — Zustand with localStorage persistence
// ============================================================
// Also manages applied coupon (discount, free shipping) for
// checkout flow. Coupon is persisted so it survives page refresh.
// ============================================================

export interface AppliedCoupon {
  code: string;
  type: "percent" | "fixed" | "free_shipping";
  value: number;
  discount: number; // calculated IDR amount off
  freeShipping: boolean;
  minOrder: number;
}

interface CartState {
  items: CartItem[];
  isOpen: boolean;
  coupon: AppliedCoupon | null;
  // actions
  addItem: (product: Product, qty?: number) => void;
  removeItem: (productId: string) => void;
  updateQty: (productId: string, qty: number) => void;
  clear: () => void;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  applyCoupon: (coupon: AppliedCoupon) => void;
  removeCoupon: () => void;
  // selectors
  getTotalItems: () => number;
  getTotalPrice: () => number;
  getDiscountedTotal: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      coupon: null,

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

      clear: () => set({ items: [], coupon: null }),
      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),
      toggleCart: () => set({ isOpen: !get().isOpen }),

      applyCoupon: (coupon) => set({ coupon }),
      removeCoupon: () => set({ coupon: null }),

      getTotalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
      getTotalPrice: () =>
        get().items.reduce((sum, i) => sum + i.product.price * i.quantity, 0),
      getDiscountedTotal: () => {
        const subtotal = get().getTotalPrice();
        const discount = get().coupon?.discount ?? 0;
        return Math.max(0, subtotal - discount);
      },
    }),
    {
      name: "grocery-cart",
      partialize: (state) => ({ items: state.items, coupon: state.coupon }),
    }
  )
);
