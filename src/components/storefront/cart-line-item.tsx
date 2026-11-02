"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Minus, Plus, Trash2 } from "lucide-react";
import type { CartItem } from "@/types";

interface CartLineItemProps {
  item: CartItem;
  onUpdateQty: (qty: number) => void;
}

export function CartLineItem({ item, onUpdateQty }: CartLineItemProps) {
  const { product, quantity } = item;

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="h-14 w-14 rounded-lg bg-gradient-to-br from-green-100 to-emerald-50 flex items-center justify-center text-2xl shrink-0">
        {product.category === "Buah" ? "🍎" : "🥬"}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-sm leading-tight line-clamp-1">{product.name}</h4>
        <p className="text-xs text-muted-foreground">
          Rp{product.price.toLocaleString("id-ID")} / item
        </p>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex items-center border rounded-md h-7">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onUpdateQty(quantity - 1)}
              disabled={quantity <= 1}
            >
              <Minus className="h-3 w-3" />
            </Button>
            <span className="w-8 text-center text-sm font-medium">{quantity}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onUpdateQty(quantity + 1)}
              disabled={quantity >= product.stock}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-red-500"
            onClick={() => onUpdateQty(0)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="font-bold text-sm text-green-700">
          Rp{(product.price * quantity).toLocaleString("id-ID")}
        </p>
      </div>
    </div>
  );
}
