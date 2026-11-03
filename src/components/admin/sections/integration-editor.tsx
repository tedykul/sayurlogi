"use client";

import { useState, useEffect } from "react";
import {
  Loader2, Save, Plug, CheckCircle2, XCircle, Eye, EyeOff,
  RefreshCw, Link2, KeyRound, Building2, Warehouse, Globe,
  CreditCard, MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AdminSectionHeading,
  AdminCard,
  AdminField,
} from "../admin-ui";
import { adminFetch } from "@/lib/admin-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ============================================================
// IntegrationEditor — ERPNext connection settings (admin UI).
// ============================================================
// Admin can edit URL, API key, API secret, site, warehouse,
// company without SSH/env restart. Test connection button
// validates config before saving.
// ============================================================

interface IntegrationConfig {
  erpnext_url: string;
  erpnext_api_key: string;
  erpnext_api_secret: string;
  erpnext_site: string;
  erpnext_warehouse: string;
  erpnext_company: string;
}

interface TestResult {
  connected: boolean;
  ping?: string;
  authUser?: string;
  error?: string;
}

export function IntegrationEditor() {
  const [config, setConfig] = useState<IntegrationConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Form state
  const [form, setForm] = useState<IntegrationConfig>({
    erpnext_url: "",
    erpnext_api_key: "",
    erpnext_api_secret: "",
    erpnext_site: "",
    erpnext_warehouse: "Stores - S",
    erpnext_company: "SayurLogi",
  });

  useEffect(() => {
    fetchConfig();
  }, []);

  async function fetchConfig() {
    setLoading(true);
    try {
      const res = await adminFetch<{ success: boolean; config: IntegrationConfig; isConfigured: boolean }>(
        "/api/admin/integration"
      );
      setConfig(res.config);
      setForm(res.config);
    } catch (err: any) {
      toast.error(err.message || "Gagal memuat konfigurasi");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await adminFetch("/api/admin/integration", {
        method: "POST",
        body: JSON.stringify(form),
      });
      toast.success("Konfigurasi disimpan");
      setTestResult(null);
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      // Save first (so test uses latest values)
      await adminFetch("/api/admin/integration", {
        method: "POST",
        body: JSON.stringify(form),
      });

      // Then test
      const res = await adminFetch<{ success: boolean; connected: boolean; ping?: string; authUser?: string; error?: string; message?: string }>(
        "/api/admin/integration/test-connection",
        { method: "POST" }
      );

      setTestResult({
        connected: res.connected,
        ping: res.ping,
        authUser: res.authUser,
        error: res.error,
      });

      if (res.connected) {
        toast.success(res.message || "Koneksi berhasil!");
      } else {
        toast.error(res.error || "Koneksi gagal");
      }
    } catch (err: any) {
      setTestResult({ connected: false, error: err.message });
      toast.error(err.message || "Test gagal");
    } finally {
      setTesting(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await adminFetch<{ success: boolean; message: string }>(
        "/api/admin/products/sync",
        { method: "POST" }
      );
      toast.success(res.message || "Sync selesai");
    } catch (err: any) {
      toast.error(err.message || "Sync gagal");
    } finally {
      setSyncing(false);
    }
  }

  const set = (field: keyof IntegrationConfig, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Memuat konfigurasi...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <AdminSectionHeading
        title="🔗 Integrasi ERPNext"
        description="Atur koneksi ke ERPNext — bisa diedit tanpa restart server."
      />

      {/* Status Badge */}
      <AdminCard>
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full",
              testResult?.connected
                ? "bg-emerald-500/20"
                : testResult?.connected === false
                ? "bg-rose-500/20"
                : "bg-amber-500/20"
            )}>
              {testResult?.connected ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              ) : testResult?.connected === false ? (
                <XCircle className="h-5 w-5 text-rose-600" />
              ) : (
                <Plug className="h-5 w-5 text-amber-600" />
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {testResult?.connected
                  ? "Terhubung ke ERPNext"
                  : testResult?.connected === false
                  ? "Koneksi gagal"
                  : "Belum di-test"}
              </p>
              {testResult?.authUser && (
                <p className="text-xs text-muted-foreground">
                  Login sebagai: {testResult.authUser}
                </p>
              )}
              {testResult?.error && (
                <p className="text-xs text-rose-600">{testResult.error}</p>
              )}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleTest}
            disabled={testing}
            className="h-9"
          >
            {testing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plug className="h-4 w-4" />
            )}
            <span className="ml-1">Test Connection</span>
          </Button>
        </div>
      </AdminCard>

      {/* Config Form */}
      <AdminCard>
        <div className="p-4 space-y-4">
          {/* URL */}
          <AdminField label="ERPNext URL" hint="Alamat server ERPNext (mis. http://sayurlogi:8000)">
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={form.erpnext_url}
                onChange={(e) => set("erpnext_url", e.target.value)}
                placeholder="http://sayurlogi:8000"
                className="pl-9 h-9"
              />
            </div>
          </AdminField>

          {/* API Key */}
          <AdminField label="API Key" hint="Dari ERPNext → User → API Access">
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={form.erpnext_api_key}
                onChange={(e) => set("erpnext_api_key", e.target.value)}
                placeholder="36e7c972d033fbe"
                className="pl-9 h-9 font-mono text-xs"
              />
            </div>
          </AdminField>

          {/* API Secret */}
          <AdminField label="API Secret" hint="Disimpan terenkripsi di database">
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type={showSecret ? "text" : "password"}
                value={form.erpnext_api_secret}
                onChange={(e) => set("erpnext_api_secret", e.target.value)}
                placeholder="••••••••••••••••"
                className="pl-9 pr-9 h-9 font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </AdminField>

          {/* Site + Warehouse + Company (grid) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <AdminField label="Site Name" hint="Nama site Frappe (opsional)">
              <Input
                value={form.erpnext_site}
                onChange={(e) => set("erpnext_site", e.target.value)}
                placeholder="sayurlogi"
                className="h-9"
              />
            </AdminField>

            <AdminField label="Warehouse" hint="Gudang default untuk stok">
              <div className="relative">
                <Warehouse className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={form.erpnext_warehouse}
                  onChange={(e) => set("erpnext_warehouse", e.target.value)}
                  placeholder="Stores - S"
                  className="pl-9 h-9"
                />
              </div>
            </AdminField>

            <AdminField label="Company" hint="Nama perusahaan di ERPNext">
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={form.erpnext_company}
                  onChange={(e) => set("erpnext_company", e.target.value)}
                  placeholder="SayurLogi"
                  className="pl-9 h-9"
                />
              </div>
            </AdminField>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-border/60">
            <Button
              onClick={handleSave}
              disabled={saving}
              size="sm"
              className="h-9"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              <span className="ml-1">Simpan Konfigurasi</span>
            </Button>

            <Button
              variant="outline"
              onClick={handleTest}
              disabled={testing}
              size="sm"
              className="h-9"
            >
              {testing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plug className="h-4 w-4" />
              )}
              <span className="ml-1">Test Connection</span>
            </Button>

            <Button
              variant="outline"
              onClick={handleSync}
              disabled={syncing}
              size="sm"
              className="h-9"
            >
              {syncing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="ml-1">Sync Produk Sekarang</span>
            </Button>
          </div>
        </div>
      </AdminCard>

      {/* Info Card */}
      <AdminCard>
        <div className="p-4">
          <h3 className="text-sm font-semibold text-foreground mb-2">
            ℹ️ Informasi
          </h3>
          <div className="space-y-2 text-xs text-muted-foreground">
            <p>
              <strong className="text-foreground">Prioritas config:</strong> Database → Env vars → Kosong
            </p>
            <p>
              <strong className="text-foreground">API Secret:</strong> Disimpan terenkripsi (AES-256-CBC) di database.
              Tidak ada yang bisa lihat tanpa akses server.
            </p>
            <p>
              <strong className="text-foreground">Pindah hosting:</strong> Cukup edit form ini, klik Save + Test Connection.
              Tidak perlu SSH atau restart server.
            </p>
            <p>
              <strong className="text-foreground">Cara dapat API Key/Secret:</strong> Login ERPNext →
              buka User profile → section "API Access" → Generate New API Key.
            </p>
          </div>
        </div>
      </AdminCard>

      {/* ============================================================ */}
      {/* Midtrans payment gateway section                              */}
      {/* ============================================================ */}
      <MidtransSection />

      {/* ============================================================ */}
      {/* WhatsApp notification section                                 */}
      {/* ============================================================ */}
      <WaSection />
    </div>
  );
}

// ============================================================
// MidtransSection — payment gateway config + enable/disable.
// ============================================================
// When enabled + serverKey set, checkout creates a real Snap
// transaction. When disabled, checkout falls back to mock
// payment (COD/VA mock). Toggle saves credits during dev.
// ============================================================

interface MidtransForm {
  environment: "sandbox" | "production";
  serverKey: string;
  clientKey: string;
  enabled: boolean;
}

function MidtransSection() {
  const [form, setForm] = useState<MidtransForm>({
    environment: "sandbox",
    serverKey: "",
    clientKey: "",
    enabled: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showServerKey, setShowServerKey] = useState(false);

  useEffect(() => {
    let cancelled = false;
    adminFetch<{ success: boolean; midtrans: MidtransForm }>(
      "/api/admin/integration"
    )
      .then((res) => {
        if (cancelled) return;
        if (res.midtrans) setForm(res.midtrans);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await adminFetch("/api/admin/integration", {
        method: "POST",
        body: JSON.stringify({
          midtrans_environment: form.environment,
          midtrans_server_key: form.serverKey,
          midtrans_client_key: form.clientKey,
          midtrans_enabled: form.enabled,
        }),
      });
      toast.success("Konfigurasi Midtrans disimpan");
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (enabled: boolean) => {
    setForm({ ...form, enabled });
    // Save immediately so toggle takes effect
    try {
      await adminFetch("/api/admin/integration", {
        method: "POST",
        body: JSON.stringify({ midtrans_enabled: enabled }),
      });
      toast.success(enabled ? "Midtrans diaktifkan" : "Midtrans dinonaktifkan");
    } catch (err: any) {
      toast.error(err.message || "Gagal toggle");
      setForm({ ...form, enabled: !enabled }); // revert
    }
  };

  return (
    <AdminCard>
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <CreditCard className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2">
                Midtrans Payment Gateway
                {form.enabled && form.serverKey ? (
                  <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px]">Aktif</Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px]">Nonaktif</Badge>
                )}
              </h3>
              <p className="text-[11px] text-muted-foreground">VA, e-wallet, card, QRIS — real payment processing</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Enable</Label>
            <Switch
              checked={form.enabled}
              onCheckedChange={toggleEnabled}
              disabled={loading}
              aria-label="Aktifkan Midtrans"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Memuat konfigurasi...
          </div>
        ) : (
          <div className="space-y-3">
            <AdminField label="Environment" hint="Sandbox untuk dev/testing, Production untuk live">
              <Select
                value={form.environment}
                onValueChange={(v) => setForm({ ...form, environment: v as "sandbox" | "production" })}
                disabled={!form.enabled}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sandbox">Sandbox (dev/test)</SelectItem>
                  <SelectItem value="production">Production (live)</SelectItem>
                </SelectContent>
              </Select>
            </AdminField>

            <AdminField label="Server Key" required hint="Dari Midtrans dashboard → Settings → Access Keys. Disimpan terenkripsi.">
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type={showServerKey ? "text" : "password"}
                  value={form.serverKey}
                  onChange={(e) => setForm({ ...form, serverKey: e.target.value })}
                  placeholder="SB-Mid-server-xxxxx"
                  disabled={!form.enabled}
                  className="pl-9 pr-9 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowServerKey(!showServerKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showServerKey ? "Sembunyikan" : "Tampilkan"}
                >
                  {showServerKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </AdminField>

            <AdminField label="Client Key" hint="Dari Midtrans dashboard. Public — dipakai Snap.js di frontend.">
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  value={form.clientKey}
                  onChange={(e) => setForm({ ...form, clientKey: e.target.value })}
                  placeholder="SB-Mid-client-xxxxx"
                  disabled={!form.enabled}
                  className="pl-9 font-mono text-xs"
                />
              </div>
            </AdminField>

            <Button onClick={handleSave} disabled={saving} size="sm" className="w-full">
              {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
              Simpan Konfigurasi Midtrans
            </Button>

            <div className="rounded-lg bg-secondary/50 p-2.5 text-[10px] text-muted-foreground space-y-1">
              <p><strong className="text-foreground">Cara dapat keys:</strong> Daftar di dashboard.midtrans.com → Settings → Access Keys.</p>
              <p><strong className="text-foreground">Webhook:</strong> Set notification URL ke <code>https://domain-anda.com/api/payments/midtrans/webhook</code> di Midtrans dashboard.</p>
              <p><strong className="text-foreground">Saat nonaktif:</strong> Checkout otomatis pakai mock payment (COD/VA mock).</p>
            </div>
          </div>
        )}
      </div>
    </AdminCard>
  );
}

// ============================================================
// WaSection — WhatsApp notification config + enable/disable.
// ============================================================
// Supports Fonnte (cheap) + Wablas (reliable) + Mock (dev log).
// When enabled + provider != mock + apiKey set, notifications
// fire on order events (created, confirmed, out_for_delivery,
// delivered). When disabled, no WA sent (saves credits).
// ============================================================

interface WaForm {
  provider: "fonnte" | "wablas" | "mock";
  apiKey: string;
  sender: string;
  enabled: boolean;
}

function WaSection() {
  const [form, setForm] = useState<WaForm>({
    provider: "mock",
    apiKey: "",
    sender: "",
    enabled: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testPhone, setTestPhone] = useState("");

  useEffect(() => {
    let cancelled = false;
    adminFetch<{ success: boolean; wa: WaForm }>(
      "/api/admin/integration"
    )
      .then((res) => {
        if (cancelled) return;
        if (res.wa) setForm(res.wa);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await adminFetch("/api/admin/integration", {
        method: "POST",
        body: JSON.stringify({
          wa_provider: form.provider,
          wa_api_key: form.apiKey,
          wa_sender: form.sender,
          wa_enabled: form.enabled,
        }),
      });
      toast.success("Konfigurasi WhatsApp disimpan");
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const handleTestWa = async () => {
    if (!testPhone.trim()) {
      toast.error("Isi nomor telepon untuk test");
      return;
    }
    setTesting(true);
    try {
      // Save first so test uses latest config
      await adminFetch("/api/admin/integration", {
        method: "POST",
        body: JSON.stringify({
          wa_provider: form.provider,
          wa_api_key: form.apiKey,
          wa_sender: form.sender,
          wa_enabled: form.enabled,
        }),
      });
      const res = await adminFetch<{ success: boolean; message: string }>(
        "/api/admin/integration/test-wa",
        { method: "POST", body: JSON.stringify({ phone: testPhone.trim() }) }
      );
      if (res.success) {
        toast.success("Test WA terkirim! Cek HP Anda.");
      } else {
        toast.error(res.message || "Test WA gagal");
      }
    } catch (err: any) {
      toast.error(err.message || "Test WA gagal");
    } finally {
      setTesting(false);
    }
  };

  const toggleEnabled = async (enabled: boolean) => {
    setForm({ ...form, enabled });
    try {
      await adminFetch("/api/admin/integration", {
        method: "POST",
        body: JSON.stringify({ wa_enabled: enabled }),
      });
      toast.success(enabled ? "Notifikasi WhatsApp diaktifkan" : "Notifikasi WhatsApp dinonaktifkan");
    } catch (err: any) {
      toast.error(err.message || "Gagal toggle");
      setForm({ ...form, enabled: !enabled });
    }
  };

  return (
    <AdminCard>
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <MessageCircle className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2">
                Notifikasi WhatsApp
                {form.enabled && form.provider !== "mock" && form.apiKey ? (
                  <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px]">Aktif</Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px]">Nonaktif</Badge>
                )}
              </h3>
              <p className="text-[11px] text-muted-foreground">Kirim WA otomatis saat status order berubah</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Enable</Label>
            <Switch
              checked={form.enabled}
              onCheckedChange={toggleEnabled}
              disabled={loading}
              aria-label="Aktifkan WhatsApp"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Memuat konfigurasi...
          </div>
        ) : (
          <div className="space-y-3">
            <AdminField label="Provider" hint="Fonnte (termurah), Wablas (lebih reliable), Mock (dev log tanpa kirim)">
              <Select
                value={form.provider}
                onValueChange={(v) => setForm({ ...form, provider: v as WaForm["provider"] })}
                disabled={!form.enabled}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mock">Mock (dev, tidak kirim)</SelectItem>
                  <SelectItem value="fonnte">Fonnte</SelectItem>
                  <SelectItem value="wablas">Wablas</SelectItem>
                </SelectContent>
              </Select>
            </AdminField>

            <AdminField label="API Key / Token" required={form.provider !== "mock"} hint="Dari dashboard provider. Disimpan terenkripsi.">
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type={showApiKey ? "text" : "password"}
                  value={form.apiKey}
                  onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                  placeholder={form.provider === "fonnte" ? "Fonnte token" : form.provider === "wablas" ? "Wablas token" : "Tidak perlu (mock)"}
                  disabled={!form.enabled || form.provider === "mock"}
                  className="pl-9 pr-9 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showApiKey ? "Sembunyikan" : "Tampilkan"}
                >
                  {showApiKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </AdminField>

            <AdminField label="Sender / Device ID" hint="Nomor pengirim (Wablas) atau Device ID (Fonnte). Opsional untuk beberapa provider.">
              <Input
                value={form.sender}
                onChange={(e) => setForm({ ...form, sender: e.target.value })}
                placeholder="628xxx atau device-id"
                disabled={!form.enabled || form.provider === "mock"}
                className="text-xs"
              />
            </AdminField>

            <Button onClick={handleSave} disabled={saving} size="sm" className="w-full">
              {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
              Simpan Konfigurasi WhatsApp
            </Button>

            {/* Test WA */}
            <div className="rounded-lg border border-border/60 p-2.5 space-y-2">
              <Label className="text-[11px] font-medium text-muted-foreground">Test kirim WA</Label>
              <div className="flex gap-2">
                <Input
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="0812xxxxxxx"
                  disabled={testing || !form.enabled || form.provider === "mock"}
                  className="h-8 text-xs"
                />
                <Button
                  onClick={handleTestWa}
                  disabled={testing || !form.enabled || form.provider === "mock"}
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-xs shrink-0"
                >
                  {testing ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageCircle className="h-3 w-3 mr-1" />}
                  Test
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Simpan config dulu, lalu kirim test ke nomor Anda untuk verifikasi.
              </p>
            </div>

            <div className="rounded-lg bg-secondary/50 p-2.5 text-[10px] text-muted-foreground space-y-1">
              <p><strong className="text-foreground">Fonnte:</strong> Daftar di fonnte.com. Token dari menu API. Biaya ~Rp 500/1000 msg.</p>
              <p><strong className="text-foreground">Wablas:</strong> Daftar di console.wablas.com. Token dari menu API.</p>
              <p><strong className="text-foreground">Saat nonaktif:</strong> Tidak ada WA dikirim (hemat credit). Status order tetap update di dashboard.</p>
              <p><strong className="text-foreground">Trigger:</strong> Order dibuat, dikonfirmasi, dikirim, selesai.</p>
            </div>
          </div>
        )}
      </div>
    </AdminCard>
  );
}
