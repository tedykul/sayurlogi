"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Heart, ShoppingCart, Loader2, Gift, CheckCircle2, X } from "lucide-react";
import { useCartStore } from "@/lib/store/cart";
import { useWishlistStore } from "@/lib/store/wishlist";
import { formatIDR } from "@/lib/mock-data";
import { toast } from "sonner";
import { ProductImage } from "./product-image";
import type { Product } from "@/types/grocery";

// ============================================================
// SharedWishlistDialog — renders when ?wishlist=<token> is
// present in the URL. Fetches the snapshot, shows a read-only
// dialog with "add all to cart" + "save to my wishlist" actions.
// ============================================================
// On close, the ?wishlist query param is removed from the URL
// so the dialog doesn't re-open on next visit.
// ============================================================

interface SharedItem {
  id: string;
  name: string;
  price: number;
  emoji: string;
  image: string | null;
  unit: string;
  itemCode: string;
  category: string;
}

interface SharedSnapshot {
  id: string;
  token: string;
  title: string;
  items: SharedItem[];
  viewCount: number;
  createdAt: string;
  expiresAt: string | null;
}

export function SharedWishlistDialog() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("wishlist");

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [snapshot, setSnapshot] = useState<SharedSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const addItemToCart = useCartStore((s) => s.addItem);
  const toggleWishlist = useWishlistStore((s) => s.toggle);
  const hasInWishlist = useWishlistStore((s) => s.has);

  // Fetch when a token is present in the URL.
  useEffect(() => {
    if (!token) {
      setOpen(false);
      setSnapshot(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/wishlist/shared/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.success && data.wishlist) {
          setSnapshot(data.wishlist);
          setOpen(true);
        } else {
          setError(data.message || "Wishlist tidak ditemukan.");
          setOpen(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Gagal memuat wishlist.");
          setOpen(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleClose = (next: boolean) => {
    setOpen(next);
    if (!next) {
      // Remove ?wishlist from URL without triggering a navigation reload.
      const params = new URLSearchParams(searchParams.toString());
      params.delete("wishlist");
      const qs = params.toString();
      router.replace(qs ? `/?${qs}` : "/", { scroll: false });
    }
  };

  // Convert a SharedItem to a minimal Product shape for cart/wishlist stores.
  // The stores only need a subset; missing fields default safely.
  const toProduct = (item: SharedItem): Product => ({
    id: item.id,
    itemCode: item.itemCode,
    name: item.name,
    description: "",
    category: item.category,
    price: item.price,
    unit: item.unit,
    stock: 999, // unknown — let the user try; checkout re-validates against DB
    emoji: item.emoji,
    image: item.image ?? undefined,
  } as Product);

  const handleAddAllToCart = () => {
    if (!snapshot) return;
    let added = 0;
    snapshot.items.forEach((item) => {
      addItemToCart(toProduct(item), 1);
      added++;
    });
    toast.success(`${added} produk ditambahkan ke keranjang`);
    handleClose(false);
  };

  const handleSaveAllToWishlist = () => {
    if (!snapshot) return;
    let added = 0;
    snapshot.items.forEach((item) => {
      if (!hasInWishlist(item.id)) {
        toggleWishlist(toProduct(item));
        added++;
      }
    });
    toast.success(`${added} produk disimpan ke wishlist Anda`);
    handleClose(false);
  };

  // Don't render anything if no token (normal homepage visit).
  if (!token) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="flex max-h-[92vh] flex-col overflow-hidden p-0 sm:max-w-lg gap-0">
        {/* Accent bar */}
        <div className="h-1 bg-rose-500 shrink-0" />

        {loading ? (
          <div className="flex flex-1 items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-rose-500" />
          </div>
        ) : error ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-12 px-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/10">
              <X className="h-7 w-7 text-rose-500" />
            </div>
            <div>
              <h3 className="text-base font-bold">Wishlist Tidak Tersedia</h3>
              <p className="mt-1 text-sm text-muted-foreground">{error}</p>
            </div>
            <Button onClick={() => handleClose(false)} variant="outline" size="sm">
              Tutup
            </Button>
          </div>
        ) : snapshot ? (
          <>
            <DialogHeader className="px-5 pt-4 pb-3 shrink-0">
              <DialogTitle className="flex items-center gap-2 text-xl">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/15 text-rose-500 ring-1 ring-inset ring-rose-500/20">
                  <Gift className="h-4 w-4" />
                </div>
                Wishlist Dibagikan
              </DialogTitle>
              <DialogDescription className="text-foreground/70">
                {snapshot.title} · {snapshot.items.length} produk · dilihat{" "}
                {snapshot.viewCount}x
              </DialogDescription>
            </DialogHeader>

            {/* Items list */}
            <ScrollArea className="flex-1 max-h-[55vh] px-5">
              <div className="flex flex-col gap-2 pb-3">
                {snapshot.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex gap-3 rounded-xl border border-border/60 bg-card p-3"
                  >
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-secondary flex items-center justify-center">
                      <ProductImage
                        product={toProduct(item)}
                        emojiClassName="text-2xl"
                        className="h-full w-full"
                      />
                    </div>
                    <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                      <h4 className="line-clamp-1 text-sm font-semibold">{item.name}</h4>
                      <span className="text-xs text-muted-foreground">
                        {formatIDR(item.price)} / {item.unit}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {item.category}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Actions */}
            <div className="border-t border-border/60 p-4 shrink-0 space-y-2">
              <Button
                onClick={handleAddAllToCart}
                className="h-11 w-full rounded-xl text-sm font-bold"
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                Tambah Semua ke Keranjang
              </Button>
              <Button
                onClick={handleSaveAllToWishlist}
                variant="outline"
                className="h-10 w-full rounded-xl text-sm"
              >
                <Heart className="h-4 w-4 mr-2" />
                Simpan ke Wishlist Saya
              </Button>
              <p className="pt-1 text-center text-[10px] text-muted-foreground">
                <CheckCircle2 className="inline h-3 w-3 mr-0.5" />
                Stok akan diperiksa saat checkout
              </p>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
