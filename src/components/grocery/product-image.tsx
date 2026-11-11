"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Product } from "@/types/grocery";

// ============================================================
// ProductImage — shows product photo if available, emoji fallback.
// ============================================================
// Handles image load errors gracefully (falls back to emoji).
//
// Phase 2 performance polish:
// - `decoding="async"`: browser decodes image off main thread → faster render
// - `width`/`height` attributes: reserve aspect-ratio box → prevent CLS
//   (Cumulative Layout Shift) saat image load
// - `loading="lazy"`: already present (above-the-fold images skip this)
// - `fetchPriority="high"`: opt-in untuk hero/above-fold (caller passes)
//
// Production note: for full optimization (WebP/AVIF conversion, responsive
// srcset), use next/image. Current plain img is OK for sandbox + most cases
// because images are already small PNGs in /public/products/.
// ============================================================

interface ProductImageProps {
  product: Product;
  /** Size class for emoji fallback (e.g., "text-7xl", "text-3xl") */
  emojiClassName?: string;
  /** Wrapper className */
  className?: string;
  /** Whether to animate emoji on hover (for product cards) */
  animateOnHover?: boolean;
  /** Alt text for image (defaults to product name) */
  alt?: string;
  /** Phase 2: priority for above-the-fold images (hero, featured).
   *  Sets fetchPriority="high" + removes lazy loading. Default: false. */
  priority?: boolean;
}

export function ProductImage({
  product,
  emojiClassName = "text-7xl",
  className,
  animateOnHover = false,
  alt,
  priority = false,
}: ProductImageProps) {
  const [imageError, setImageError] = useState(false);
  const showImage = product.image && !imageError;

  if (showImage) {
    return (
      <img
        src={product.image}
        alt={alt || product.name}
        className={cn("w-full h-full object-cover", className)}
        onError={() => setImageError(true)}
        // Phase 2: async decoding off main thread → faster first paint
        decoding="async"
        // Phase 2: lazy load (skip for priority/above-fold images)
        loading={priority ? "eager" : "lazy"}
        // Phase 2: fetchPriority hint (high for hero, auto default)
        fetchPriority={priority ? "high" : "auto"}
        // Phase 2: explicit width/height attributes prevent CLS — browser
        // reserves the box before image loads. Caller's CSS (h-full w-full)
        // overrides these visual dimensions, but aspect ratio is preserved.
        width={400}
        height={400}
      />
    );
  }

  // Fallback: emoji on gradient background
  return (
    <div className={cn("flex h-full w-full items-center justify-center bg-gradient-to-br from-secondary/40 to-secondary/10", className)}>
      <span
        className={cn(
          "select-none drop-shadow-md transition-transform duration-300",
          emojiClassName,
          animateOnHover && "group-hover:scale-110 group-hover:rotate-3"
        )}
      >
        {product.emoji}
      </span>
    </div>
  );
}
