"use client";

// ============================================================
// loading.tsx — Global loading state (Next.js App Router).
// ============================================================
// Shown automatically while route segments are loading.
// Displays branded loading animation for minimum 1.5 seconds
// so users see the brand, not just a flash.
// ============================================================

import { useEffect, useState } from "react";
import { Leaf } from "lucide-react";

export default function Loading() {
  const [show, setShow] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShow(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  if (!show) return null;

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <Leaf className="h-7 w-7 text-primary animate-pulse" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
          <div className="h-2.5 w-2.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
          <div className="h-2.5 w-2.5 rounded-full bg-primary animate-bounce" />
        </div>
        <p className="text-sm text-muted-foreground">Memuat SayurLogi...</p>
      </div>
    </div>
  );
}
