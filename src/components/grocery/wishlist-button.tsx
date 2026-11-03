"use client";

import { Heart } from "lucide-react";
import { motion } from "framer-motion";
import { useWishlistStore } from "@/lib/store/wishlist";
import type { Product } from "@/types/grocery";
import { cn } from "@/lib/utils";

interface WishlistButtonProps {
  product: Product;
  /** Size variant. Default "sm" (card overlay). */
  size?: "sm" | "md" | "lg";
  /** Position variant. Default "overlay" (absolute top-right). */
  variant?: "overlay" | "inline";
  className?: string;
}

/**
 * Heart toggle button for adding/removing product from wishlist.
 * Persistent across sessions via localStorage (zustand persist).
 */
export function WishlistButton({
  product,
  size = "sm",
  variant = "overlay",
  className,
}: WishlistButtonProps) {
  const has = useWishlistStore((s) => s.has);
  const toggle = useWishlistStore((s) => s.toggle);
  const isWishlisted = has(product.id);

  const sizeClasses = {
    sm: "h-7 w-7",
    md: "h-9 w-9",
    lg: "h-10 w-10",
  };
  const iconSizes = {
    sm: "h-3.5 w-3.5",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggle(product);
  };

  if (variant === "inline") {
    return (
      <button
        onClick={handleClick}
        className={cn(
          "flex items-center justify-center rounded-full transition-colors",
          sizeClasses[size],
          isWishlisted
            ? "text-rose-500 hover:bg-rose-500/10"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground",
          className
        )}
        aria-label={isWishlisted ? `Hapus ${product.name} dari wishlist` : `Tambah ${product.name} ke wishlist`}
        aria-pressed={isWishlisted}
        title={isWishlisted ? "Hapus dari wishlist" : "Tambah ke wishlist"}
      >
        <motion.span
          key={isWishlisted ? "filled" : "empty"}
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 15 }}
        >
          <Heart
            className={cn(iconSizes[size], isWishlisted && "fill-rose-500")}
          />
        </motion.span>
      </button>
    );
  }

  // Overlay variant: absolute positioned, semi-transparent bg
  return (
    <button
      onClick={handleClick}
      className={cn(
        "absolute z-20 flex items-center justify-center rounded-full bg-background/80 backdrop-blur-sm transition-all hover:scale-110",
        sizeClasses[size],
        isWishlisted
          ? "text-rose-500"
          : "text-muted-foreground hover:text-foreground",
        "right-2 top-2",
        className
      )}
      aria-label={isWishlisted ? `Hapus ${product.name} dari wishlist` : `Tambah ${product.name} ke wishlist`}
      aria-pressed={isWishlisted}
      title={isWishlisted ? "Hapus dari wishlist" : "Tambah ke wishlist"}
    >
      <motion.span
        key={isWishlisted ? "filled" : "empty"}
        initial={{ scale: 0.6 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 12 }}
      >
        <Heart
          className={cn(iconSizes[size], isWishlisted && "fill-rose-500")}
        />
      </motion.span>
    </button>
  );
}
