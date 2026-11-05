"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useCartStore } from "@/lib/store/cart";
import { publicFetch } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, Ticket, X } from "lucide-react";
import type { AppliedCoupon, Coupon } from "@/types";

interface CouponInputProps {
  shippingFee: number;
}

interface ValidateResponse {
  success: boolean;
  valid: boolean;
  reason?: string;
  code: string;
  discount: number;
  freeShipping: boolean;
  coupon?: Coupon;
}

export function CouponInput({ shippingFee }: CouponInputProps) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const applyCoupon = useCartStore((s) => s.applyCoupon);
  const items = useCartStore((s) => s.items);

  const handleApply = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      toast.error("Masukkan kode kupon");
      return;
    }
    if (items.length === 0) {
      toast.error("Keranjang masih kosong");
      return;
    }

    setLoading(true);
    try {
      const lines = items.map((i) => ({
        productId: i.product.id,
        name: i.product.name,
        price: i.product.price,
        quantity: i.quantity,
        category: i.product.category,
      }));
      const data = await publicFetch<ValidateResponse>(
        `/api/coupons/${encodeURIComponent(trimmed)}/validate`,
        {
          method: "POST",
          body: JSON.stringify({ lines, shippingFee }),
        }
      );

      if (!data.valid) {
        toast.error(data.reason || "Kupon tidak valid");
        return;
      }

      const applied: AppliedCoupon = {
        code: data.coupon!.code,
        type: data.coupon!.type,
        value: data.coupon!.value,
        discount: data.discount,
        freeShipping: data.freeShipping,
        minOrder: data.coupon!.minOrder,
      };
      applyCoupon(applied);
      toast.success(`Kupon ${data.coupon!.code} diterapkan! Hemat Rp${data.discount.toLocaleString("id-ID")}`);
      setCode("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menerapkan kupon");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Ticket className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleApply()}
            placeholder="Kode kupon (cth. WELCOME10)"
            className="pl-8 h-9 uppercase"
            disabled={loading}
          />
        </div>
        <Button onClick={handleApply} disabled={loading} size="sm" className="h-9">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Pakai"}
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Coba: <Badge variant="secondary" className="text-[10px] cursor-pointer" onClick={() => setCode("WELCOME10")}>WELCOME10</Badge>{" "}
        <Badge variant="secondary" className="text-[10px] cursor-pointer" onClick={() => setCode("ONGKIR0")}>ONGKIR0</Badge>
      </p>
    </div>
  );
}

export function AppliedCouponBanner() {
  const coupon = useCartStore((s) => s.coupon);
  const removeCoupon = useCartStore((s) => s.removeCoupon);

  if (!coupon) return null;

  const label =
    coupon.type === "percent"
      ? `Diskon ${coupon.value}%`
      : coupon.type === "fixed"
        ? `Potongan Rp${coupon.value.toLocaleString("id-ID")}`
        : "Gratis Ongkir";

  return (
    <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-green-50 border border-green-200">
      <div className="flex items-center gap-2 min-w-0">
        <Ticket className="h-4 w-4 text-green-600 shrink-0" />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-sm text-green-800">{coupon.code}</span>
            <Badge variant="outline" className="text-[10px] h-4 py-0 text-green-700 border-green-300">
              {label}
            </Badge>
          </div>
          <p className="text-[10px] text-green-700">
            {coupon.freeShipping
              ? "Ongkir gratis"
              : `Hemat Rp${coupon.discount.toLocaleString("id-ID")}`}
          </p>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-muted-foreground hover:text-red-500 shrink-0"
        onClick={removeCoupon}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
