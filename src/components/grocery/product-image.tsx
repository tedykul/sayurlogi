"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Product } from "@/types/grocery";

// ============================================================
// ProductImage — shows product photo if available, emoji fallback.
// ============================================================
// Handles image load errors gracefully (falls back to emoji).
// Uses next/image-free approach (plain img) for simplicity in this
// sandbox environment. In production, use next/image for optimization.
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
}

export function ProductImage({
  product,
  emojiClassName = "text-7xl",
  className,
  animateOnHover = false,
  alt,
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
        loading="lazy"
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
