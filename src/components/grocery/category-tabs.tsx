"use client";

import { useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";
import type { Category } from "@/types/grocery";
import { cn } from "@/lib/utils";

interface CategoryTabsProps {
  categories: Category[];
  active: string | null;
  onChange: (id: string | null) => void;
  /**
   * Optional product count per category. When provided, a count badge
   * appears on the active pill (Phase 2 polish — Shopee/Tokopedia pattern).
   * Keys are category IDs, values are product counts. The "Semua" pill
   * shows the total (sum of all counts) when provided.
   *
   * Backward compatible: if undefined, no badge renders (original behavior).
   */
  productCounts?: Record<string, number>;
}

// ============================================================
// CategoryTabs — horizontal scrollable category pills.
// ============================================================
// UI/UX polish (4 phases combined):
//
// Phase 1 — Scroll indicator (fade edge):
//   Mask-image linear-gradient at right edge hints "more pills →"
//   when scrollWidth > clientWidth. Sayurbox pattern.
//
// Phase 2 — Product count badge on active pill:
//   Optional `productCounts` prop → badge shows on active pill only.
//   Helps user gauge category size before tapping. Shopee pattern.
//
// Phase 3 — Active pill scale + shadow + Filter button prominent:
//   Active state: scale-[1.02] + shadow-md (was: no scale, flat shadow).
//   Makes active selection more prominent (Shopee bold-active pattern).
//
// Phase 4 — "Semua" pill slightly bolder:
//   Default "Semua" pill uses font-semibold (others font-medium) to
//   signal it as the "all products" default selection. Sayurbox pattern.
//
// Backward compatible:
//   - Props API extended with optional `productCounts` (no break to callers
//     that don't pass it).
//   - All existing behavior preserved when `productCounts` is undefined.
// ============================================================

export function CategoryTabs({ categories, active, onChange, productCounts }: CategoryTabsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // Track whether the scroll container has overflow (more pills than visible).
  // When true, render the fade-edge mask to hint "scroll for more".
  const [hasOverflow, setHasOverflow] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const check = () => {
      setHasOverflow(el.scrollWidth > el.clientWidth + 4);
    };
    check();
    // Re-check on resize (pills may reflow, container may change width).
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [categories]);

  // Compute total for "Semua" badge (sum of all category counts).
  const totalCount = productCounts
    ? Object.values(productCounts).reduce((s, n) => s + n, 0)
    : undefined;

  return (
    <div
      ref={scrollRef}
      className={cn(
        "flex gap-2 overflow-x-auto scrollbar-none pb-1 -mx-1 px-1",
        // Phase 1: fade-edge mask when overflow exists. Mask-image is a
        // linear gradient that's fully opaque until ~95% width, then fades
        // to transparent at the right edge — creating a subtle "more →"
        // hint without visual clutter. Active only when hasOverflow true.
        hasOverflow && "[mask-image:linear-gradient(to_right,black_0%,black_92%,transparent_100%)]"
      )}
    >
      <CategoryPill
        active={active === null}
        onClick={() => onChange(null)}
        emoji="🛒"
        label="Semua"
        count={totalCount}
        // Phase 4: "Semua" default pill is slightly bolder to signal it's
        // the all-products selection (Sayurbox pattern).
        bold
      />
      {categories.map((c) => (
        <CategoryPill
          key={c.id}
          active={active === c.id}
          onClick={() => onChange(c.id)}
          emoji={c.emoji}
          label={c.name}
          count={productCounts?.[c.id]}
        />
      ))}
    </div>
  );
}

function CategoryPill({
  active,
  onClick,
  emoji,
  label,
  count,
  bold = false,
}: {
  active: boolean;
  onClick: () => void;
  emoji: string;
  label: string;
  count?: number;
  bold?: boolean;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2.5 text-[13px] transition-all whitespace-nowrap min-h-[44px]",
        bold ? "font-semibold" : "font-medium",
        active
          ? // Phase 3: active pill scale up + shadow-md (was: no scale, shadow-sm only).
            // Makes active selection more prominent (Shopee bold-active pattern).
            "bg-primary text-primary-foreground shadow-md scale-[1.02]"
          : "bg-secondary/60 text-foreground ring-1 ring-border/50 hover:bg-accent hover:ring-border"
      )}
      aria-pressed={active}
    >
      <span className="text-sm">{emoji}</span>
      {label}
      {/* Phase 2: product count badge on active pill.
          Shows count of products in this category (Shopee/Tokopedia pattern).
          Only renders when count is provided AND pill is active — avoids
          visual clutter when inactive. */}
      {active && count !== undefined && count > 0 && (
        <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-foreground/20 px-1.5 text-[10px] font-bold tabular-nums">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </motion.button>
  );
}
