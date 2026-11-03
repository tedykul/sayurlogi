"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Heart, Trash2, ShoppingCart, Plus, Share2, Loader2, Copy, Check } from "lucide-react";
import { useState } from "react";
import { useWishlistStore } from "@/lib/store/wishlist";
import { useCartStore } from "@/lib/store/cart";
import { formatIDR } from "@/lib/mock-data";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import type { Product } from "@/types/grocery";
import { ProductImage } from "./product-image";

interface WishlistSheetProps {
  /** Called when user clicks "Move to cart" on an item. Optional. */
  onProductClick?: (product: Product) => void;
}

export function WishlistSheet({ onProductClick }: WishlistSheetProps) {
  const { items, isOpen, closeWishlist, remove, clear } = useWishlistStore();
  const addItem = useCartStore((s) => s.addItem);
  const [sharing, setSharing] = useState(false);
  const [sharedUrl, setSharedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleMoveToCart = (product: Product) => {
    if (product.stock <= 0) {
      toast.error(`${product.name} sedang habis`);
      return;
    }
    addItem(product, 1);
    toast.success(`${product.name} dipindahkan ke keranjang`);
  };

  const handleRemove = (productId: string, name: string) => {
    remove(productId);
    toast.success(`${name} dihapus dari wishlist`);
  };

  // ============================================================
  // Share — snapshot current items to DB, get a public link.
  // ============================================================
  const handleShare = async () => {
    if (items.length === 0) {
      toast.error("Wishlist kosong — tidak ada yang dibagikan");
      return;
    }
    setSharing(true);
    try {
      const payload = items.map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        emoji: p.emoji,
        image: p.image ?? null,
        unit: p.unit,
        itemCode: p.itemCode,
        category: p.category,
      }));
      const res = await fetch("/api/wishlist/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: payload }),
      });
      const data = await res.json();
      if (data.success && data.url) {
        const absoluteUrl = `${window.location.origin}${data.url}`;
        setSharedUrl(absoluteUrl);
        setCopied(false);
        toast.success("Link wishlist dibuat! Bagikan ke teman.");
      } else {
        toast.error(data.message || "Gagal membuat link");
      }
    } catch {
      toast.error("Koneksi gagal");
    } finally {
      setSharing(false);
    }
  };

  const handleCopyLink = async () => {
    if (!sharedUrl) return;
    try {
      await navigator.clipboard.writeText(sharedUrl);
      setCopied(true);
      toast.success("Link disalin ke clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Gagal menyalin. Copy manual: " + sharedUrl);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(o) => !o && closeWishlist()}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        {/* Header */}
        <SheetHeader className="border-b border-border/60 px-5 py-4">
          <SheetTitle className="flex items-center gap-2 pr-8">
            <Heart className="h-5 w-5 text-rose-500" />
            Wishlist Favorit
            {items.length > 0 && (
              <span className="ml-auto rounded-full bg-rose-500/10 px-2 py-0.5 text-xs font-semibold text-rose-600 dark:text-rose-400">
                {items.length} item
              </span>
            )}
          </SheetTitle>
          <SheetDescription className="sr-only">
            Daftar produk favorit yang disimpan
          </SheetDescription>
        </SheetHeader>

        {/* Items list */}
        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-rose-500/10">
              <Heart className="h-10 w-10 text-rose-500" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Wishlist masih kosong</h3>
              <p className="mt-1 text-sm text-muted-foreground max-w-xs">
                Simpan produk favoritmu dengan klik ikon hati ♡ di kartu produk.
                Nanti bisa balik beli kapan saja!
              </p>
            </div>
            <Button onClick={closeWishlist} className="mt-2 rounded-full px-6">
              Mulai Belanja
            </Button>
          </div>
        ) : (
          <ScrollArea className="flex-1 scrollbar-grocery max-h-[50vh]">
            <div className="flex flex-col gap-3 p-4">
              <AnimatePresence initial={false}>
                {items.map((product) => {
                  const outOfStock = product.stock <= 0;
                  return (
                    <motion.div
                      key={product.id}
                      layout
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, x: 30, height: 0, marginBottom: 0 }}
                      transition={{ duration: 0.2 }}
                      className="flex gap-3 rounded-xl border border-border/60 bg-card p-3"
                    >
                      {/* Thumb image / emoji */}
                      <button
                        onClick={() => {
                          onProductClick?.(product);
                          closeWishlist();
                        }}
                        className="h-16 w-16 shrink-0 overflow-hidden rounded-lg cursor-pointer"
                        aria-label={`Lihat detail ${product.name}`}
                      >
                        <ProductImage
                          product={product}
                          emojiClassName="text-3xl"
                          className="h-full w-full"
                        />
                      </button>

                      {/* Info */}
                      <div className="flex flex-1 flex-col gap-1">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="line-clamp-1 text-sm font-semibold leading-tight">
                            {product.name}
                          </h4>
                          <button
                            onClick={() => handleRemove(product.id, product.name)}
                            className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
                            aria-label={`Hapus ${product.name} dari wishlist`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatIDR(product.price)} / {product.unit}
                        </span>

                        <div className="mt-1 flex items-center justify-between gap-2">
                          {outOfStock ? (
                            <span className="text-xs font-medium text-destructive">
                              Stok habis
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              Stok: {product.stock} {product.unit}
                            </span>
                          )}
                          <Button
                            size="sm"
                            disabled={outOfStock}
                            onClick={() => handleMoveToCart(product)}
                            className="h-7 rounded-lg px-2.5 text-xs"
                          >
                            <ShoppingCart className="h-3 w-3 mr-1" />
                            Ke Keranjang
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              <button
                onClick={clear}
                className="mx-auto mt-2 text-xs text-muted-foreground underline transition-colors hover:text-destructive"
              >
                Kosongkan wishlist
              </button>
            </div>
          </ScrollArea>
        )}

        {/* Footer */}
        {items.length > 0 && (
          <SheetFooter className="border-t border-border/60 p-4 shrink-0 space-y-2">
            <p className="text-center text-xs text-muted-foreground">
              {items.length} produk tersimpan. Klik <Plus className="inline h-3 w-3" /> untuk pindahkan ke keranjang.
            </p>

            {/* Share link block — shown after user clicks Share */}
            {sharedUrl ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={sharedUrl}
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono truncate"
                  aria-label="Link wishlist"
                />
                <Button
                  onClick={handleCopyLink}
                  size="sm"
                  variant={copied ? "default" : "secondary"}
                  className="h-9 px-3"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  <span className="ml-1 text-xs">{copied ? "Disalin" : "Salin"}</span>
                </Button>
              </div>
            ) : (
              <Button
                onClick={handleShare}
                disabled={sharing}
                variant="outline"
                className="h-10 w-full rounded-xl text-sm"
              >
                {sharing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Membuat link...
                  </>
                ) : (
                  <>
                    <Share2 className="h-4 w-4 mr-2" />
                    Bagikan Wishlist
                  </>
                )}
              </Button>
            )}

            <Button
              onClick={closeWishlist}
              className="h-11 w-full rounded-xl text-sm shadow-md"
            >
              Lanjut Belanja
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
