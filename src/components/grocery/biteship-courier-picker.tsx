"use client";

import { useState, useCallback } from "react";
import { Loader2, MapPin, Search, Truck, Check, Bike } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatIDR } from "@/lib/mock-data";

// ============================================================
// BiteshipCourierPicker — address input + courier selection.
// ============================================================
// Customer types destination address → clicks "Cek Ongkir" →
// server calls Biteship API → returns list of couriers with
// real-time prices. Customer picks courier → shipping fee
// added to total.
// ============================================================

interface BiteshipRate {
  courier: string;
  courierService: string;
  courierServiceName: string;
  price: number;
  etd: string;
  label: string;
}

interface BiteshipCourierPickerProps {
  items: Array<{ name: string; quantity: number; price: number }>;
  onShippingChange: (fee: number, courier: string, courierService: string, address: string) => void;
}

export function BiteshipCourierPicker({ items, onShippingChange }: BiteshipCourierPickerProps) {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [rates, setRates] = useState<BiteshipRate[]>([]);
  const [selectedRate, setSelectedRate] = useState<BiteshipRate | null>(null);
  const [error, setError] = useState("");

  const handleCheckRates = useCallback(async () => {
    if (!address.trim()) {
      setError("Masukkan alamat lengkap dulu");
      return;
    }

    setLoading(true);
    setError("");
    setRates([]);
    setSelectedRate(null);

    try {
      const res = await fetch("/api/delivery/biteship/rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destinationAddress: address.trim(),
          items: items.map((i) => ({
            name: i.name,
            quantity: i.quantity,
            price: i.price,
            weight: 500, // default 500g per item
          })),
        }),
      });
      const data = await res.json();

      if (data.success && Array.isArray(data.rates)) {
        setRates(data.rates);
        if (data.rates.length === 0) {
          setError("Tidak ada kurir tersedia untuk alamat ini");
        }
      } else {
        setError(data.message || "Gagal mengambil tarif kurir");
      }
    } catch {
      setError("Koneksi gagal. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }, [address, items]);

  const handleSelectRate = (rate: BiteshipRate) => {
    setSelectedRate(rate);
    onShippingChange(rate.price, rate.courier, rate.courierService, address.trim());
  };

  const handleReset = () => {
    setAddress("");
    setRates([]);
    setSelectedRate(null);
    setError("");
    onShippingChange(0, "", "", "");
  };

  return (
    <div className="space-y-2">
      <Label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
        <MapPin className="h-3 w-3" /> Alamat Pengiriman
      </Label>

      {!selectedRate && (
        <>
          <div className="flex gap-1.5">
            <div className="relative flex-1">
              <Input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Jl. Urip Sumoharjo No. 12, Makassar"
                className="h-9 text-xs pl-8"
                disabled={loading}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleCheckRates();
                  }
                }}
              />
              <MapPin className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
            <Button
              onClick={handleCheckRates}
              disabled={loading || !address.trim()}
              size="sm"
              variant="secondary"
              className="h-9 px-3 shrink-0"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
              <span className="ml-1 text-xs">Cek</span>
            </Button>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          {/* Courier rates list */}
          {rates.length > 0 && (
            <div className="space-y-1.5 max-h-48 overflow-y-auto scrollbar-grocery pr-1">
              <p className="text-xs font-medium text-muted-foreground sticky top-0 bg-card py-0.5">
                Pilih Kurir ({rates.length} opsi):
              </p>
              {rates.map((rate, i) => (
                <button
                  key={`${rate.courier}-${rate.courierService}-${i}`}
                  onClick={() => handleSelectRate(rate)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg border p-2 text-left transition-all",
                    selectedRate?.courierService === rate.courierService
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:border-primary/50 hover:bg-accent/50"
                  )}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    {rate.courier.toLowerCase().includes("go") || rate.courier.toLowerCase().includes("grab") ? (
                      <Bike className="h-4 w-4" />
                    ) : (
                      <Truck className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold leading-tight">{rate.label}</p>
                    {rate.etd && <p className="text-[9px] text-muted-foreground">Estimasi: {rate.etd}</p>}
                  </div>
                  <span className="text-sm font-bold text-primary shrink-0">{formatIDR(rate.price)}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* Selected rate summary */}
      {selectedRate && (
        <div className="rounded-lg bg-emerald-500/5 p-2.5 ring-1 ring-emerald-500/20 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
              <Truck className="h-3 w-3" /> {selectedRate.label}
            </span>
            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
              {formatIDR(selectedRate.price)}
            </span>
          </div>
          <button
            onClick={handleReset}
            className="text-[9px] text-muted-foreground underline hover:text-foreground"
          >
            Ganti alamat/kurir
          </button>
        </div>
      )}
    </div>
  );
}
