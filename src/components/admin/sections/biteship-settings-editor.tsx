"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Save, Truck, KeyRound, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { adminFetch } from "@/lib/admin-client";
import { toast } from "sonner";
import { AdminCard } from "../admin-ui";

// ============================================================
// BiteshipSettingsEditor — manage Biteship API key.
// ============================================================

interface BiteshipSettings {
  apiKey: string;
  apiUrl: string;
  configured: boolean;
}

export function BiteshipSettingsEditor() {
  const [settings, setSettings] = useState<BiteshipSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [apiUrl, setApiUrl] = useState("https://api.biteship.com");

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch<{ success: boolean; settings: BiteshipSettings }>(
        "/api/admin/delivery/biteship-settings"
      );
      setSettings(res.settings);
      setApiKey(res.settings.apiKey || "");
      setApiUrl(res.settings.apiUrl || "https://api.biteship.com");
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
      await adminFetch("/api/admin/delivery/biteship-settings", {
        method: "PUT",
        body: JSON.stringify({ apiKey, apiUrl }),
      });
      toast.success("Pengaturan Biteship disimpan");
      fetchSettings();
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminCard>
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400">
              <Truck className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2">
                Biteship (Multi-Kurir)
                {settings?.configured ? (
                  <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-xs">Aktif</Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">Nonaktif</Badge>
                )}
              </h3>
              <p className="text-[11px] text-muted-foreground">GoSend, GrabExpress, JNE, J&T, SiCepat, dll</p>
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
                <KeyRound className="h-3 w-3" /> Biteship API Key
              </Label>
              <div className="relative">
                <Input
                  type={showApiKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="biteship_live_xxx..."
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
                Daftar di{" "}
                <a
                  href="https://biteship.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline inline-flex items-center gap-0.5"
                >
                  biteship.com <ExternalLink className="h-2.5 w-2.5" />
                </a>{" "}
                → dashboard → API Keys
              </p>
            </div>

            {/* API URL */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium text-muted-foreground">API URL</Label>
              <Input
                type="text"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                className="h-9 text-xs font-mono"
                placeholder="https://api.biteship.com"
              />
              <p className="text-xs text-muted-foreground">
                Default: https://api.biteship.com (production). Sandbox: https://api.biteship.com (sama).
              </p>
            </div>

            {/* Save */}
            <Button onClick={handleSave} disabled={saving} size="sm" className="w-full">
              {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
              Simpan Pengaturan Biteship
            </Button>

            {/* Info */}
            <div className="rounded-lg bg-secondary/50 p-2.5 text-xs text-muted-foreground space-y-1">
              <p><strong className="text-foreground">Cara setup Biteship:</strong></p>
              <p>1. Daftar merchant di <a href="https://biteship.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">biteship.com</a> (KTP + rekening)</p>
              <p>2. Tunggu approval (1-3 hari kerja)</p>
              <p>3. Dashboard Biteship → Settings → API Keys → copy API key</p>
              <p>4. Paste API key ke field atas → Save</p>
              <p>5. Test: buka checkout → pilih "Kurir" → ketik alamat → klik Cek → list kurir muncul</p>
              <p><strong className="text-foreground">Kelebihan Biteship:</strong></p>
              <p>• Tarif real-time dari kurir (GoSend, Grab, JNE, J&T, SiCepat, dll)</p>
              <p>• Customer pilih kurir sendiri (kayak checkout Shopee)</p>
              <p>• Auto-book kurir via API (tidak manual buka app)</p>
              <p>• Tracking real-time di website</p>
              <p>• Biaya: ~Rp 1.000-2.000 per order (platform fee Biteship)</p>
            </div>
          </div>
        )}
      </div>
    </AdminCard>
  );
}
