"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Minus, Plus, Trash2, ShoppingBag, Truck, ShieldCheck, Lock } from "lucide-react";
import { useCartStore } from "@/lib/store/cart";
import { formatIDR } from "@/lib/mock-data";
import { motion, AnimatePresence } from "framer-motion";
import { DeliveryEstimateDisplay } from "./delivery-estimate";
import { ProductImage } from "./product-image";

interface CartSheetProps {
  onCheckout: () => void;
}

export function CartSheet({ onCheckout }: CartSheetProps) {
  const { items, isOpen, closeCart, updateQty, removeItem, clear } = useCartStore();
  const totalItems = useCartStore((s) => s.getTotalItems());
  const totalPrice = useCartStore((s) => s.getTotalPrice());

  const FREE_SHIPPING_THRESHOLD = 50000;
  const remaining = Math.max(0, FREE_SHIPPING_THRESHOLD - totalPrice);
  const freeShipping = totalPrice >= FREE_SHIPPING_THRESHOLD;
  const shipping = freeShipping ? 0 : 9000;
  const grandTotal = totalPrice + shipping;
  const progressPct = Math.min(100, (totalPrice / FREE_SHIPPING_THRESHOLD) * 100);

  return (
    <Sheet open={isOpen} onOpenChange={(o) => !o && closeCart()}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md border-l-2 border-primary/20">
        {/* ============ Header — elevated with accent bar ============ */}
        <SheetHeader className="relative overflow-hidden border-b border-border/60 bg-gradient-to-br from-primary/8 via-primary/5 to-card px-5 py-4">
          <div className="absolute inset-x-0 top-0 h-1 bg-primary" />
          <SheetTitle className="flex items-center gap-2 pr-8 pt-1">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-inset ring-primary/20">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-base font-bold">Keranjang Belanja</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {totalItems > 0 ? `${totalItems} item` : "Belum ada item"}
              </span>
            </div>
            {totalItems > 0 && (
              <span className="ml-auto rounded-full bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground ring-2 ring-background">
                {totalItems}
              </span>
            )}
          </SheetTitle>
          <SheetDescription className="sr-only">
            Keranjang belanja SayurLogi — kelola item dan checkout
          </SheetDescription>
        </SheetHeader>

        {/* ============ Free shipping progress — thicker, gamified ============ */}
        {items.length > 0 && (
          <div className="border-b border-border/60 bg-gradient-to-r from-orange-500/8 to-amber-500/5 px-5 py-3.5">
            {freeShipping ? (
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
                  <Truck className="h-4 w-4" />
                </div>
                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  Yeay! Kamu dapat gratis ongkir 🎉
                </p>
              </div>
            ) : (
              <>
                <p className="flex items-center gap-1.5 text-xs font-medium text-foreground/70">
                  <Truck className="h-3.5 w-3.5 text-orange-500" />
                  Tambah <span className="font-bold text-orange-600 dark:text-orange-400">{formatIDR(remaining)}</span> lagi untuk gratis ongkir!
                </p>
                <div className="relative mt-2">
                  {/* Glow halo behind bar — always visible, wider blur */}
                  <div
                    className="absolute -inset-y-1 left-0 rounded-full bg-orange-400/40 blur-lg"
                    style={{ width: `${progressPct}%` }}
                    aria-hidden="true"
                  />
                  <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-orange-500/15 shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)]">
                    <motion.div
                      className="relative h-full rounded-full bg-gradient-to-r from-orange-400 via-orange-500 to-amber-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${progressPct}%` }}
                      transition={{ duration: 0.4, ease: "easeOut" }}
                    >
                      <div className="absolute inset-0 rounded-full bg-gradient-to-r from-white/40 via-white/15 to-transparent" />
                    </motion.div>
                  </div>
                </div>
                <p className="mt-1 text-right text-[10px] font-semibold text-muted-foreground tabular-nums">
                  {Math.round(progressPct)}%
                </p>
              </>
            )}
          </div>
        )}

        {/* ============ Items list / empty state ============ */}
        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary/10 to-primary/5 ring-1 ring-primary/20">
              <ShoppingBag className="h-10 w-10 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Keranjang kamu masih kosong</h3>
              <p className="mt-1 text-sm text-foreground/70">
                Yuk isi dengan sayur & buah segar pilihan!
              </p>
            </div>
            <Button onClick={closeCart} className="mt-2 rounded-full px-6 shadow-md transition-transform hover:scale-105">
              Mulai Belanja
            </Button>
          </div>
        ) : (
          <ScrollArea className="flex-1 scrollbar-grocery max-h-[50vh]">
            <div className="flex flex-col gap-2.5 p-4">
              <AnimatePresence initial={false}>
                {items.map((item) => {
                  const itemTotal = item.product.price * item.quantity;
                  const hasDiscount = item.product.oldPrice && item.product.oldPrice > item.product.price;
                  return (
                    <motion.div
                      key={item.product.id}
                      layout
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, x: 30, height: 0, marginBottom: 0 }}
                      transition={{ duration: 0.2 }}
                      className="group relative flex gap-3 overflow-hidden rounded-xl bg-gradient-to-br from-card via-card to-muted p-3 ring-1 ring-border shadow-[0_2px_4px_rgba(0,0,0,0.05),0_8px_24px_-8px_rgba(0,0,0,0.18)] transition-all hover:shadow-[0_4px_12px_rgba(0,0,0,0.08),0_16px_40px_-8px_rgba(0,0,0,0.24)] hover:ring-primary/30"
                    >
                      {/* Accent bar — orange if discounted, primary otherwise */}
                      <div className={`absolute inset-y-0 left-0 w-1 ${hasDiscount ? "bg-orange-500" : "bg-primary"}`} />

                      {/* Thumb image / emoji */}
                      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg ring-1 ring-border/50 ml-1">
                        <ProductImage
                          product={item.product}
                          emojiClassName="text-3xl"
                          className="h-full w-full"
                        />
                      </div>

                      {/* Info */}
                      <div className="flex flex-1 flex-col gap-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="line-clamp-1 text-sm font-semibold leading-tight">
                            {item.product.name}
                          </h4>
                          <button
                            onClick={() => removeItem(item.product.id)}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive active:scale-95"
                            aria-label={`Hapus ${item.product.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <span className="text-xs text-foreground/60">
                          {formatIDR(item.product.price)} / {item.product.unit}
                        </span>

                        <div className="mt-1 flex items-center justify-between gap-2">
                          {/* Qty stepper — bigger touch targets */}
                          <div className="flex items-center gap-0.5 rounded-lg border border-border bg-secondary/40 p-0.5">
                            <button
                              onClick={() => updateQty(item.product.id, item.quantity - 1)}
                              className="flex h-8 w-8 items-center justify-center rounded-md text-foreground hover:bg-background active:scale-95 transition-all"
                              aria-label="Kurangi"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="min-w-7 text-center text-sm font-bold tabular-nums">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => updateQty(item.product.id, item.quantity + 1)}
                              disabled={item.quantity >= item.product.stock}
                              className="flex h-8 w-8 items-center justify-center rounded-md text-foreground hover:bg-background active:scale-95 disabled:opacity-40 disabled:active:scale-100 transition-all"
                              aria-label="Tambah"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="flex flex-col items-end">
                            {hasDiscount && item.product.oldPrice && (
                              <span className="text-[10px] text-muted-foreground line-through leading-none">
                                {formatIDR(item.product.oldPrice * item.quantity)}
                              </span>
                            )}
                            <span className="text-sm font-bold text-primary tabular-nums">
                              {formatIDR(itemTotal)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              <button
                onClick={clear}
                className="mx-auto mt-2 text-xs font-medium text-muted-foreground underline decoration-dotted underline-offset-2 transition-colors hover:text-destructive"
              >
                Kosongkan keranjang
              </button>
            </div>
          </ScrollArea>
        )}

        {/* ============ Footer summary — sticky, elevated ============ */}
        {items.length > 0 && (
          <SheetFooter className="relative overflow-hidden border-t border-border/60 bg-background/95 backdrop-blur-lg p-4 shrink-0 shadow-[0_-2px_8px_-4px_rgba(0,0,0,0.1)] pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div className="mb-3 space-y-1.5 text-sm">
              {/* Delivery estimate */}
              <div className="mb-2">
                <DeliveryEstimateDisplay method="delivery" variant="card" />
              </div>

              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal ({totalItems} item)</span>
                <span className="font-medium text-foreground tabular-nums">{formatIDR(totalPrice)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Ongkos kirim</span>
                <span className={freeShipping ? "font-bold text-primary tabular-nums" : "font-medium text-foreground tabular-nums"}>
                  {freeShipping ? "GRATIS" : formatIDR(shipping)}
                </span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between items-baseline">
                <span className="text-base font-bold">Total</span>
                <div className="flex flex-col items-end">
                  <span className="text-xl font-extrabold text-primary tabular-nums">{formatIDR(grandTotal)}</span>
                  <span className="text-[10px] text-muted-foreground">sudah termasuk biaya</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={closeCart}
                className="h-12 flex-1 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                Lanjut
              </Button>
              <Button
                onClick={onCheckout}
                className="h-12 flex-[2] rounded-xl text-base font-bold shadow-md transition-transform hover:scale-[1.02] active:scale-100"
              >
                Bayar — {formatIDR(grandTotal)}
              </Button>
            </div>
            {/* Mini trust indicators */}
            <div className="flex items-center justify-center gap-3 pt-1.5 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Truck className="h-3 w-3 text-primary" /> Antar 2 jam
              </span>
              <span className="text-border">·</span>
              <span className="flex items-center gap-1">
                <Lock className="h-3 w-3 text-primary" /> SSL Aman
              </span>
              <span className="text-border">·</span>
              <span className="flex items-center gap-1">
                <ShieldCheck className="h-3 w-3 text-primary" /> Garansi Segar
              </span>
            </div>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
