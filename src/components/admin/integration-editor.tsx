"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { adminFetch } from "@/lib/api";
import { toast } from "sonner";
import {
  Loader2,
  Save,
  Plug,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Cloud,
  Database,
  ServerCog,
} from "lucide-react";

// ============================================================
// IntegrationEditor — ERPNext connection config + sync control.
// ============================================================
// Lives in the admin dashboard "Integrasi" tab. Lets admin:
//   - Set ERPNext URL / API Key / Secret / Warehouse / Company
//     (saved to IntegrationConfig table, no restart needed).
//   - Test connection (ping + auth verify).
//   - Trigger manual product sync (ERPNext → local DB).
//   - View sync status (last sync, source, totals).
// ============================================================

interface ErpConfig {
  erpnext_url: string;
  erpnext_api_key: string;
  erpnext_api_secret: string;
  erpnext_site: string;
  erpnext_warehouse: string;
  erpnext_company: string;
}

interface SyncStatus {
  lastSyncAt: string | null;
  source: string;
  totalProducts: number;
  syncedProducts: number;
}

const EMPTY_CONFIG: ErpConfig = {
  erpnext_url: "",
  erpnext_api_key: "",
  erpnext_api_secret: "",
  erpnext_site: "",
  erpnext_warehouse: "Stores - S",
  erpnext_company: "SayurLogi",
};

export function IntegrationEditor() {
  const [config, setConfig] = useState<ErpConfig>(EMPTY_CONFIG);
  const [isConfigured, setIsConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminFetch<{
        success: boolean;
        config: ErpConfig;
        isConfigured: boolean;
      }>("/api/admin/integration");
      setConfig({ ...EMPTY_CONFIG, ...data.config });
      setIsConfigured(data.isConfigured);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memuat konfigurasi");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSyncStatus = useCallback(async () => {
    try {
      const data = await adminFetch<{
        success: boolean;
        status: SyncStatus;
      }>("/api/admin/products/sync");
      setSyncStatus(data.status);
    } catch {
      // silent — status is best-effort
    }
  }, []);

  useEffect(() => {
    loadConfig();
    loadSyncStatus();
  }, [loadConfig, loadSyncStatus]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = await adminFetch<{ success: boolean; message: string; isConfigured: boolean }>(
        "/api/admin/integration",
        { method: "POST", body: JSON.stringify(config) }
      );
      setIsConfigured(data.isConfigured);
      toast.success("Konfigurasi ERPNext tersimpan");
      await loadSyncStatus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal simpan");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      // Save first so test uses the latest values.
      await adminFetch("/api/admin/integration", {
        method: "POST",
        body: JSON.stringify(config),
      });
      const data = await adminFetch<{
        success: boolean;
        connected: boolean;
        ping?: string;
        authUser?: string;
        error?: string;
        message?: string;
      }>("/api/admin/integration/test-connection", { method: "POST" });
      if (data.connected) {
        toast.success(data.message || "Terhubung!", {
          description: data.authUser ? `User: ${data.authUser}` : undefined,
        });
      } else {
        toast.error("Koneksi gagal", { description: data.error });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal test koneksi");
    } finally {
      setTesting(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const data = await adminFetch<{
        success: boolean;
        message: string;
        status: SyncStatus;
      }>("/api/admin/products/sync", { method: "POST" });
      if (data.success) {
        toast.success("Sync selesai", { description: data.message });
      } else {
        toast.error("Sync gagal", { description: data.message });
      }
      setSyncStatus(data.status);
      await loadConfig(); // refresh isConfigured after sync
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal sync");
    } finally {
      setSyncing(false);
    }
  };

  const update = (key: keyof ErpConfig, value: string) =>
    setConfig((c) => ({ ...c, [key]: value }));

  return (
    <div className="space-y-4">
      {/* Status banner */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Cloud className="h-4 w-4" /> ERPNext Backend
              </CardTitle>
              {isConfigured ? (
                <Badge className="bg-emerald-600 gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Terkonfigurasi
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1">
                  <XCircle className="h-3 w-3" /> Mode Mock
                </Badge>
              )}
            </div>
            <Badge variant="outline" className="text-xs">
              {syncStatus?.source === "erpnext" ? (
                <span className="flex items-center gap-1">
                  <ServerCog className="h-3 w-3" /> Synced dari ERPNext
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <Database className="h-3 w-3" /> Data Lokal
                </span>
              )}
            </Badge>
          </div>
          <CardDescription className="text-xs">
            Hubungkan ke ERPNext (Frappe) untuk sync produk + push order otomatis. Tanpa
            konfigurasi, storefront berjalan dengan data mock.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {/* Sync status grid */}
          {syncStatus && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
              <Stat label="Total Produk" value={String(syncStatus.totalProducts)} />
              <Stat label="Tersinkron" value={String(syncStatus.syncedProducts)} />
              <Stat
                label="Sumber"
                value={syncStatus.source === "erpnext" ? "ERPNext" : "Lokal"}
              />
              <Stat
                label="Sync Terakhir"
                value={
                  syncStatus.lastSyncAt
                    ? new Date(syncStatus.lastSyncAt).toLocaleString("id-ID", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Belum pernah"
                }
              />
            </div>
          )}
          <Button onClick={handleSync} disabled={syncing || loading} size="sm">
            {syncing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="h-3.5 w-3.5 mr-1" /> Sync Sekarang
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Config form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Pengaturan Koneksi</CardTitle>
          <CardDescription className="text-xs">
            Dapatkan API Key &amp; Secret dari ERPNext → User → API Access. Disimpan
            terenkripsi (AES-256) di database.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <Field
                label="ERPNext URL"
                placeholder="https://erp.sayurlogi.com"
                value={config.erpnext_url}
                onChange={(v) => update("erpnext_url", v)}
              />
              <div className="grid sm:grid-cols-2 gap-3">
                <Field
                  label="API Key"
                  placeholder="abc123..."
                  value={config.erpnext_api_key}
                  onChange={(v) => update("erpnext_api_key", v)}
                />
                <Field
                  label="API Secret"
                  type="password"
                  placeholder="••••••••"
                  value={config.erpnext_api_secret}
                  onChange={(v) => update("erpnext_api_secret", v)}
                />
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                <Field
                  label="Site (opsional)"
                  placeholder="default"
                  value={config.erpnext_site}
                  onChange={(v) => update("erpnext_site", v)}
                />
                <Field
                  label="Warehouse"
                  placeholder="Stores - S"
                  value={config.erpnext_warehouse}
                  onChange={(v) => update("erpnext_warehouse", v)}
                />
                <Field
                  label="Company"
                  placeholder="SayurLogi"
                  value={config.erpnext_company}
                  onChange={(v) => update("erpnext_company", v)}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button onClick={handleSave} disabled={saving} size="sm">
                  {saving ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Menyimpan...
                    </>
                  ) : (
                    <>
                      <Save className="h-3.5 w-3.5 mr-1" /> Simpan
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleTest}
                  disabled={testing}
                  size="sm"
                  variant="outline"
                >
                  {testing ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Menguji...
                    </>
                  ) : (
                    <>
                      <Plug className="h-3.5 w-3.5 mr-1" /> Test Koneksi
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-8 text-sm"
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/30 px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-xs font-semibold truncate">{value}</div>
    </div>
  );
}
