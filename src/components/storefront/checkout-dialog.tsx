"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, ShoppingBag } from "lucide-react";
import { useCartStore } from "@/lib/store/cart";
import { publicFetch } from "@/lib/api";
import { toast } from "sonner";

interface CheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CheckoutResponse {
  success: boolean;
  orderId?: string;
  total?: number;
  discount?: number;
  couponApplied?: string | null;
  message?: string;
}

const SHIPPING_FEE = 10000;

export function CheckoutDialog({ open, onOpenChange }: CheckoutDialogProps) {
  const { items, coupon, clear, closeCart, getSubtotal, getDiscount, getTotal } =
    useCartStore();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<CheckoutResponse | null>(null);

  const subtotal = getSubtotal();
  const discount = getDiscount();
  const total = getTotal(SHIPPING_FEE);
  const shipping = coupon?.freeShipping ? 0 : SHIPPING_FEE;

  const handleCheckout = async () => {
    if (!form.name || !form.phone) {
      toast.error("Nama dan nomor HP wajib diisi");
      return;
    }
    if (items.length === 0) {
      toast.error("Keranjang kosong");
      return;
    }

    setLoading(true);
    try {
      const body = {
        items: items.map((i) => ({
          productId: i.product.id,
          quantity: i.quantity,
        })),
        customer: form,
        couponCode: coupon?.code ?? "",
        shippingFee: SHIPPING_FEE,
      };
      const data = await publicFetch<CheckoutResponse>("/api/checkout", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setSuccess(data);
      clear();
      toast.success("Pesanan berhasil dibuat!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal checkout");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    if (success) {
      setSuccess(null);
      setForm({ name: "", email: "", phone: "", address: "" });
      closeCart();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : handleClose())}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        {success ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 className="h-16 w-16 text-green-600" />
            <h2 className="text-xl font-bold">Pesanan Berhasil!</h2>
            <p className="text-sm text-muted-foreground">
              Order ID: <span className="font-mono font-semibold">{success.orderId?.slice(-8).toUpperCase()}</span>
            </p>
            <div className="bg-muted/50 rounded-lg p-3 w-full text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>Rp{subtotal.toLocaleString("id-ID")}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Diskon {success.couponApplied}</span>
                  <span>-Rp{discount.toLocaleString("id-ID")}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ongkir</span>
                <span>{shipping === 0 ? "GRATIS" : `Rp${shipping.toLocaleString("id-ID")}`}</span>
              </div>
              <div className="border-t pt-1 flex justify-between font-bold">
                <span>Total</span>
                <span className="text-green-700">Rp{(success.total ?? total).toLocaleString("id-ID")}</span>
              </div>
            </div>
            <Button onClick={handleClose} className="w-full">
              Selesai
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5" /> Checkout
              </DialogTitle>
              <DialogDescription>
                Lengkapi data pengiriman untuk menyelesaikan pesanan.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2">
                  <Label htmlFor="name">Nama Lengkap *</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Budi Santoso"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">No. HP *</Label>
                  <Input
                    id="phone"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="081234567890"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="budi@email.com"
                  />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label htmlFor="address">Alamat Pengiriman</Label>
                  <Input
                    id="address"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder="Jl. Mawar No. 1, Jakarta"
                  />
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal ({items.length} item)</span>
                  <span>Rp{subtotal.toLocaleString("id-ID")}</span>
                </div>
                {discount > 0 && coupon && (
                  <div className="flex justify-between text-green-600">
                    <span>Diskon ({coupon.code})</span>
                    <span>-Rp{discount.toLocaleString("id-ID")}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ongkir</span>
                  <span>{shipping === 0 ? <span className="text-green-600">GRATIS</span> : `Rp${shipping.toLocaleString("id-ID")}`}</span>
                </div>
                <div className="border-t pt-1 flex justify-between font-bold">
                  <span>Total</span>
                  <span className="text-green-700">Rp{total.toLocaleString("id-ID")}</span>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose} disabled={loading}>
                Batal
              </Button>
              <Button onClick={handleCheckout} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Memproses...
                  </>
                ) : (
                  `Bayar Rp${total.toLocaleString("id-ID")}`
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
