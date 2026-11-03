"use client";

import { useState, useCallback } from "react";
import { Loader2, MapPin, Navigation, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { formatIDR } from "@/lib/mock-data";

// ============================================================
// GojekShippingCalculator — server-side geocoding + distance.
// ============================================================
// Customer types address → clicks "Hitung Ongkir" → server
// calls Google Geocoding API + Distance Matrix API → returns
// fee based on distance.
//
// No client-side Google Maps JS needed (no CSP issues, no API
// key exposed to browser).
// ============================================================

interface GojekShippingCalculatorProps {
  onShippingChange: (fee: number, distanceKm: number, address: string) => void;
}

export function GojekShippingCalculator({ onShippingChange }: GojekShippingCalculatorProps) {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [fee, setFee] = useState<number | null>(null);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [durationMin, setDurationMin] = useState<number | null>(null);
  const [error, setError] = useState("");

  const handleCalculate = useCallback(async () => {
    if (!address.trim()) {
      setError("Masukkan alamat lengkap dulu");
      return;
    }

    setLoading(true);
    setError("");
    setFee(null);

    try {
      const res = await fetch("/api/delivery/calculate-shipping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: address.trim() }),
      });
      const data = await res.json();

      if (data.success) {
        setFee(data.fee);
        setDistanceKm(data.distanceKm);
        setDurationMin(data.durationMin);
        onShippingChange(data.fee, data.distanceKm, address.trim());
      } else {
        setError(data.message || "Gagal menghitung ongkir");
        onShippingChange(0, 0, "");
      }
    } catch {
      setError("Koneksi gagal. Coba lagi.");
      onShippingChange(0, 0, "");
    } finally {
      setLoading(false);
    }
  }, [address, onShippingChange]);

  const handleReset = useCallback(() => {
    setAddress("");
    setFee(null);
    setDistanceKm(null);
    setDurationMin(null);
    setError("");
    onShippingChange(0, 0, "");
  }, [onShippingChange]);

  return (
    <div className="space-y-2">
      <Label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
        <MapPin className="h-3 w-3" /> Alamat Pengiriman Gojek
      </Label>
      <div className="flex gap-1.5">
        <div className="relative flex-1">
          <Input
            type="text"
            value={address}
            onChange={(e) => {
              setAddress(e.target.value);
              if (fee !== null) {
                setFee(null);
                setDistanceKm(null);
                onShippingChange(0, 0, "");
              }
            }}
            placeholder="Jl. Urip Sumoharjo No. 12, Makassar"
            className="h-9 text-xs pl-8"
            disabled={loading}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleCalculate();
              }
            }}
          />
          <MapPin className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>
        <Button
          onClick={handleCalculate}
          disabled={loading || !address.trim()}
          size="sm"
          variant="secondary"
          className="h-9 px-3 shrink-0"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
          <span className="ml-1 text-xs">Cek</span>
        </Button>
      </div>

      {error && <p className="text-[10px] text-destructive">{error}</p>}

      {fee !== null && distanceKm !== null && (
        <div className="rounded-lg bg-emerald-500/5 p-2.5 ring-1 ring-emerald-500/20 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
              <Navigation className="h-3 w-3" /> Jarak: {distanceKm} km
              {durationMin ? ` · ~${durationMin} menit` : ""}
            </span>
            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
              {formatIDR(fee)}
            </span>
          </div>
          <p className="text-[9px] text-muted-foreground">
            🛵 Estimasi ongkir berdasarkan jarak. Dibayar saat checkout.
          </p>
          <button
            onClick={handleReset}
            className="text-[9px] text-muted-foreground underline hover:text-foreground"
          >
            Ganti alamat
          </button>
        </div>
      )}
    </div>
  );
}
