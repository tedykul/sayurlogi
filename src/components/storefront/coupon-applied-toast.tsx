"use client";

import { useEffect } from "react";
import { useCartStore } from "@/lib/store/cart";
import { toast } from "sonner";
import { Ticket } from "lucide-react";

// ============================================================
// CouponAppliedToast — listens for coupon changes and shows
// a persistent badge-style toast when a coupon is applied.
// ============================================================
// Mounted once in HomeClient. Watches cart store for coupon
// changes. When coupon is set, shows a celebratory toast.
// When removed, shows an info toast.
// ============================================================

export function CouponAppliedToast() {
  const coupon = useCartStore((s) => s.coupon);

  useEffect(() => {
    if (!coupon) return;
    const label =
      coupon.type === "percent"
        ? `${coupon.value}%`
        : coupon.type === "fixed"
          ? `Rp${coupon.value.toLocaleString("id-ID")}`
          : "Gratis Ongkir";

    toast.success(`Kupon ${coupon.code} aktif`, {
      description: `Diskon: ${label} · Hemat Rp${coupon.discount.toLocaleString("id-ID")}`,
      icon: <Ticket className="h-4 w-4" />,
      duration: 4000,
    });
  }, [coupon?.code]);

  return null;
}
