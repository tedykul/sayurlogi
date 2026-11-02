"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Product, CartItem, AppliedCoupon } from "@/types";

// ============================================================
// Cart store — Zustand with localStorage persistence.
// ============================================================
// Tracks cart items + applied coupon. Coupon is validated
// server-side before being committed here (applyCoupon calls
// /api/coupons/[code]/validate).
// ============================================================

interface CartState {
  items: CartItem[];
  coupon: AppliedCoupon | null;
  isOpen: boolean;
  // item actions
  addItem: (product: Product, qty?: number) => void;
  removeItem: (productId: string) => void;
  updateQty: (productId: string, qty: number) => void;
  clear: () => void;
  // coupon actions
  applyCoupon: (coupon: AppliedCoupon) => void;
  removeCoupon: () => void;
  // sheet actions
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  // selectors
  getTotalItems: () => number;
  getSubtotal: () => number;
  getDiscount: () => number;
  getTotal: (shippingFee: number) => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      coupon: null,
      isOpen: false,

      addItem: (product, qty = 1) => {
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
          set({
            items: [...items, { product, quantity: Math.min(qty, product.stock) }],
          });
        }
        // Invalidate applied coupon (cart changed — needs re-validation)
        if (get().coupon) set({ coupon: null });
        set({ isOpen: true });
      },

      removeItem: (productId) => {
        set({ items: get().items.filter((i) => i.product.id !== productId) });
        // Invalidate coupon — subtotal changed
        if (get().coupon) set({ coupon: null });
      },

      updateQty: (productId, qty) => {
        set({
          items: get()
            .items.map((i) =>
              i.product.id === productId
                ? { ...i, quantity: Math.max(0, Math.min(qty, i.product.stock)) }
                : i
            )
            .filter((i) => i.quantity > 0),
        });
        if (get().coupon) set({ coupon: null });
      },

      clear: () => set({ items: [], coupon: null }),
      applyCoupon: (coupon) => set({ coupon }),
      removeCoupon: () => set({ coupon: null }),

      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),
      toggleCart: () => set({ isOpen: !get().isOpen }),

      getTotalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
      getSubtotal: () =>
        get().items.reduce((sum, i) => sum + i.product.price * i.quantity, 0),
      getDiscount: () => get().coupon?.discount ?? 0,
      getTotal: (shippingFee) => {
        const subtotal = get().getSubtotal();
        const discount = get().getDiscount();
        const shipping = get().coupon?.freeShipping ? 0 : shippingFee;
        return Math.max(0, subtotal - discount) + shipping;
      },
    }),
    {
      name: "sayurlogi-cart",
      partialize: (state) => ({ items: state.items, coupon: state.coupon }),
    }
  )
);
