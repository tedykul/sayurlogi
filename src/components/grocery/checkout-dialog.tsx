"use client";

import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Loader2, CheckCircle2, Truck, Store, CreditCard, Banknote, Wallet, Package, Ticket, X, Bike, AlertCircle } from "lucide-react";
import { useCartStore } from "@/lib/store/cart";
import { useCustomerStore } from "@/lib/store/customer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatIDR } from "@/lib/mock-data";
import type { CheckoutResponse } from "@/types/grocery";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { TrustBadges } from "./trust-badges";
import { CheckoutSteps } from "./checkout-steps";
import { DeliveryEstimateDisplay } from "./delivery-estimate";
import { DeliverySlotPicker } from "./delivery-slot-picker";
import { GojekShippingCalculator } from "./gojek-shipping-calculator";
import { BiteshipCourierPicker } from "./biteship-courier-picker";

interface CheckoutDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Called when user clicks "Lacak Pesanan" in success view. Optional. */
  onTrackOrder?: (trackingId: string) => void;
  /** Called when checkout succeeds (e.g. to refresh product stock). Optional. */
  onCheckoutSuccess?: () => void;
}

type Step = "form" | "loading" | "success";

export function CheckoutDialog({ open, onOpenChange, onTrackOrder, onCheckoutSuccess }: CheckoutDialogProps) {
  const [step, setStep] = useState<Step>("form");
  const [result, setResult] = useState<CheckoutResponse | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    notes: "",
  });
  const [deliveryMethod, setDeliveryMethod] = useState<"delivery" | "pickup" | "gojek" | "biteship">("delivery");
  const [deliveryZones, setDeliveryZones] = useState<{id:string;name:string;fee:number;freeShippingMin:number}[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string>("");
  const [selectedZone, setSelectedZone] = useState<{id:string;name:string;fee:number;freeShippingMin:number} | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "transfer" | "ewallet">("cod");
  const [phoneWarning, setPhoneWarning] = useState("");
  const [emailWarning, setEmailWarning] = useState("");

  // Delivery slot state (when scheduling enabled)
  const [deliverySlotId, setDeliverySlotId] = useState<string | null>(null);
  const [deliverySlotLabel, setDeliverySlotLabel] = useState<string | null>(null);
  // Gojek shipping state (Google Maps calculated)
  const [gojekFee, setGojekFee] = useState(0);
  const [gojekDistance, setGojekDistance] = useState(0);
  const [gojekAddress, setGojekAddress] = useState("");
  // Biteship shipping state (multi-courier)
  const [biteshipFee, setBiteshipFee] = useState(0);
  const [biteshipCourier, setBiteshipCourier] = useState("");
  const [biteshipService, setBiteshipService] = useState("");
  const [biteshipAddress, setBiteshipAddress] = useState("");

  // Fetch delivery zones on mount
  useEffect(() => {
    fetch("/api/delivery/zones")
      .then((r) => r.json())
      .then((data) => {
        if (data.success && Array.isArray(data.zones)) {
          setDeliveryZones(data.zones);
          // Auto-select first zone if available
          if (data.zones.length > 0) {
            setSelectedZoneId(data.zones[0].id);
            setSelectedZone(data.zones[0]);
          }
        }
      })
      .catch(() => {});
  }, []);

  // Prefill form when customer is logged in (default address/name/phone).
  // Only prefill empty fields — don't overwrite if customer already typed.
  const customer = useCustomerStore((s) => s.customer);
  useEffect(() => {
    if (!customer) return;
    setForm((prev) => ({
      ...prev,
      name: prev.name || customer.name,
      email: prev.email || customer.email,
      phone: prev.phone || customer.phone,
      address: prev.address || customer.defaultAddress || "",
      city: prev.city || customer.defaultCity || "",
    }));
  }, [customer]);

  // Coupon state
  const [couponInput, setCouponInput] = useState("");
  const [couponCode, setCouponCode] = useState<string | null>(null);
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponFreeShipping, setCouponFreeShipping] = useState(false);
  const [couponValidating, setCouponValidating] = useState(false);
  const [couponApplied, setCouponApplied] = useState(false);

  const items = useCartStore((s) => s.items);
  const totalPrice = useCartStore((s) => s.getTotalPrice());
  const clear = useCartStore((s) => s.clear);
  const closeCart = useCartStore((s) => s.closeCart);

  const FREE_SHIPPING_THRESHOLD = 50000;

  // Calculate shipping based on delivery method + zone
  const calculatedShipping = (() => {
    if (deliveryMethod === "pickup") return 0;
    if (deliveryMethod === "gojek") return gojekFee;
    if (deliveryMethod === "biteship") return biteshipFee;
    if (deliveryMethod === "delivery" && selectedZone) {
      // Free shipping if subtotal meets zone minimum
      if (selectedZone.freeShippingMin > 0 && totalPrice >= selectedZone.freeShippingMin) return 0;
      return selectedZone.fee;
    }
    // Fallback: default flat rate (backward compat)
    return totalPrice >= FREE_SHIPPING_THRESHOLD ? 0 : 9000;
  })();

  const baseFreeShipping = calculatedShipping === 0;
  const freeShipping = baseFreeShipping || couponFreeShipping;
  const shipping = freeShipping ? 0 : calculatedShipping;
  const grandTotal = Math.max(0, totalPrice - couponDiscount + shipping);

  // Reset coupon when cart changes (items or qty) — stale discount
  // would be misleading. We keep the input text so the user can
  // re-apply, but clear the applied discount.
  const cartSig = items.map((i) => `${i.product.id}:${i.quantity}`).join("|");
  const prevCartSig = useRef(cartSig);
  useEffect(() => {
    if (prevCartSig.current !== cartSig && couponApplied) {
      setCouponApplied(false);
      setCouponCode(null);
      setCouponDiscount(0);
      setCouponFreeShipping(false);
    }
    prevCartSig.current = cartSig;
  }, [cartSig, couponApplied]);

  const handleApplyCoupon = async () => {
    const code = couponInput.trim();
    if (!code) {
      toast.error("Masukkan kode kupon dulu");
      return;
    }
    if (!form.email && !form.phone) {
      toast.error("Isi email atau telepon dulu sebelum pakai kupon");
      return;
    }
    setCouponValidating(true);
    try {
      const res = await fetch("/api/coupon/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          subtotal: totalPrice,
          email: form.email || null,
          phone: form.phone || null,
          items: items.map((i) => ({
            itemCode: i.product.itemCode,
            category: i.product.category,
          })),
        }),
      });
      const data = await res.json();
      if (data.valid) {
        setCouponApplied(true);
        setCouponCode(data.couponCode);
        setCouponDiscount(data.discountAmount || 0);
        setCouponFreeShipping(!!data.freeShipping);
        toast.success(data.message || "Kupon diterapkan!");
      } else {
        setCouponApplied(false);
        setCouponCode(null);
        setCouponDiscount(0);
        setCouponFreeShipping(false);
        toast.error(data.message || "Kupon tidak valid");
      }
    } catch {
      toast.error("Gagal validasi kupon");
    } finally {
      setCouponValidating(false);
    }
  };

  const handleRemoveCoupon = () => {
    setCouponApplied(false);
    setCouponCode(null);
    setCouponDiscount(0);
    setCouponFreeShipping(false);
    setCouponInput("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.phone || !form.address) {
      toast.error("Lengkapi data wajib (nama, telepon, alamat)");
      return;
    }
    // Validate phone: must be 8-15 digits, start with 0 or 62
    if (form.phone && (form.phone.length < 8 || form.phone.length > 15)) {
      toast.error("Nomor telepon tidak valid (8-15 digit)");
      return;
    }

    setStep("loading");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: form,
          items,
          deliveryMethod,
          paymentMethod,
          total: grandTotal,
          ...(couponApplied && couponCode ? { couponCode } : {}),
        }),
      });
      const data: CheckoutResponse = await res.json();
      setResult(data);
      if (data.success) {
        setStep("success");
        clear();
        // Reset coupon state after successful checkout
        setCouponApplied(false);
        setCouponCode(null);
        setCouponDiscount(0);
        setCouponFreeShipping(false);
        setCouponInput("");
        // Reset delivery slot
        setDeliverySlotId(null);
        setDeliverySlotLabel(null);
        // Reset gojek
        setGojekFee(0);
        setGojekDistance(0);
        setGojekAddress("");
        // Reset biteship
        setBiteshipFee(0);
        setBiteshipCourier("");
        setBiteshipService("");
        setBiteshipAddress("");
        toast.success("Pesanan berhasil dibuat!");
        if (onCheckoutSuccess) onCheckoutSuccess();
      } else {
        setStep("form");
        toast.error(data.message || "Gagal membuat pesanan");
      }
    } catch (err) {
      setStep("form");
      toast.error("Terjadi kesalahan jaringan");
    }
  };

  const handleClose = (open: boolean) => {
    onOpenChange(open);
    if (!open) {
      setTimeout(() => {
        setStep("form");
        setResult(null);
      }, 200);
      closeCart();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="flex max-h-[92vh] flex-col overflow-hidden p-0 sm:max-w-lg gap-0">
        {/* Always-present description for a11y */}
        <DialogDescription className="sr-only">
          Dialog checkout SayurLogi
        </DialogDescription>

        {/* Design system accent bar */}
        <div className="h-1 bg-primary shrink-0" />

        {/* Step indicator (3-step progress: form -> loading -> success) */}
        <div className="px-5 pt-4 shrink-0">
          <CheckoutSteps current={step} />
        </div>

        {step === "success" && result ? (
          <div className="flex-1 overflow-y-auto scrollbar-grocery">
            <SuccessView
              result={result}
              deliveryMethod={deliveryMethod}
              onClose={() => handleClose(false)}
              onTrackOrder={onTrackOrder}
            />
          </div>
        ) : step === "loading" ? (
          <div className="flex-1 overflow-y-auto scrollbar-grocery">
            <LoadingView />
          </div>
        ) : (
          <>
            <DialogHeader className="px-5 pt-3 pb-2 shrink-0">
              <DialogTitle className="flex items-center gap-2 text-xl">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-inset ring-primary/20">
                  <Package className="h-4 w-4" />
                </div>
                Checkout Pesanan
              </DialogTitle>
              <DialogDescription className="text-foreground/70">
                Lengkapi data pengiriman untuk menyelesaikan pesanan.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
              {/* Scrollable form content */}
              <div className="flex-1 overflow-y-auto scrollbar-grocery px-5 pb-4 space-y-4">
                {/* ============ Section: Customer info — elevated card ============ */}
                <section className="relative overflow-hidden rounded-xl bg-gradient-to-br from-card via-card to-muted p-4 ring-1 ring-border shadow-[0_2px_4px_rgba(0,0,0,0.05),0_8px_24px_-8px_rgba(0,0,0,0.18)]">
                  <div className="absolute inset-x-0 top-0 h-0.5 bg-primary" />
                  <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-foreground">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">1</span>
                    Data Penerima
                  </h3>
                  <div className="grid gap-2.5">
                    <Field label="Nama Lengkap" required>
                      <Input
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="Budi Santoso"
                        required
                        className="h-10"
                      />
                    </Field>
                    <div className="grid grid-cols-2 gap-2.5">
                      <Field label="No. Telepon" required>
                        <Input
                          type="tel"
                          value={form.phone}
                          onChange={(e) => {
                            const raw = e.target.value;
                            if (/[^0-9]/.test(raw)) {
                              setPhoneWarning("Nomor telepon hanya boleh angka");
                            } else {
                              setPhoneWarning("");
                            }
                            const cleaned = raw.replace(/[^0-9]/g, "").slice(0, 15);
                            setForm({ ...form, phone: cleaned });
                          }}
                          placeholder="0812xxxxxxx"
                          required
                          className={cn("h-10", phoneWarning && "border-amber-500/50 ring-1 ring-amber-500/20")}
                          inputMode="numeric"
                          pattern="[0-9]*"
                        />
                        {phoneWarning && (
                          <p className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                            <AlertCircle className="h-3 w-3 shrink-0" />
                            {phoneWarning}
                          </p>
                        )}
                      </Field>
                      <Field label="Email">
                        <Input
                          type="email"
                          value={form.email}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
                              setEmailWarning("Format email belum benar");
                            } else {
                              setEmailWarning("");
                            }
                            setForm({ ...form, email: val });
                          }}
                          placeholder="budi@email.com"
                          className={cn("h-10", emailWarning && "border-amber-500/50 ring-1 ring-amber-500/20")}
                        />
                        {emailWarning && (
                          <p className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                            <AlertCircle className="h-3 w-3 shrink-0" />
                            {emailWarning}
                          </p>
                        )}
                      </Field>
                    </div>
                    <Field label="Alamat Pengiriman" required>
                      <Textarea
                        value={form.address}
                        onChange={(e) => setForm({ ...form, address: e.target.value })}
                        placeholder="Jl. Mawar No. 12, RT 02/RW 05..."
                        rows={2}
                        required
                        className="resize-none"
                      />
                    </Field>
                    <div className="grid grid-cols-2 gap-2.5">
                      <Field label="Kota">
                        <Input
                          value={form.city}
                          onChange={(e) => setForm({ ...form, city: e.target.value })}
                          placeholder="Jakarta Selatan"
                          className="h-10"
                        />
                      </Field>
                      <Field label="Catatan (opsional)">
                        <Input
                          value={form.notes}
                          onChange={(e) => setForm({ ...form, notes: e.target.value })}
                          placeholder="Tinggalkan di pos satpam..."
                          className="h-10"
                        />
                      </Field>
                    </div>
                  </div>
                </section>

                {/* ============ Section: Delivery method — elevated card ============ */}
                <section className="relative overflow-hidden rounded-xl bg-gradient-to-br from-card via-card to-muted p-4 ring-1 ring-border shadow-[0_2px_4px_rgba(0,0,0,0.05),0_8px_24px_-8px_rgba(0,0,0,0.18)]">
                  <div className="absolute inset-x-0 top-0 h-0.5 bg-cyan-500" />
                  <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-foreground">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500 text-white text-xs">2</span>
                    Metode Pengiriman
                  </h3>
                  <RadioGroup
                    value={deliveryMethod}
                    onValueChange={(v) => setDeliveryMethod(v as "delivery" | "pickup" | "gojek" | "biteship")}
                    className="grid grid-cols-2 gap-2 sm:grid-cols-4"
                  >
                    <RadioCard
                      value="delivery"
                      icon={<Truck className="h-4 w-4" />}
                      title="Antar"
                      desc={deliveryMethod === "delivery" && selectedZone ? (shipping === 0 ? "Gratis" : formatIDR(shipping)) : "Pilih area"}
                      accent="cyan"
                    />
                    <RadioCard
                      value="gojek"
                      icon={<Bike className="h-4 w-4" />}
                      title="Gojek"
                      desc={deliveryMethod === "gojek" && gojekFee > 0 ? formatIDR(gojekFee) : "Hitung ongkir"}
                      accent="cyan"
                    />
                    <RadioCard
                      value="biteship"
                      icon={<Truck className="h-4 w-4" />}
                      title="Kurir"
                      desc={deliveryMethod === "biteship" && biteshipFee > 0 ? formatIDR(biteshipFee) : "Pilih kurir"}
                      accent="cyan"
                    />
                    <RadioCard
                      value="pickup"
                      icon={<Store className="h-4 w-4" />}
                      title="Ambil"
                      desc="Gratis"
                      accent="cyan"
                    />
                  </RadioGroup>

                  {/* Zone selector — only for "delivery" method */}
                  {deliveryMethod === "delivery" && (
                    <div className="mt-3 space-y-2">
                      {deliveryZones.length > 0 ? (
                        <div className="space-y-1.5">
                          <Label className="text-[11px] font-medium text-muted-foreground">Pilih Area Pengiriman</Label>
                          <Select
                            value={selectedZoneId}
                            onValueChange={(v) => {
                              setSelectedZoneId(v);
                              const zone = deliveryZones.find((z) => z.id === v);
                              setSelectedZone(zone || null);
                            }}
                          >
                            <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Pilih area..." /></SelectTrigger>
                            <SelectContent>
                              {deliveryZones.map((zone) => (
                                <SelectItem key={zone.id} value={zone.id} className="text-xs">
                                  {zone.name} — {zone.fee === 0 ? "Gratis" : formatIDR(zone.fee)}
                                  {zone.freeShippingMin > 0 ? ` (gratis ≥ ${formatIDR(zone.freeShippingMin)})` : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {selectedZone && selectedZone.freeShippingMin > 0 && totalPrice < selectedZone.freeShippingMin && (
                            <p className="text-xs text-muted-foreground">
                              Belanja {formatIDR(selectedZone.freeShippingMin - totalPrice)} lagi untuk gratis ongkir!
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">Tidak ada zona pengiriman aktif. Hubungi admin.</p>
                      )}
                    </div>
                  )}

                  {/* Gojek shipping calculator (Google Maps) */}
                  {deliveryMethod === "gojek" && (
                    <div className="mt-3 rounded-lg bg-cyan-500/5 p-2.5 ring-1 ring-cyan-500/20">
                      <GojekShippingCalculator
                        onShippingChange={(fee, dist, addr) => {
                          setGojekFee(fee);
                          setGojekDistance(dist);
                          setGojekAddress(addr);
                        }}
                      />
                    </div>
                  )}

                  {/* Biteship courier picker (multi-courier) */}
                  {deliveryMethod === "biteship" && (
                    <div className="mt-3 rounded-lg bg-cyan-500/5 p-2.5 ring-1 ring-cyan-500/20">
                      <BiteshipCourierPicker
                        items={items.map((i) => ({ name: i.product.name, quantity: i.quantity, price: i.product.price }))}
                        onShippingChange={(fee, courier, service, addr) => {
                          setBiteshipFee(fee);
                          setBiteshipCourier(courier);
                          setBiteshipService(service);
                          setBiteshipAddress(addr);
                        }}
                      />
                    </div>
                  )}

                  <div className="mt-2">
                    <DeliveryEstimateDisplay method={deliveryMethod === "gojek" ? "delivery" : deliveryMethod} variant="card" />
                  </div>

                  {/* Delivery slot picker — only renders when scheduling enabled */}
                  {deliveryMethod === "delivery" && (
                    <div className="mt-3 rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-2.5">
                      <DeliverySlotPicker
                        selectedSlotId={deliverySlotId}
                        onSelect={(slot) => {
                          setDeliverySlotId(slot?.slotId ?? null);
                          setDeliverySlotLabel(slot?.displayLabel ?? null);
                        }}
                      />
                    </div>
                  )}
                </section>

                {/* ============ Section: Payment method — elevated card ============ */}
                <section className="relative overflow-hidden rounded-xl bg-gradient-to-br from-card via-card to-muted p-4 ring-1 ring-border shadow-[0_2px_4px_rgba(0,0,0,0.05),0_8px_24px_-8px_rgba(0,0,0,0.18)]">
                  <div className="absolute inset-x-0 top-0 h-0.5 bg-amber-500" />
                  <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-foreground">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-white text-xs">3</span>
                    Metode Pembayaran
                  </h3>
                  <RadioGroup
                    value={paymentMethod}
                    onValueChange={(v) => setPaymentMethod(v as "cod" | "transfer" | "ewallet")}
                    className="grid grid-cols-1 gap-2 sm:grid-cols-3"
                  >
                    <RadioCard
                      value="cod"
                      icon={<Banknote className="h-4 w-4" />}
                      title="COD"
                      desc="Bayar di tempat"
                      compact
                      accent="amber"
                    />
                    <RadioCard
                      value="transfer"
                      icon={<CreditCard className="h-4 w-4" />}
                      title="Transfer"
                      desc="BCA, Mandiri"
                      compact
                      accent="amber"
                    />
                    <RadioCard
                      value="ewallet"
                      icon={<Wallet className="h-4 w-4" />}
                      title="E-Wallet"
                      desc="GoPay/OVO"
                      compact
                      accent="amber"
                    />
                  </RadioGroup>
                </section>

                {/* ============ Section: Coupon — elevated card ============ */}
                <section className="relative overflow-hidden rounded-xl bg-gradient-to-br from-card via-card to-muted p-4 ring-1 ring-border shadow-[0_2px_4px_rgba(0,0,0,0.05),0_8px_24px_-8px_rgba(0,0,0,0.18)]">
                  <div className="absolute inset-x-0 top-0 h-0.5 bg-violet-500" />
                  <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-foreground">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-500 text-white text-xs">4</span>
                    Kupon Diskon
                  </h3>
                  {couponApplied && couponCode ? (
                    <div className="flex items-center justify-between rounded-lg border border-violet-500/30 bg-violet-500/5 p-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <Ticket className="h-4 w-4 text-violet-600 dark:text-violet-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-bold truncate">{couponCode}</p>
                          <p className="text-xs text-muted-foreground">
                            {couponFreeShipping
                              ? "Gratis ongkir"
                              : `Hemat ${formatIDR(couponDiscount)}`}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveCoupon}
                        className="text-muted-foreground hover:text-destructive shrink-0"
                        aria-label="Hapus kupon"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Ticket className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={couponInput}
                          onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                          placeholder="WELCOME10"
                          disabled={couponValidating}
                          className="pl-9 h-10 uppercase text-sm font-mono"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleApplyCoupon();
                            }
                          }}
                        />
                      </div>
                      <Button
                        type="button"
                        onClick={handleApplyCoupon}
                        disabled={couponValidating || !couponInput.trim()}
                        variant="secondary"
                        className="h-10 px-4"
                      >
                        {couponValidating ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Pakai"
                        )}
                      </Button>
                    </div>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    Isi email/telepon dulu sebelum validasi kupon (anti penyalahgunaan).
                  </p>
                </section>

                {/* ============ Order summary — elevated card ============ */}
                <section className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary/8 via-primary/5 to-card p-4 ring-1 ring-primary/20 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_8px_24px_-12px_rgba(0,0,0,0.15)]">
                  <div className="absolute inset-x-0 top-0 h-0.5 bg-primary" />
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-foreground">Ringkasan Pesanan</h3>
                  <div className="max-h-32 space-y-1 overflow-y-auto scrollbar-grocery pr-1 mb-2">
                    {items.map((item) => (
                      <div key={item.product.id} className="flex justify-between text-xs text-foreground/70">
                        <span className="line-clamp-1">
                          {item.product.emoji} {item.product.name} × {item.quantity}
                        </span>
                        <span className="ml-2 shrink-0 font-medium">{formatIDR(item.product.price * item.quantity)}</span>
                      </div>
                    ))}
                  </div>
                  <Separator className="my-2" />
                  <div className="flex justify-between text-xs text-foreground/70">
                    <span>Subtotal</span>
                    <span className="font-medium">{formatIDR(totalPrice)}</span>
                  </div>
                  {couponApplied && couponDiscount > 0 && (
                    <div className="flex justify-between text-xs text-violet-600 dark:text-violet-400">
                      <span>Diskon ({couponCode})</span>
                      <span className="font-bold">-{formatIDR(couponDiscount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs text-foreground/70">
                    <span>Ongkir</span>
                    <span className={freeShipping ? "text-primary font-bold" : "font-medium"}>
                      {freeShipping ? "GRATIS" : formatIDR(shipping)}
                    </span>
                  </div>
                  <Separator className="my-2" />
                  <div className="flex justify-between items-baseline">
                    <span className="text-base font-bold">Total</span>
                    <span className="text-xl font-extrabold text-primary tabular-nums">{formatIDR(grandTotal)}</span>
                  </div>
                </section>
              </div>

              {/* ============ Fixed footer with submit button — always visible ============ */}
              <div className="border-t border-border/60 bg-background/95 backdrop-blur-lg supports-[backdrop-filter]:bg-background/85 p-3 shrink-0 shadow-[0_-2px_8px_-4px_rgba(0,0,0,0.1)] pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
                <Button
                  type="submit"
                  className="h-12 w-full rounded-xl text-base font-bold shadow-md transition-transform hover:scale-[1.01] active:scale-100"
                  disabled={items.length === 0}
                >
                  Buat Pesanan — {formatIDR(grandTotal)}
                </Button>
                <TrustBadges variant="compact" className="pt-2" />
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}

function RadioCard({
  value,
  icon,
  title,
  desc,
  compact,
  accent = "primary",
}: {
  value: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  compact?: boolean;
  accent?: "primary" | "cyan" | "amber";
}) {
  const accentRing = {
    primary: "has-[:checked]:ring-primary has-[:checked]:bg-primary/5",
    cyan: "has-[:checked]:ring-cyan-500 has-[:checked]:bg-cyan-500/5",
    amber: "has-[:checked]:ring-amber-500 has-[:checked]:bg-amber-500/5",
  }[accent];
  const accentText = {
    primary: "text-primary",
    cyan: "text-cyan-600 dark:text-cyan-400",
    amber: "text-amber-600 dark:text-amber-400",
  }[accent];
  return (
    <Label
      htmlFor={`r-${value}`}
      className={`flex min-w-0 cursor-pointer flex-col gap-1.5 overflow-hidden rounded-xl bg-gradient-to-br from-card to-muted/30 p-3 ring-1 ring-border/50 transition-all hover:ring-border hover:shadow-sm ${accentRing} has-[:checked]:ring-2`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <RadioGroupItem value={value} id={`r-${value}`} className="sr-only" />
        <span className={accentText + " shrink-0 flex h-7 w-7 items-center justify-center rounded-lg bg-background/50"}>{icon}</span>
        <span className={`font-semibold truncate ${compact ? "text-sm" : "text-base"}`}>{title}</span>
      </div>
      <span className="text-xs text-muted-foreground break-words pl-9">{desc}</span>
    </Label>
  );
}

function LoadingView() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
      <div className="text-center">
        <p className="font-semibold">Memproses pesanan...</p>
        <p className="text-sm text-muted-foreground">Memproses pesanan Anda...</p>
      </div>
    </div>
  );
}

function SuccessView({
  result,
  deliveryMethod,
  onClose,
  onTrackOrder,
}: {
  result: CheckoutResponse;
  deliveryMethod: "delivery" | "pickup";
  onClose: () => void;
  onTrackOrder?: (trackingId: string) => void;
}) {
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);

  const handleConfirmPayment = async () => {
    if (!result.paymentId) return;
    setPaying(true);
    try {
      const res = await fetch(`/api/payments/${result.paymentId}/confirm`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        setPaid(true);
        toast.success("Pembayaran dikonfirmasi! Pesanan diproses.");
      } else {
        toast.error(data.message || "Gagal konfirmasi pembayaran");
      }
    } catch {
      toast.error("Koneksi gagal");
    } finally {
      setPaying(false);
    }
  };

  const payment = result.payment;
  const isCod = payment?.method === "cod";
  const needsPayment = payment && !isCod && !paid;

  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
        <CheckCircle2 className="h-9 w-9 text-primary" />
      </div>
      <div>
        <h2 className="text-xl font-bold">Pesanan Berhasil! 🎉</h2>
        <p className="mt-1 text-sm text-muted-foreground">{result.message}</p>
      </div>

      <div className="w-full max-w-sm space-y-3 text-left">
        {/* Tracking ID */}
        {result.trackingId && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
            <p className="text-xs font-medium uppercase text-muted-foreground">
              Tracking ID
            </p>
            <div className="flex items-center justify-between gap-2 mt-1">
              <code className="text-xl font-mono font-bold text-primary">
                {result.trackingId}
              </code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(result.trackingId!);
                  toast.success("Tracking ID disalin!");
                }}
                className="text-muted-foreground hover:text-foreground text-xs"
              >
                Salin
              </button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Simpan ID ini untuk lacak pesanan kamu
            </p>
          </div>
        )}

        {/* Payment instructions */}
        {payment && (
          <div className={`rounded-xl border p-4 ${paid ? "border-emerald-500/40 bg-emerald-500/5" : "border-border/60 bg-secondary/30"}`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold">
                {paid ? "✅ Pembayaran Diterima" : "💳 Pembayaran"}
              </p>
              <span className="text-xs font-bold text-primary">
                {formatIDR(payment.amount)}
              </span>
            </div>

            {isCod && (
              <p className="text-xs text-muted-foreground">
                💵 Bayar tunai saat pesanan tiba. Siapkan uang pas ya!
              </p>
            )}

            {payment.method === "transfer" && !paid && (
              <div className="space-y-2">
                <div className="rounded-lg bg-background p-2.5">
                  <p className="text-xs text-muted-foreground">{payment.vaBank} Virtual Account</p>
                  <div className="flex items-center justify-between mt-0.5">
                    <code className="text-sm font-mono font-bold">{payment.vaNumber}</code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(payment.vaNumber!);
                        toast.success("VA number disalin!");
                      }}
                      className="text-xs text-primary hover:underline"
                    >
                      Salin
                    </button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Transfer ke VA di atas. Klik "Saya Sudah Bayar" setelah transfer.
                </p>
              </div>
            )}

            {payment.method === "ewallet" && !paid && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Bayar via {payment.ewalletProvider}:
                </p>
                <a
                  href={payment.paymentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full rounded-lg bg-primary px-3 py-2 text-center text-xs font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Buka Link Pembayaran →
                </a>
              </div>
            )}

            {paid && (
              <p className="text-xs text-emerald-600">
                Pesanan kamu sedang diproses! Cek status via Tracking ID.
              </p>
            )}
          </div>
        )}

        {/* ERP order number */}
        <div className="rounded-xl border border-border/60 bg-secondary/30 p-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">No. Pesanan</span>
            <span className="font-mono font-bold text-primary text-xs">{result.salesOrderName}</span>
          </div>
          {/* Mock warning hidden from customer — admin sees it in dashboard */}
        </div>

        {/* Estimated delivery/pickup time */}
        <DeliveryEstimateDisplay method={deliveryMethod} variant="card" />
      </div>

      {/* Actions */}
      <div className="flex w-full max-w-sm gap-2">
        {needsPayment && (
          <Button
            onClick={handleConfirmPayment}
            disabled={paying}
            className="flex-1 rounded-xl"
          >
            {paying ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Memproses...
              </>
            ) : (
              "Saya Sudah Bayar"
            )}
          </Button>
        )}
        {result.trackingId && onTrackOrder && (
          <Button
            variant="outline"
            onClick={() => onTrackOrder(result.trackingId!)}
            className="flex-1 rounded-xl"
          >
            <Package className="h-4 w-4 mr-2" />
            Lacak
          </Button>
        )}
        <Button onClick={onClose} variant={paid || isCod ? "default" : "outline"} className="flex-1 rounded-xl">
          Selesai
        </Button>
      </div>
    </div>
  );
}
