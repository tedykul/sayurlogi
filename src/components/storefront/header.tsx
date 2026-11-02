"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCartStore } from "@/lib/store/cart";
import { useAdminStore } from "@/lib/store/admin";
import { ShoppingCart, Settings, Leaf } from "lucide-react";

export function Header() {
  const totalItems = useCartStore((s) => s.getTotalItems());
  const toggleCart = useCartStore((s) => s.toggleCart);
  const openAdmin = useAdminStore((s) => s.open);

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-green-600 flex items-center justify-center text-white">
            <Leaf className="h-4 w-4" />
          </div>
          <div>
            <h1 className="font-bold text-base leading-none">SayurLogi</h1>
            <p className="text-[10px] text-muted-foreground">Sayur & Buah Segar</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={openAdmin}
            title="Admin Dashboard"
            className="h-9 w-9"
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={toggleCart}
            className="relative h-9"
          >
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden sm:inline ml-2">Keranjang</span>
            {totalItems > 0 && (
              <Badge
                variant="default"
                className="absolute -top-2 -right-2 h-5 min-w-5 px-1 text-[10px] flex items-center justify-center"
              >
                {totalItems}
              </Badge>
            )}
          </Button>
        </div>
      </div>
    </header>
  );
}
