"use client";

import { ShoppingCart, Leaf, Search, MapPin, Phone, Heart, Truck } from "lucide-react";
import { useCartStore } from "@/lib/store/cart";
import { useWishlistStore } from "@/lib/store/wishlist";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { MainNav, MobileNav } from "./main-nav";
import { CustomerMenuButton } from "./customer-menu-button";

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  /** Brand name from DB (defaults to "SayurLogi") */
  brandName?: string;
  /** Called when user clicks "Riwayat Pesanan" in the customer menu. */
  onOpenOrderHistory?: () => void;
}

export function Header({ searchQuery, onSearchChange, brandName = "SayurLogi", onOpenOrderHistory }: HeaderProps) {
  const totalItems = useCartStore((s) => s.getTotalItems());
  const openCart = useCartStore((s) => s.openCart);
  const wishlistCount = useWishlistStore((s) => s.getCount());
  const openWishlist = useWishlistStore((s) => s.openWishlist);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/85 backdrop-blur-lg supports-[backdrop-filter]:bg-background/70 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_4px_12px_-4px_rgba(0,0,0,0.08)]">
      {/* ============ Top bar (desktop only) — tinted bg, better contrast ============ */}
      <div className="hidden md:block border-b border-border/40 bg-gradient-to-r from-primary/8 via-primary/5 to-primary/8">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-1.5 text-[13px] text-foreground/70">
          <div className="flex items-center gap-5">
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-primary" />
              <span className="font-medium">Antar seluruh kota</span>
              <span className="text-muted-foreground">·</span>
              <span className="flex items-center gap-1 text-foreground/60">
                <Truck className="h-3.5 w-3.5 text-primary" />
                Gratis ongkir min. Rp50rb
              </span>
            </span>
            <a
              href="tel:080012345678"
              className="flex items-center gap-1.5 hover:text-primary transition-colors"
            >
              <Phone className="h-3.5 w-3.5 text-primary" />
              <span className="font-medium">0800-1234-5678</span>
            </a>
          </div>
          <span className="flex items-center gap-1.5 text-primary font-semibold">
            <Leaf className="h-3.5 w-3.5" />
            Petani Lokal • 100% Segar
          </span>
        </div>
      </div>

      {/* ============ Main header ============ */}
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 py-2.5 md:gap-5 md:px-4 md:py-3">
        {/* Logo — elevated container matching design system */}
        <a
          href="#beranda"
          className="flex shrink-0 items-center gap-2 rounded-xl p-1 -m-1 transition-colors hover:bg-accent/50"
          aria-label={`${brandName} beranda`}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/20 md:h-10 md:w-10">
            <Leaf className="h-4 w-4 md:h-5 md:w-5" />
          </div>
          <div className="hidden sm:flex flex-col leading-none">
            <span className="text-base font-bold tracking-tight text-foreground md:text-lg">{brandName}</span>
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Sayur & Buah Segar</span>
          </div>
        </a>

        {/* Desktop navigation */}
        <MainNav />

        {/* Search bar — elevated with ring + focus state */}
        <div className="relative flex-1 max-w-xl ml-auto">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            placeholder="Cari sayur, buah, atau paket hemat..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-10 pl-9 pr-4 rounded-full bg-secondary/60 border-border/60 ring-1 ring-border/50 transition-all focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary/40"
            aria-label="Cari produk"
          />
        </div>

        {/* Right actions — mobile: theme only (cart + wishlist in bottom nav)
            Desktop: theme + wishlist + cart + hamburger */}
        <div className="flex items-center gap-1 md:gap-1.5">
          <ThemeToggle />

          {/* Wishlist button — desktop only (mobile moved to bottom nav) */}
          <Button
            variant="ghost"
            size="icon"
            onClick={openWishlist}
            className="relative hidden md:flex h-10 w-10 rounded-full hover:bg-accent transition-all hover:scale-105 active:scale-95"
            aria-label={`Wishlist${wishlistCount > 0 ? ` (${wishlistCount} item)` : ""}`}
            title="Wishlist favorit"
          >
            <Heart className={`h-5 w-5 transition-colors ${wishlistCount > 0 ? "fill-rose-500 text-rose-500" : "text-foreground"}`} />
            {wishlistCount > 0 && (
              <Badge
                variant="secondary"
                className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 flex items-center justify-center rounded-full bg-rose-500 text-white text-[10px] font-bold ring-2 ring-background"
              >
                {wishlistCount}
              </Badge>
            )}
          </Button>

          {/* Customer account — login button or avatar dropdown */}
          <CustomerMenuButton onOpenOrderHistory={onOpenOrderHistory} />

          {/* Cart button — desktop only (mobile moved to bottom nav center FAB) */}
          <Button
            onClick={openCart}
            className="relative hidden md:flex h-10 rounded-full px-3.5 shadow-sm ring-1 ring-primary/20 transition-all hover:shadow-md hover:scale-105 active:scale-95 md:px-5"
            size="default"
            aria-label={`Keranjang belanja${totalItems > 0 ? ` (${totalItems} item)` : ""}`}
          >
            <ShoppingCart className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline font-medium">Keranjang</span>
            {totalItems > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-1.5 -right-1.5 h-5 min-w-5 px-1.5 flex items-center justify-center rounded-full text-xs font-bold ring-2 ring-background"
              >
                {totalItems}
              </Badge>
            )}
          </Button>
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
