"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCartStore } from "@/lib/store/cart";
import { toast } from "sonner";
import { Plus, Check } from "lucide-react";
import { useState } from "react";
import type { Product } from "@/types";

// ============================================================
// ProductCard — catalog tile.
// ============================================================
// Visual priority:
//   1. product.image (ERPNext-hosted photo via /api/erp-image proxy)
//   2. product.emoji (fallback glyph)
//   3. category-based emoji (last resort)
//
// Shows oldPrice (crossed-out) when product is on sale, and a
// "Sale" badge when oldPrice > price. Stock shown with unit.
// ============================================================

export function ProductCard({ product }: { product: Product }) {
  const addItem = useCartStore((s) => s.addItem);
  const [added, setAdded] = useState(false);

  const outOfStock = !product.stock || product.stock <= 0;
  const onSale = product.oldPrice && product.oldPrice > product.price;

  // Fallback emoji: product.emoji → category-based.
  const emoji = product.emoji || (product.category === "Buah" ? "🍎" : "🥬");

  const handleAdd = () => {
    if (outOfStock) {
      toast.error("Produk habis");
      return;
    }
    addItem(product, 1);
    setAdded(true);
    toast.success(`${product.name} ditambahkan`);
    setTimeout(() => setAdded(false), 1200);
  };

  return (
    <Card className="group relative overflow-hidden p-3 transition-all hover:shadow-lg hover:-translate-y-0.5 flex flex-col gap-2">
      {/* Image area: real photo if available, else emoji glyph. */}
      <div className="aspect-square rounded-lg bg-gradient-to-br from-green-100 to-emerald-50 flex items-center justify-center text-4xl overflow-hidden relative">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              // If ERPNext image fails to load, swap to emoji fallback.
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <span>{emoji}</span>
        )}
        {onSale && (
          <Badge className="absolute top-1.5 left-1.5 h-5 text-[10px] py-0 bg-rose-600">
            Sale
          </Badge>
        )}
      </div>

      <div className="flex-1 flex flex-col gap-1">
        <Badge variant="outline" className="self-start text-[10px] py-0 h-5">
          {product.category}
        </Badge>
        <h3 className="font-semibold text-sm leading-tight line-clamp-2">
          {product.name}
        </h3>
        <p className="text-xs text-muted-foreground line-clamp-1">
          {product.description}
        </p>
        <div className="flex items-baseline gap-1.5 mt-1">
          <span className="font-bold text-green-700">
            Rp{product.price.toLocaleString("id-ID")}
          </span>
          {onSale && (
            <span className="text-[11px] text-muted-foreground line-through">
              Rp{product.oldPrice!.toLocaleString("id-ID")}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">
            /{product.unit}
          </span>
          <span className={`text-[10px] ${outOfStock ? "text-rose-600" : "text-muted-foreground"}`}>
            {outOfStock ? "Habis" : `Stok: ${product.stock}`}
          </span>
        </div>
      </div>

      <Button
        size="sm"
        onClick={handleAdd}
        disabled={outOfStock}
        className="w-full h-9"
        variant={added ? "secondary" : "default"}
      >
        {added ? (
          <>
            <Check className="h-4 w-4 mr-1" /> Ditambahkan
          </>
        ) : (
          <>
            <Plus className="h-4 w-4 mr-1" /> Tambah
          </>
        )}
      </Button>
    </Card>
  );
}
