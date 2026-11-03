"use client";

import { useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { SlidersHorizontal, X, Leaf, Check } from "lucide-react";
import { formatIDR } from "@/lib/mock-data";
import type { Product } from "@/types/grocery";
import { cn } from "@/lib/utils";

export interface FilterState {
  /** [min, max] price in IDR */
  priceRange: [number, number];
  organicOnly: boolean;
  onSaleOnly: boolean;
  /** Selected tag chips: "lokal" | "impor" | "segar" | etc. */
  tags: string[];
}

export const DEFAULT_FILTER: FilterState = {
  priceRange: [0, 200000],
  organicOnly: false,
  onSaleOnly: false,
  tags: [],
};

interface AdvancedFilterProps {
  products: Product[];
  filter: FilterState;
  onChange: (filter: FilterState) => void;
}

/** All unique tags across the product list (used for chip options). */
function collectTags(products: Product[]): string[] {
  const set = new Set<string>();
  for (const p of products) {
    for (const t of p.tags || []) set.add(t);
  }
  return Array.from(set).sort();
}

export function AdvancedFilter({ products, filter, onChange }: AdvancedFilterProps) {
  // Derive min/max from products (fallback to defaults)
  const bounds = useMemo(() => {
    if (products.length === 0) return { min: 0, max: 200000 };
    const prices = products.map((p) => p.price);
    return {
      min: Math.floor(Math.min(...prices) / 1000) * 1000,
      max: Math.ceil(Math.max(...prices) / 1000) * 1000,
    };
  }, [products]);

  const allTags = useMemo(() => collectTags(products), [products]);

  // Count of active filters (for badge display)
  const activeCount =
    (filter.priceRange[0] > bounds.min || filter.priceRange[1] < bounds.max ? 1 : 0) +
    (filter.organicOnly ? 1 : 0) +
    (filter.onSaleOnly ? 1 : 0) +
    filter.tags.length;

  const hasActiveFilter = activeCount > 0;

  const reset = () => onChange(DEFAULT_FILTER);

  const toggleTag = (tag: string) => {
    const tags = filter.tags.includes(tag)
      ? filter.tags.filter((t) => t !== tag)
      : [...filter.tags, tag];
    onChange({ ...filter, tags });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="h-9 rounded-full text-sm gap-1.5"
          aria-label="Filter lanjutan"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filter
          {hasActiveFilter && (
            <Badge className="ml-1 h-5 min-w-5 px-1.5 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
              {activeCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="end">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Filter Lanjutan</h4>
            {hasActiveFilter && (
              <button
                onClick={reset}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              >
                <X className="h-3 w-3" /> Reset
              </button>
            )}
          </div>

          <Separator />

          {/* Price range */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">Rentang Harga</span>
              <span className="text-muted-foreground tabular-nums">
                {formatIDR(filter.priceRange[0])} - {formatIDR(filter.priceRange[1])}
              </span>
            </div>
            <Slider
              min={bounds.min}
              max={bounds.max}
              step={1000}
              value={filter.priceRange}
              onValueChange={(v) =>
                onChange({ ...filter, priceRange: [v[0], v[1]] as [number, number] })
              }
              className="py-2"
              aria-label="Rentang harga"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
              <span>{formatIDR(bounds.min)}</span>
              <span>{formatIDR(bounds.max)}</span>
            </div>
          </div>

          <Separator />

          {/* Toggles */}
          <div className="space-y-2">
            <span className="text-xs font-medium">Tampilkan hanya</span>
            <div className="grid grid-cols-2 gap-2">
              <ToggleChip
                active={filter.organicOnly}
                onClick={() => onChange({ ...filter, organicOnly: !filter.organicOnly })}
                icon={<Leaf className="h-3.5 w-3.5" />}
                label="Organik"
              />
              <ToggleChip
                active={filter.onSaleOnly}
                onClick={() => onChange({ ...filter, onSaleOnly: !filter.onSaleOnly })}
                icon={<span className="text-xs">%</span>}
                label="Diskon"
              />
            </div>
          </div>

          {/* Tags */}
          {allTags.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <span className="text-xs font-medium">Tag</span>
                <div className="flex flex-wrap gap-1.5">
                  {allTags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs capitalize transition-colors",
                        filter.tags.includes(tag)
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-foreground hover:border-primary/50"
                      )}
                    >
                      {filter.tags.includes(tag) && <Check className="inline h-3 w-3 mr-0.5" />}
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ToggleChip({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-all",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-card text-foreground hover:border-primary/50"
      )}
    >
      {icon}
      {label}
      {active && <Check className="h-3 w-3" />}
    </button>
  );
}

/** Apply filter state to a product list. Pure function, reusable. */
export function applyFilter(products: Product[], filter: FilterState): Product[] {
  return products.filter((p) => {
    // Price range
    if (p.price < filter.priceRange[0] || p.price > filter.priceRange[1]) return false;
    // Organic
    if (filter.organicOnly && !p.organic) return false;
    // On sale
    if (filter.onSaleOnly && !p.onSale) return false;
    // Tags (AND logic — product must have ALL selected tags)
    if (filter.tags.length > 0) {
      const productTags = p.tags || [];
      for (const t of filter.tags) {
        if (!productTags.includes(t)) return false;
      }
    }
    return true;
  });
}
