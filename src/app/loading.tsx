"use client";

// ============================================================
// loading.tsx — Global loading state (Next.js App Router).
// ============================================================
// Shows branded loading animation for minimum 1.5 seconds.
// Uses custom logo if /logo-uploaded.png exists, otherwise
// falls back to default Leaf icon.
// ============================================================

import { useEffect, useState } from "react";
import { Leaf } from "lucide-react";

export default function Loading() {
  const [show, setShow] = useState(true);
  const [logoExists, setLogoExists] = useState(false);
  const [imgError, setImgError] = useState(false);

  // Check if custom logo exists (once on mount)
  useEffect(() => {
    fetch("/logo-uploaded.png", { method: "HEAD" })
      .then((res) => setLogoExists(res.ok))
      .catch(() => setLogoExists(false));
  }, []);

  // Minimum display time (1.5s)
  useEffect(() => {
    const timer = setTimeout(() => setShow(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  if (!show) return null;

  // Show custom logo or fallback to Leaf icon
  const showCustomLogo = logoExists && !imgError;

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 overflow-hidden">
            {showCustomLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src="/logo-uploaded.png"
                alt="Loading"
                className="h-10 w-10 object-contain animate-pulse"
                onError={() => setImgError(true)}
              />
            ) : (
              <Leaf className="h-7 w-7 text-primary animate-pulse" />
            )}
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
