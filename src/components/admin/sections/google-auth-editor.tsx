"use client";

import { useState, useEffect } from "react";
import { Globe, Loader2, Save, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { adminFetch } from "@/lib/admin-client";
import { toast } from "sonner";
import {
  AdminSectionHeading,
  AdminField,
  SaveButton,
  AdminCard,
} from "../admin-ui";

// ============================================================
// GoogleAuthEditor — Google Sign-In config for customer login.
// ============================================================
// Toggle on/off + Client ID (editable via dashboard).
// Client ID is NOT a secret — visible in frontend Google button.
// ============================================================

interface GoogleAuthContent {
  googleAuthEnabled: boolean | null;
  googleAuthClientId: string | null;
}

// Default saat SiteSetting singleton belum ada (fresh install).
// Form tetap render dengan nilai default — POST /api/admin/content
// melakukan upsert, jadi simpan pertama kali akan membuat row singleton.
const DEFAULT_CONTENT: GoogleAuthContent = {
  googleAuthEnabled: false,
  googleAuthClientId: null,
};

export function GoogleAuthEditor() {
  const [content, setContent] = useState<GoogleAuthContent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    adminFetch<{ content: GoogleAuthContent | null }>("/api/admin/content")
      .then((res) => {
        if (cancelled) return;
        // content bisa null saat singleton belum pernah dibuat.
        // Fallback ke default supaya form tetap bisa dipakai + disimpan.
        setContent(res.content ?? DEFAULT_CONTENT);
      })
      .catch(() => {
        // Network/auth error → tetap tampilkan form default (bukan
        // skeleton selamanya). User bisa retry dengan buka ulang tab.
        if (!cancelled) setContent(DEFAULT_CONTENT);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleChange = (key: keyof GoogleAuthContent, value: string | boolean) => {
    setContent((prev) => (prev ? { ...prev, [key]: value } : null));
  };

  const handleSave = async () => {
    if (!content) return;
    const payload = {
      googleAuthEnabled: content.googleAuthEnabled ?? false,
      googleAuthClientId: content.googleAuthClientId ?? null,
    };
    await adminFetch("/api/admin/content", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  };

  const hasClientId = !!(content?.googleAuthClientId?.trim());

  return (
    <div>
      <AdminSectionHeading
        title="🌐 Google Sign-In"
        description="Aktifkan login customer dengan akun Google. Client ID didapat dari Google Cloud Console."
      />

      {loading || !content ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Toggle enable/disable */}
          <AdminCard className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Aktifkan Google Sign-In</Label>
              <p className="text-xs text-muted-foreground">
                Saat aktif, tombol &quot;Masuk dengan Google&quot; muncul di dialog login customer.
                {!hasClientId && (
                  <span className="block mt-1 text-amber-600 dark:text-amber-400">
                    ⚠️ Isi Google Client ID di bawah dulu, lalu aktifkan toggle.
                  </span>
                )}
              </p>
            </div>
            <Switch
              checked={content.googleAuthEnabled === true && hasClientId}
              disabled={!hasClientId}
              onCheckedChange={(v) => handleChange("googleAuthEnabled", v)}
            />
          </AdminCard>

          {/* Client ID input */}
          <AdminCard className="space-y-3">
            <AdminField
              label="Google Client ID"
              hint="Dari Google Cloud Console → APIs & Services → Credentials → OAuth client ID. Format: xxxxx.apps.googleusercontent.com"
            >
              <Input
                value={content.googleAuthClientId ?? ""}
                onChange={(e) => handleChange("googleAuthClientId", e.target.value)}
                placeholder="123456789-xxxxx.apps.googleusercontent.com"
                className="font-mono text-xs"
              />
            </AdminField>

            {/* Helper: how to get Client ID */}
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/30">
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1">
                Cara Mendapatkan Google Client ID:
              </p>
              <ol className="text-xs text-blue-600 dark:text-blue-500 space-y-1 list-decimal list-inside">
                <li>Buka <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="underline font-medium">Google Cloud Console <ExternalLink className="inline h-3 w-3" /></a></li>
                <li>Buat project baru (atau pilih existing)</li>
                <li>APIs & Services → Credentials → Create Credentials → OAuth client ID</li>
                <li>Pilih &quot;Web application&quot;</li>
                <li>Authorized JavaScript origins: tambah URL website Anda</li>
                <li>Copy Client ID (format: xxxxx.apps.googleusercontent.com)</li>
                <li>Paste ke field di atas → Simpan → Toggle ON</li>
              </ol>
            </div>

            <div className="flex justify-end pt-2 border-t border-border">
              <SaveButton onSave={handleSave} />
            </div>
          </AdminCard>
        </div>
      )}
    </div>
  );
}
