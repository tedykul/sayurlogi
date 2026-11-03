"use client";

import { useState, useEffect, useCallback } from "react";
import { Home, ShoppingCart, Heart, HelpCircle } from "lucide-react";
import { useCartStore } from "@/lib/store/cart";
import { useWishlistStore } from "@/lib/store/wishlist";
import { cn } from "@/lib/utils";

// ============================================================
// BottomNav — mobile-only native app navigation.
// ============================================================
// 4-item pattern with elevated center cart FAB (Instagram/GoFood style):
// - Beranda (home anchor)
// - Keranjang (elevated FAB, conversion-critical, badge with item count)
// - Wishlist (return engagement)
// - Bantuan (FAQ + Contact combined)
//
// Features:
// - Auto-hide on scroll down, show on scroll up (modern pattern)
// - Haptic feedback on tap (vibration API)
// - Scroll spy: active item based on visible section
// - z-40 (below modals/sheets at z-50+)
// - Desktop: hidden (md:hidden) — desktop uses header nav
// ============================================================

type NavItem = {
  id: string;
  label: string;
  icon: typeof Home;
  action: () => void;
  badge?: number;
};

interface BottomNavProps {
  /** Open cart sheet */
  onOpenCart: () => void;
  /** Open wishlist sheet */
  onOpenWishlist: () => void;
}

export function BottomNav({ onOpenCart, onOpenWishlist }: BottomNavProps) {
  const [activeSection, setActiveSection] = useState("beranda");
  const [visible, setVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  const totalItems = useCartStore((s) => s.getTotalItems());
  const wishlistCount = useWishlistStore((s) => s.getCount());
  const isCartOpen = useCartStore((s) => s.isOpen);

  // Scroll handler: auto-hide on scroll down, show on scroll up + scroll spy
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // Auto-hide logic
      if (currentScrollY > lastScrollY && currentScrollY > 200) {
        // Scrolling down + past 200px → hide
        setVisible(false);
      } else {
        // Scrolling up or near top → show
        setVisible(true);
      }
      setLastScrollY(currentScrollY);

      // Scroll spy: detect active section
      const sections = ["beranda", "belanja", "tentang", "faq", "kontak"];
      const offset = 150; // account for sticky header + sub-nav
      let current = "beranda";
      for (const sectionId of sections) {
        const el = document.getElementById(sectionId);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= offset && rect.bottom >= offset) {
            current = sectionId;
            break;
          }
        }
      }
      setActiveSection(current);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  // Hide bottom nav when cart sheet is open (derived state, no effect needed)
  const showNav = visible && !isCartOpen;

  // Haptic feedback (vibration API — native app feel)
  const hapticTap = useCallback(() => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(10);
      } catch {
        // ignore — vibration not supported
      }
    }
  }, []);

  // Scroll to section
  const scrollToSection = useCallback(
    (sectionId: string) => {
      hapticTap();
      const el = document.getElementById(sectionId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    },
    [hapticTap]
  );

  // Handle cart tap
  const handleCartTap = useCallback(() => {
    hapticTap();
    onOpenCart();
  }, [hapticTap, onOpenCart]);

  // Handle wishlist tap
  const handleWishlistTap = useCallback(() => {
    hapticTap();
    onOpenWishlist();
  }, [hapticTap, onOpenWishlist]);

  // Handle bantuan tap — scroll to FAQ (which has link to Contact below)
  const handleBantuanTap = useCallback(() => {
    hapticTap();
    scrollToSection("faq");
  }, [hapticTap, scrollToSection]);

  const navItems: NavItem[] = [
    {
      id: "beranda",
      label: "Beranda",
      icon: Home,
      action: () => {
        hapticTap();
        window.scrollTo({ top: 0, behavior: "smooth" });
      },
    },
    {
      id: "cart",
      label: "Keranjang",
      icon: ShoppingCart,
      action: handleCartTap,
      badge: totalItems,
    },
    {
      id: "wishlist",
      label: "Wishlist",
      icon: Heart,
      action: handleWishlistTap,
      badge: wishlistCount,
    },
    {
      id: "bantuan",
      label: "Bantuan",
      icon: HelpCircle,
      action: handleBantuanTap,
    },
  ];

  // Determine active item for visual state
  const getIsActive = (itemId: string) => {
    if (itemId === "beranda") return activeSection === "beranda" || activeSection === "belanja";
    if (itemId === "bantuan") return activeSection === "faq" || activeSection === "kontak";
    return false;
  };

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-40 md:hidden transition-transform duration-300 ease-out",
        showNav ? "translate-y-0" : "translate-y-full"
      )}
      aria-label="Navigasi bawah"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
          <div className="relative border-t border-border/60 bg-background/95 backdrop-blur-lg supports-[backdrop-filter]:bg-background/85 shadow-[0_-2px_8px_-4px_rgba(0,0,0,0.1)]">
            <div className="flex items-stretch h-16">
              {navItems.map((item, index) => {
                const Icon = item.icon;
                const isActive = getIsActive(item.id);
                // Center items (index 1, 2) get elevated FAB treatment
                const isCenter = index === 1; // cart = center elevated

                if (isCenter) {
                  // Elevated cart FAB
                  return (
                    <button
                      key={item.id}
                      onClick={item.action}
                      className="relative flex flex-1 flex-col items-center justify-end pb-1.5 active:scale-95 transition-transform"
                      aria-label={`${item.label}${item.badge ? ` (${item.badge} item)` : ""}`}
                    >
                      {/* Elevated FAB circle */}
                      <div className="relative -mt-5 mb-0.5">
                        <div
                          className={cn(
                            "flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/40 ring-4 ring-background transition-all active:scale-90",
                            isActive && "ring-primary/20"
                          )}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        {/* Cart badge */}
                        {item.badge !== undefined && item.badge > 0 && (
                          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground ring-2 ring-background">
                            {item.badge > 99 ? "99+" : item.badge}
                          </span>
                        )}
                      </div>
                      <span
                        className={cn(
                          "text-[10px] font-medium transition-colors",
                          isActive ? "text-primary font-semibold" : "text-muted-foreground"
                        )}
                      >
                        {item.label}
                      </span>
                    </button>
                  );
                }

                // Regular items (Beranda, Wishlist, Bantuan)
                return (
                  <button
                    key={item.id}
                    onClick={item.action}
                    className="relative flex flex-1 flex-col items-center justify-center gap-1 pt-2 pb-1.5 active:scale-95 transition-transform"
                    aria-label={`${item.label}${item.badge ? ` (${item.badge} item)` : ""}`}
                  >
                    {/* Active top accent bar */}
                    {isActive && (
                      <span className="absolute top-0 h-0.5 w-8 rounded-full bg-primary" />
                    )}
                    <div className="relative">
                      <Icon
                        className={cn(
                          "h-5 w-5 transition-all",
                          isActive ? "text-primary scale-110" : "text-muted-foreground"
                        )}
                      />
                      {/* Badge for wishlist */}
                      {item.badge !== undefined && item.badge > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white ring-2 ring-background">
                          {item.badge > 99 ? "99+" : item.badge}
                        </span>
                      )}
                    </div>
                    <span
                      className={cn(
                        "text-[10px] font-medium transition-colors",
                        isActive ? "text-primary font-semibold" : "text-muted-foreground"
                      )}
                    >
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
    </nav>
  );
}
