"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { Header } from "@/components/grocery/header";
import { Hero } from "@/components/grocery/hero";
import { CategoryTabs } from "@/components/grocery/category-tabs";
import { ProductGrid } from "@/components/grocery/product-grid";
import { CartSheet } from "@/components/grocery/cart-sheet";
import { CheckoutDialog } from "@/components/grocery/checkout-dialog";
import { ProductDetailDialog } from "@/components/grocery/product-detail-dialog";
import { WishlistSheet } from "@/components/grocery/wishlist-sheet";
import { RecentlyViewedSection } from "@/components/grocery/recently-viewed-section";
import { useRecentlyViewed } from "@/hooks/use-recently-viewed";
import { AdvancedFilter, DEFAULT_FILTER, applyFilter, type FilterState } from "@/components/grocery/advanced-filter";
import { Footer } from "@/components/grocery/footer";
import { AboutSection } from "@/components/grocery/about-section";
import { TestimonialsSection } from "@/components/grocery/testimonials-section";
import { FaqSection } from "@/components/grocery/faq-section";
import { ContactSection } from "@/components/grocery/contact-section";
import { ContactSheet } from "@/components/grocery/contact-sheet";
import { BackToTop } from "@/components/grocery/back-to-top";
import { ServiceWorkerRegistration } from "@/components/grocery/sw-registration";
import { PWAInstallPrompt } from "@/components/grocery/pwa-install-prompt";
import { PromoBanner } from "@/components/grocery/promo-banner";
import { PromoCarousel } from "@/components/grocery/promo-carousel";
import { BestSellerCarousel } from "@/components/grocery/best-seller-carousel";
import { BottomNav } from "@/components/grocery/bottom-nav";
import { WelcomeBanner } from "@/components/grocery/welcome-banner";
import { useCartStore } from "@/lib/store/cart";
import { useWishlistStore } from "@/lib/store/wishlist";
import { AdminOverlay } from "@/components/admin/admin-overlay";
import { OrderTrackingDialog } from "@/components/grocery/order-tracking-dialog";
import { OrderHistoryDialog } from "@/components/grocery/order-history-dialog";
import { SharedWishlistDialog } from "@/components/grocery/shared-wishlist-dialog";
import { CustomerAuthDialog } from "@/components/grocery/customer-auth-dialog";
import { StickyCartBar } from "@/components/grocery/sticky-cart-bar";
import { useCustomerStore } from "@/lib/store/customer";
import { useCartStore as useCartStoreForCoupon } from "@/lib/store/cart";
import { toast } from "sonner";
import { Ticket } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Product, Category } from "@/types/grocery";
import type { PageContent } from "@/lib/page-content";

type SortKey = "popular" | "price-asc" | "price-desc" | "name";

interface HomeClientProps {
  content: PageContent;
}

export function HomeClient({ content }: HomeClientProps) {
  const [categories, setCategories] = useState<Category[]>(content.categories);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<"erpnext" | "db" | "mock" | null>(null);

  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("popular");
  const [filter, setFilter] = useState<FilterState>(DEFAULT_FILTER);

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const productSectionRef = useRef<HTMLDivElement>(null);
  const { add: addRecentlyViewed } = useRecentlyViewed();

  // Coupon auto-apply via ?coupon=CODE URL param
  const searchParams = useSearchParams();
  const router = useRouter();
  const autoApplyAttempted = useRef(false);
  const applyCoupon = useCartStoreForCoupon((s) => s.applyCoupon);
  const cartItems = useCartStoreForCoupon((s) => s.items);
  const existingCoupon = useCartStoreForCoupon((s) => s.coupon);

  useEffect(() => {
    if (autoApplyAttempted.current) return;
    const code = searchParams.get("coupon");
    if (!code) return;

    // Don't override existing coupon
    if (existingCoupon) {
      autoApplyAttempted.current = true;
      router.replace("/");
      return;
    }

    autoApplyAttempted.current = true;

    const tryApply = async () => {
      try {
        // Track click
        await fetch(`/api/coupons/${encodeURIComponent(code)}/track`, {
          method: "POST",
        }).catch(() => {});

        // If cart empty, show info toast
        if (cartItems.length === 0) {
          toast(`Kupon ${code.toUpperCase()} siap dipakai`, {
            description: "Tambahkan produk ke keranjang untuk menerapkan kupon otomatis.",
            icon: <Ticket className="h-4 w-4 text-green-600" />,
          });
          return;
        }

        // Validate coupon — send itemCode + category + price + quantity
        // so the server can compute subtotal + check product/category scope.
        const lines = cartItems.map((i) => ({
          itemCode: i.product.itemCode,
          category: i.product.category,
          price: i.product.price,
          quantity: i.quantity,
        }));

        const res = await fetch(`/api/coupons/${encodeURIComponent(code)}/validate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lines, shippingFee: 10000 }),
        });
        const data = await res.json();

        if (!data.valid) {
          toast.error(`Kupon ${code.toUpperCase()} tidak valid`, {
            description: data.reason,
          });
          return;
        }

        // Apply coupon to cart
        applyCoupon({
          code: data.coupon.code,
          type: data.coupon.type,
          value: data.coupon.value,
          discount: data.discount || 0,
          freeShipping: data.freeShipping,
          minOrder: data.coupon.minOrder,
        });

        toast.success(`Kupon ${code.toUpperCase()} diterapkan!`, {
          description: `Hemat Rp${(data.discount || 0).toLocaleString("id-ID")}`,
          icon: <Ticket className="h-4 w-4" />,
        });
      } catch {
        toast.error("Gagal menerapkan kupon dari URL");
      } finally {
        // Clean URL
        router.replace("/");
      }
    };

    const t = setTimeout(tryApply, 500);
    return () => clearTimeout(t);
  }, [searchParams, cartItems.length, existingCoupon, applyCoupon, router]);

  const handleOpenDetail = (product: Product) => {
    setDetailProduct(product);
    setDetailOpen(true);
    addRecentlyViewed(product);
  };

  // Categories come from server props (DB-driven with fallback).
  // No need to fetch client-side anymore.

  // Fetch products when category changes
  // Wrapped in useCallback so it can be called manually (e.g. after checkout)
  const fetchProducts = useCallback(() => {
    const url = activeCategory
      ? `/api/products?category=${encodeURIComponent(activeCategory)}`
      : "/api/products";
    return fetch(url)
      .then((r) => r.json())
      .then((data) => {
        setProducts(data.products || []);
        setSource(data.source || null);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [activeCategory]);

  useEffect(() => {
    let cancelled = false;
    fetchProducts().then(() => {
      if (cancelled) return;
    });
    return () => {
      cancelled = true;
    };
  }, [fetchProducts]);

  // Fetch customer profile on mount (cookie sent automatically).
  // Sets customer in store → header shows avatar instead of "Masuk".
  const fetchCustomer = useCustomerStore((s) => s.fetchCustomer);
  useEffect(() => {
    fetchCustomer();
  }, [fetchCustomer]);

  // Handler: called when checkout succeeds → re-fetch products to update stock
  const handleCheckoutSuccess = useCallback(() => {
    // Delay 2s to allow background ERPNext sync to complete
    setTimeout(() => {
      fetchProducts();
    }, 2000);
  }, [fetchProducts]);

  const handleCategoryChange = (id: string | null) => {
    setActiveCategory(id);
    setLoading(true);
  };

  // Filter + sort client-side (search + advanced filter + sort)
  const filteredProducts = useMemo(() => {
    let list = products;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
      );
    }
    // Apply advanced filter (price range, organic, on-sale, tags)
    list = applyFilter(list, filter);
    const sorted = [...list];
    switch (sort) {
      case "price-asc":
        sorted.sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        sorted.sort((a, b) => b.price - a.price);
        break;
      case "name":
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      default:
        // popular: onSale first, then by stock desc
        sorted.sort((a, b) => {
          if (a.onSale && !b.onSale) return -1;
          if (!a.onSale && b.onSale) return 1;
          return b.stock - a.stock;
        });
    }
    return sorted;
  }, [products, searchQuery, sort, filter]);

  const scrollToProducts = () => {
    productSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const [adminOpen, setAdminOpen] = useState(false);
  const [trackingOpen, setTrackingOpen] = useState(false);
  const [trackingId, setTrackingId] = useState<string | undefined>(undefined);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [contactSheetOpen, setContactSheetOpen] = useState(false);

  const handleTrackOrder = (id: string) => {
    setTrackingId(id);
    setTrackingOpen(true);
    setCheckoutOpen(false);
    setHistoryOpen(false);
  };

  return (
    <div className="flex min-h-screen flex-col">
      {/* Welcome Banner — full-screen modal on first visit.
          Renders only when enabled in admin > Promo tab AND user
          hasn't dismissed the current version yet. */}
      <WelcomeBanner
        content={{
          enabled: content.welcomeBannerEnabled,
          image: content.welcomeBannerImage,
          title: content.welcomeBannerTitle,
          description: content.welcomeBannerDescription,
          ctaText: content.welcomeBannerCtaText,
          ctaLink: content.welcomeBannerCtaLink,
          version: content.welcomeBannerVersion,
        }}
      />
      <Header
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        brandName={content.brandName ?? "SayurLogi"}
        // Pass DB-driven top bar fields (admin > Header tab).
        // All 4 fields are optional — when null/empty, that element
        // hides entirely (no default fallback). When ALL are empty,
        // the entire top bar hides.
        content={{
          topBarLocation: content.topBarLocation,
          topBarShipping: content.topBarShipping,
          contactPhone: content.contactPhone,
          topBarBadge: content.topBarBadge,
        }}
        onOpenOrderHistory={() => setHistoryOpen(true)}
      />

      <main className="flex-1">
        <Hero onShopNow={scrollToProducts} content={content} />

        {/* Promo banner (dismissible, persists via localStorage) */}
        <PromoBanner
          promoId={content.promoId ?? undefined}
          title={content.promoTitle ?? undefined}
          description={content.promoDescription ?? undefined}
        />

        {/* Products section */}
        <section
          id="belanja"
          ref={productSectionRef}
          className="scroll-mt-24"
        >
          {/* Sticky sub-nav: category pills + sort/filter. Sticks under the main header.
              Mobile header ≈ 65px (top-16), desktop header ≈ 94px (top-[94px]). */}
          <div className="sticky top-16 md:top-[94px] z-30 border-b border-border/40 bg-background/85 backdrop-blur-lg supports-[backdrop-filter]:bg-background/70">
            <div className="mx-auto max-w-7xl px-4 py-3">
              <div className="flex items-center gap-3">
                {/* Category tabs — horizontal scroll */}
                <div className="min-w-0 flex-1">
                  <CategoryTabs
                    categories={categories}
                    active={activeCategory}
                    onChange={handleCategoryChange}
                  />
                </div>
                {/* Sort + filter — compact */}
                <div className="flex shrink-0 items-center gap-1.5">
                  <AdvancedFilter products={products} filter={filter} onChange={setFilter} />
                  <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
                    <SelectTrigger className="w-[120px] h-8 rounded-full text-xs md:w-[140px] md:h-9 md:text-sm">
                      <SelectValue placeholder="Urutkan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="popular">Terpopuler</SelectItem>
                      <SelectItem value="price-asc">Harga Terendah</SelectItem>
                      <SelectItem value="price-desc">Harga Tertinggi</SelectItem>
                      <SelectItem value="name">Nama A-Z</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          {/* Section heading + content */}
          <div className="mx-auto max-w-7xl px-4 py-6 md:py-8">
            <div className="mb-5">
              <h2 className="text-xl font-bold tracking-tight md:text-2xl">Belanja Pilihan</h2>
              <p className="text-xs text-muted-foreground mt-0.5 md:text-sm">
                Pilih kategori atau cari produk favoritmu
              </p>
            </div>

            {/* Best Seller carousel — horizontal scroll, surfaces top products (mobile only) */}
            {!loading && !activeCategory && !searchQuery && (
              <BestSellerCarousel products={products} onOpenDetail={handleOpenDetail} />
            )}

            {/* Promo carousel — horizontal scroll, breaks vertical monotony */}
            {!loading && !activeCategory && !searchQuery && (
              <PromoCarousel products={products} onOpenDetail={handleOpenDetail} />
            )}

            {/* Recently viewed products (hidden until user opens at least 1 detail) */}
            <RecentlyViewedSection onProductClick={handleOpenDetail} />

            <ProductGrid
              products={filteredProducts}
              loading={loading}
              source={source}
              onOpenDetail={handleOpenDetail}
            />
          </div>
        </section>

        {/* About section */}
        <AboutSection content={content} />

        {/* Testimonials section */}
        <TestimonialsSection testimonials={content.testimonials} />

        {/* FAQ section */}
        <FaqSection faqs={content.faqs} onOpenContactSheet={() => setContactSheetOpen(true)} />

        {/* Contact section */}
        <ContactSection content={content} />
      </main>

      <Footer
        content={content}
        onTrackOrder={() => { setTrackingId(undefined); setTrackingOpen(true); }}
        onOrderHistory={() => setHistoryOpen(true)}
      />

      {/* Floating UI */}
      {/* onCheckout: close cart sheet first to prevent visual overlap
          (cart drawer was overlapping with checkout dialog, both
          showing totals + CTAs at the same time — E1 audit bug #1) */}
      <CartSheet onCheckout={() => { useCartStore.getState().closeCart(); setCheckoutOpen(true); }} />
      <CheckoutDialog
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        onTrackOrder={handleTrackOrder}
        onCheckoutSuccess={handleCheckoutSuccess}
      />
      <ProductDetailDialog
        product={detailProduct}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onBuyNow={() => setCheckoutOpen(true)}
        relatedProducts={detailProduct ? products.filter((p) => p.category === detailProduct.category && p.id !== detailProduct.id).slice(0, 6) : []}
        onSelectRelated={(p) => {
          setDetailProduct(p);
        }}
        // Swipe navigation: pass full product list + navigate handler.
        // Enabled when there are 2+ products. Backward compatible —
        // if products array is empty/undefined, swipe is disabled.
        products={products.length > 1 ? products : undefined}
        onNavigate={(p) => {
          setDetailProduct(p);
          // Scroll the dialog content back to top on navigate
          requestAnimationFrame(() => {
            const scrollArea = document.querySelector("[data-radix-scroll-area-viewport]");
            if (scrollArea) scrollArea.scrollTop = 0;
          });
        }}
      />
      <WishlistSheet onProductClick={handleOpenDetail} />
      <ContactSheet
        open={contactSheetOpen}
        onOpenChange={setContactSheetOpen}
        content={content}
      />
      <OrderTrackingDialog
        open={trackingOpen}
        onOpenChange={setTrackingOpen}
        initialTrackingId={trackingId}
      />
      <OrderHistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        onTrackOrder={handleTrackOrder}
      />
      <BackToTop />

      {/* PWA: service worker registration + install prompt */}
      <ServiceWorkerRegistration />
      <PWAInstallPrompt />

      {/* Mobile bottom navigation — native app feel (4 items + elevated cart FAB) */}
      <BottomNav
        onOpenCart={() => useCartStore.getState().openCart()}
        onOpenWishlist={() => useWishlistStore.getState().openWishlist()}
      />

      {/* Admin overlay (hidden by default, Ctrl+Shift+A or footer button) */}
      <AdminOverlay open={adminOpen} onOpenChange={setAdminOpen} />

      {/* Shared wishlist dialog — opens when ?wishlist=<token> is present.
          Wrapped in Suspense because useSearchParams requires it. */}
      <Suspense fallback={null}>
        <SharedWishlistDialog />
      </Suspense>

      {/* Sticky mobile cart bar — shows when cart has items */}
      <StickyCartBar />

      {/* Customer auth dialog (login/register) — controlled by useCustomerStore */}
      <CustomerAuthDialog />
    </div>
  );
}
