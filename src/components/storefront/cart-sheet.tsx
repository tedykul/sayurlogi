"use client";

import { useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCartStore } from "@/lib/store/cart";
import { CartLineItem } from "./cart-line-item";
import { AppliedCouponBanner, CouponInput } from "./coupon-input";
import { CheckoutDialog } from "./checkout-dialog";
import { ShoppingCart } from "lucide-react";
import { useState } from "react";

const SHIPPING_FEE = 10000;

export function CartSheet() {
  const { items, isOpen, closeCart, updateQty, getSubtotal, getDiscount, getTotal, coupon } =
    useCartStore();
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  // Disable body scroll when open
  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const subtotal = getSubtotal();
  const discount = getDiscount();
  const total = getTotal(SHIPPING_FEE);
  const shipping = coupon?.freeShipping ? 0 : SHIPPING_FEE;

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(o) => (o ? null : closeCart())}>
        <SheetContent className="w-full sm:max-w-md flex flex-col p-0">
          <SheetHeader className="px-4 py-3 border-b">
            <SheetTitle className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" /> Keranjang Belanja
            </SheetTitle>
            <SheetDescription className="sr-only">
              {items.length} item dalam keranjang
            </SheetDescription>
          </SheetHeader>

          {items.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground p-8">
              <div className="text-5xl">🛒</div>
              <p className="text-sm">Keranjang masih kosong</p>
              <Button variant="outline" size="sm" onClick={closeCart}>
                Lanjut belanja
              </Button>
            </div>
          ) : (
            <>
              <ScrollArea className="flex-1 px-4 py-3">
                <div className="space-y-3">
                  {items.map((item) => (
                    <CartLineItem
                      key={item.product.id}
                      item={item}
                      onUpdateQty={(qty) => updateQty(item.product.id, qty)}
                    />
                  ))}
                </div>
              </ScrollArea>

              <div className="border-t px-4 py-3 space-y-3">
                {/* Coupon section */}
                {coupon ? (
                  <AppliedCouponBanner />
                ) : (
                  <CouponInput shippingFee={SHIPPING_FEE} />
                )}

                <Separator />

                {/* Price breakdown */}
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>Rp{subtotal.toLocaleString("id-ID")}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Diskon ({coupon?.code})</span>
                      <span>-Rp{discount.toLocaleString("id-ID")}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ongkir</span>
                    <span>
                      {shipping === 0 ? (
                        <span className="text-green-600">GRATIS</span>
                      ) : (
                        `Rp${shipping.toLocaleString("id-ID")}`
                      )}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-bold text-base">
                    <span>Total</span>
                    <span className="text-green-700">
                      Rp{total.toLocaleString("id-ID")}
                    </span>
                  </div>
                </div>

                <Button
                  className="w-full h-11"
                  size="lg"
                  onClick={() => setCheckoutOpen(true)}
                >
                  Checkout
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <CheckoutDialog open={checkoutOpen} onOpenChange={setCheckoutOpen} />
    </>
  );
}
