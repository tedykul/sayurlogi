"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCartStore } from "@/lib/store/cart";
import { toast } from "sonner";
import { Plus, Check } from "lucide-react";
import { useState } from "react";
import type { Product } from "@/types";

export function ProductCard({ product }: { product: Product }) {
  const addItem = useCartStore((s) => s.addItem);
  const [added, setAdded] = useState(false);

  const outOfStock = !product.stock || product.stock <= 0;

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
      {/* Image placeholder — colored block w/ category emoji */}
      <div className="aspect-square rounded-lg bg-gradient-to-br from-green-100 to-emerald-50 flex items-center justify-center text-4xl">
        {product.category === "Buah" ? "🍎" : "🥬"}
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
        <div className="flex items-center justify-between mt-1">
          <span className="font-bold text-green-700">
            Rp{product.price.toLocaleString("id-ID")}
          </span>
          <span className="text-[10px] text-muted-foreground">
            Stok: {product.stock}
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
