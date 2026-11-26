import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem, Product, ProductVariant } from "@/types/grocery";

export interface AppliedCoupon {
  code: string;
  type: "percent" | "fixed" | "free_shipping";
  value: number;
  discount: number;
  freeShipping: boolean;
  minOrder: number;
}

function lineKey(productId: string, variantSku?: string): string {
  return variantSku ? `${productId}::${variantSku}` : productId;
}

interface CartState {
  items: CartItem[];
  isOpen: boolean;
  coupon: AppliedCoupon | null;
  addItem: (product: Product, qty?: number, variant?: ProductVariant) => void;
  removeItem: (productId: string, variantSku?: string) => void;
  updateQty: (productId: string, qty: number, variantSku?: string) => void;
  clear: () => void;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  applyCoupon: (coupon: AppliedCoupon) => void;
  removeCoupon: () => void;
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

      addItem: (product, qty = 1, variant) => {
        const effectiveStock = variant?.stock ?? product.stock;
        const effectivePrice = variant?.price ?? product.price;
        if (!effectiveStock || effectiveStock <= 0) return;
        if (!effectivePrice || effectivePrice <= 0) return;
        const variantSku = variant?.sku;
        const key = lineKey(product.id, variantSku);
        const items = get().items;
        const existing = items.find(
          (i) => lineKey(i.product.id, i.variant?.sku) === key
        );
        if (existing) {
          set({
            items: items.map((i) =>
              lineKey(i.product.id, i.variant?.sku) === key
                ? { ...i, quantity: Math.min(i.quantity + qty, effectiveStock) }
                : i
            ),
          });
        } else {
          set({
            items: [
              ...items,
              {
                product,
                quantity: Math.min(qty, effectiveStock),
                ...(variant ? { variant } : {}),
              },
            ],
          });
        }
        set({ isOpen: true });
      },

      removeItem: (productId, variantSku) => {
        const key = lineKey(productId, variantSku);
        set({
          items: get().items.filter(
            (i) => lineKey(i.product.id, i.variant?.sku) !== key
          ),
        });
      },

      updateQty: (productId, qty, variantSku) => {
        const key = lineKey(productId, variantSku);
        set({
          items: get()
            .items.map((i) => {
              if (lineKey(i.product.id, i.variant?.sku) !== key) return i;
              const stock = i.variant?.stock ?? i.product.stock;
              return { ...i, quantity: Math.max(0, Math.min(qty, stock)) };
            })
            .filter((i) => i.quantity > 0),
        });
      },

      clear: () => set({ items: [], coupon: null }),
      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),
      toggleCart: () => set({ isOpen: !get().isOpen }),
      applyCoupon: (coupon) => set({ coupon }),
      removeCoupon: () => set({ coupon: null }),

      getTotalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
      getTotalPrice: () =>
        get().items.reduce(
          (sum, i) => sum + (i.variant?.price ?? i.product.price) * i.quantity,
          0
        ),
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
