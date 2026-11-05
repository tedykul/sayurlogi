"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, MapPin, Save, Bike, KeyRound, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { adminFetch } from "@/lib/admin-client";
import { toast } from "sonner";
import { AdminCard } from "../admin-ui";

// ============================================================
// MapsSettingsEditor — Google Maps settings for Gojek shipping.
// ============================================================
// Admin input: API key + store coordinates + tarif (base + per km).
// When configured + billing enabled in Google Cloud → checkout
// Gojek shows exact shipping based on distance.
// ============================================================

interface MapsSettings {
  apiKey: string;
  storeLat: number;
  storeLng: number;
  baseFare: number;
  perKmRate: number;
  configured: boolean;
}

export function MapsSettingsEditor() {
  const [settings, setSettings] = useState<MapsSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  // Form state
  const [form, setForm] = useState({
    apiKey: "",
    storeLat: "",
    storeLng: "",
    baseFare: 8000,
    perKmRate: 2000,
  });

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch<{ success: boolean; settings: MapsSettings }>(
        "/api/admin/delivery/maps-settings"
      );
      setSettings(res.settings);
      setForm({
        apiKey: res.settings.apiKey || "",
        storeLat: res.settings.storeLat ? String(res.settings.storeLat) : "",
        storeLng: res.settings.storeLng ? String(res.settings.storeLng) : "",
        baseFare: res.settings.baseFare || 8000,
        perKmRate: res.settings.perKmRate || 2000,
      });
    } catch (err: any) {
      toast.error(err.message || "Gagal memuat settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await adminFetch("/api/admin/delivery/maps-settings", {
        method: "PUT",
        body: JSON.stringify({
          apiKey: form.apiKey || undefined,
          storeLat: form.storeLat ? parseFloat(form.storeLat) : undefined,
          storeLng: form.storeLng ? parseFloat(form.storeLng) : undefined,
          baseFare: form.baseFare,
          perKmRate: form.perKmRate,
        }),
      });
      toast.success("Pengaturan Google Maps disimpan");
      fetchSettings();
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const formatIDR = (n: number) => "Rp " + n.toLocaleString("id-ID");

  return (
    <AdminCard>
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <Bike className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2">
                Google Maps (Gojek Shipping)
                {settings?.configured ? (
                  <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-xs">Aktif</Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">Nonaktif</Badge>
                )}
              </h3>
              <p className="text-[11px] text-muted-foreground">Hitung ongkir Gojek berdasarkan jarak</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Memuat...
          </div>
        ) : (
          <div className="space-y-3">
            {/* API Key */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                <KeyRound className="h-3 w-3" /> Google Maps API Key
              </Label>
              <div className="relative">
                <Input
                  type={showApiKey ? "text" : "password"}
                  value={form.apiKey}
                  onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                  placeholder="AIzaSy..."
                  className="h-9 text-xs font-mono pr-20"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                >
                  {showApiKey ? "Sembunyikan" : "Tampilkan"}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Dari Google Cloud Console → APIs &amp; Services → Credentials. Wajib enable Billing.
              </p>
            </div>

            {/* Store coordinates */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                  <Navigation className="h-3 w-3" /> Latitude Toko
                </Label>
                <Input
                  type="text"
                  value={form.storeLat}
                  onChange={(e) => setForm({ ...form, storeLat: e.target.value })}
                  placeholder="-5.1477"
                  className="h-9 text-xs font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                  <Navigation className="h-3 w-3" /> Longitude Toko
                </Label>
                <Input
                  type="text"
                  value={form.storeLng}
                  onChange={(e) => setForm({ ...form, storeLng: e.target.value })}
                  placeholder="119.4327"
                  className="h-9 text-xs font-mono"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Cari di Google Maps → klik kanan alamat toko → copy koordinat.
            </p>

            {/* Tarif */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-medium text-muted-foreground">
                  Base Fare (Rp)
                </Label>
                <Input
                  type="number"
                  value={form.baseFare}
                  onChange={(e) => setForm({ ...form, baseFare: Number(e.target.value) })}
                  className="h-9 text-xs"
                  placeholder="8000"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-medium text-muted-foreground">
                  Tarif per KM (Rp)
                </Label>
                <Input
                  type="number"
                  value={form.perKmRate}
                  onChange={(e) => setForm({ ...form, perKmRate: Number(e.target.value) })}
                  className="h-9 text-xs"
                  placeholder="2000"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Ongkir = Base Fare + (jarak KM × Tarif per KM). Contoh: 5 km = {formatIDR((form.baseFare || 8000) + 5 * (form.perKmRate || 2000))}
            </p>

            {/* Save button */}
            <Button onClick={handleSave} disabled={saving} size="sm" className="w-full">
              {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
              Simpan Pengaturan Maps
            </Button>

            {/* Info */}
            <div className="rounded-lg bg-secondary/50 p-2.5 text-xs text-muted-foreground space-y-1">
              <p><strong className="text-foreground">Cara setup:</strong></p>
              <p>1. Daftar Google Cloud → enable Maps JavaScript API + Geocoding API + Distance Matrix API</p>
              <p>2. Enable Billing (gratis $300 credit + $200/bulan untuk Maps)</p>
              <p>3. Buat API key → copy ke field atas</p>
              <p>4. Cari koordinat toko di Google Maps → input Lat/Lng</p>
              <p>5. Set tarif (base + per km) → Save</p>
              <p>6. Test: buka checkout → pilih Gojek → ketik alamat → klik Cek</p>
            </div>
          </div>
        )}
      </div>
    </AdminCard>
  );
}
