"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Header } from "@/components/storefront/header";
import { Footer } from "@/components/storefront/footer";
import { ProductGrid } from "@/components/storefront/product-grid";
import { CartSheet } from "@/components/storefront/cart-sheet";
import { CouponAppliedToast } from "@/components/storefront/coupon-applied-toast";
import { AdminOverlay } from "@/components/admin/admin-overlay";
import { useCartStore } from "@/lib/store/cart";
import { publicFetch } from "@/lib/api";
import { toast } from "sonner";
import { Ticket } from "lucide-react";
import type { AppliedCoupon, Coupon } from "@/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function HomeClient() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const applyCoupon = useCartStore((s) => s.applyCoupon);
  const items = useCartStore((s) => s.items);
  const existingCoupon = useCartStore((s) => s.coupon);
  const searchParams = useSearchParams();
  const router = useRouter();
  const autoApplyAttempted = useRef(false);

  // Auto-apply coupon from ?coupon= URL query param.
  // Waits for cart items to be loaded first (from localStorage persistence).
  useEffect(() => {
    if (autoApplyAttempted.current) return;
    const code = searchParams.get("coupon");
    if (!code) return;

    // Don't override existing coupon
    if (existingCoupon) {
      autoApplyAttempted.current = true;
      // Clean URL
      router.replace("/");
      return;
    }

    autoApplyAttempted.current = true;

    const tryApply = async () => {
      try {
        // Track click (analytics)
        await publicFetch(`/api/coupons/${encodeURIComponent(code)}/track`, {
          method: "POST",
        }).catch(() => {});

        // Need cart items to validate — if empty, show toast telling user to add items first
        if (items.length === 0) {
          toast(`Kupon ${code.toUpperCase()} siap dipakai`, {
            description: "Tambahkan produk ke keranjang untuk menerapkan kupon otomatis.",
            icon: <Ticket className="h-4 w-4 text-green-600" />,
          });
          return;
        }

        const lines = items.map((i) => ({
          productId: i.product.id,
          name: i.product.name,
          price: i.product.price,
          quantity: i.quantity,
          category: i.product.category,
        }));

        const data = await publicFetch<{
          valid: boolean;
          reason?: string;
          discount: number;
          freeShipping: boolean;
          coupon?: Coupon;
        }>(`/api/coupons/${encodeURIComponent(code)}/validate`, {
          method: "POST",
          body: JSON.stringify({ lines, shippingFee: 10000 }),
        });

        if (!data.valid) {
          toast.error(`Kupon ${code.toUpperCase()} tidak valid`, {
            description: data.reason,
          });
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
        toast.success(`Kupon ${code.toUpperCase()} diterapkan!`, {
          description: `Hemat Rp${data.discount.toLocaleString("id-ID")}`,
          icon: <Ticket className="h-4 w-4" />,
        });
      } catch (err) {
        toast.error("Gagal menerapkan kupon dari URL");
        console.error(err);
      } finally {
        // Clean URL coupon param (so refresh doesn't re-apply)
        router.replace("/");
      }
    };

    // Small delay to let persisted cart hydrate
    const t = setTimeout(tryApply, 300);
    return () => clearTimeout(t);
  }, [searchParams, items.length, existingCoupon]);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-green-50/50 to-background">
      <Header />

      {/* Hero */}
      <section className="border-b bg-gradient-to-br from-green-600 to-emerald-700 text-white">
        <div className="container mx-auto max-w-6xl px-4 py-10 sm:py-14">
          <div className="max-w-2xl">
            <span className="inline-block px-3 py-1 rounded-full bg-white/15 text-xs font-medium backdrop-blur mb-3">
              🎫 Sekarang dengan Kupon Diskon!
            </span>
            <h1 className="text-3xl sm:text-4xl font-bold leading-tight">
              Sayur & Buah Segar
              <br />
              <span className="text-green-200">Dipetik pagi, sampai rumah siang</span>
            </h1>
            <p className="mt-3 text-green-100 text-sm sm:text-base">
              Belanja mudah, pakai kupon dari WhatsApp buat hemat lebih. Coba klik link
              share kupon dan lihat magic-nya!
            </p>
            <div className="mt-4 flex gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 backdrop-blur text-xs">
                ✅ Auto-apply kupon via URL
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 backdrop-blur text-xs">
                📱 Share via WhatsApp
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 backdrop-blur text-xs">
                🖨 Export PDF + QR
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 backdrop-blur text-xs">
                🔌 Backend ERPNext
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Search + category filter */}
      <section className="sticky top-14 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="container mx-auto max-w-6xl px-4 py-2.5 flex gap-2 items-center">
          <Input
            placeholder="Cari produk..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 max-w-xs"
          />
          <div className="flex gap-1 overflow-x-auto flex-1">
            <Button
              variant={!activeCategory ? "default" : "ghost"}
              size="sm"
              className="h-9 shrink-0"
              onClick={() => setActiveCategory(null)}
            >
              Semua
            </Button>
            <Button
              variant={activeCategory === "Sayuran" ? "default" : "ghost"}
              size="sm"
              className="h-9 shrink-0"
              onClick={() => setActiveCategory("Sayuran")}
            >
              Sayuran
            </Button>
            <Button
              variant={activeCategory === "Buah" ? "default" : "ghost"}
              size="sm"
              className="h-9 shrink-0"
              onClick={() => setActiveCategory("Buah")}
            >
              Buah
            </Button>
          </div>
        </div>
      </section>

      {/* Products */}
      <main className="flex-1 container mx-auto max-w-6xl px-4 py-6">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-lg font-bold">
            {activeCategory ?? "Semua Produk"}
          </h2>
          <span className="text-xs text-muted-foreground">
            {searchQuery ? `Pencarian: "${searchQuery}"` : "Pilih produk segar"}
          </span>
        </div>
        <ProductGrid category={activeCategory ?? undefined} searchQuery={searchQuery} />
      </main>

      <Footer />

      {/* Floating elements */}
      <CartSheet />
      <CouponAppliedToast />
      <AdminOverlay />
    </div>
  );
}
