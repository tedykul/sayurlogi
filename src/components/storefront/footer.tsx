"use client";

import { Leaf, Heart } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-auto border-t bg-muted/30">
      <div className="container mx-auto max-w-6xl px-4 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-green-600 flex items-center justify-center text-white">
              <Leaf className="h-3 w-3" />
            </div>
            <span className="font-semibold text-foreground">SayurLogi</span>
            <span>— Sayur & Buah Segar</span>
          </div>
          <p className="flex items-center gap-1 text-xs">
            Dibuat dengan <Heart className="h-3 w-3 text-red-500 fill-red-500" /> · Demo Coupon Module
          </p>
        </div>
      </div>
    </footer>
  );
}
