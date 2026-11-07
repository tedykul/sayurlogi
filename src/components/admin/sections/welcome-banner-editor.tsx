"use client";

import { useState, useEffect, useRef } from "react";
import { Sparkles, Upload, Loader2, ImageIcon, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { adminFetch } from "@/lib/admin-client";
import { toast } from "sonner";
import {
  AdminSectionHeading,
  AdminField,
  SaveButton,
  AdminCard,
} from "../admin-ui";

// ============================================================
// WelcomeBannerEditor — edit Welcome Banner (full-screen popup).
// ============================================================
// Fields:
//   - welcomeBannerEnabled (toggle on/off)
//   - welcomeBannerImage (upload, resized to 1200x630 WebP)
//   - welcomeBannerTitle
//   - welcomeBannerDescription
//   - welcomeBannerCtaText (button label)
//   - welcomeBannerCtaLink (button URL)
//   - welcomeBannerVersion (ubah untuk reset dismiss semua user)
// ============================================================

interface BannerContent {
  welcomeBannerEnabled: boolean | null;
  welcomeBannerImage: string | null;
  welcomeBannerTitle: string | null;
  welcomeBannerDescription: string | null;
  welcomeBannerCtaText: string | null;
  welcomeBannerCtaLink: string | null;
  welcomeBannerVersion: string | null;
}

// Default saat SiteSetting singleton belum ada (fresh install).
// Form tetap render — POST /api/admin/content upsert, jadi simpan
// pertama kali akan membuat row singleton.
const DEFAULT_BANNER: BannerContent = {
  welcomeBannerEnabled: false,
  welcomeBannerImage: null,
  welcomeBannerTitle: null,
  welcomeBannerDescription: null,
  welcomeBannerCtaText: null,
  welcomeBannerCtaLink: null,
  welcomeBannerVersion: null,
};

export function WelcomeBannerEditor() {
  const [content, setContent] = useState<BannerContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    adminFetch<{ content: BannerContent | null }>("/api/admin/content")
      .then((res) => {
        if (cancelled) return;
        // content bisa null saat singleton belum pernah dibuat.
        // Fallback ke default supaya form tetap bisa dipakai + disimpan.
        setContent(res.content ?? DEFAULT_BANNER);
      })
      .catch(() => {
        if (!cancelled) setContent(DEFAULT_BANNER);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleChange = (key: keyof BannerContent, value: string | boolean) => {
    setContent((prev) => (prev ? { ...prev, [key]: value } : null));
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("banner", file);
      const token = sessionStorage.getItem("admin-session-token");
      const res = await fetch("/api/admin/upload-banner", {
        method: "POST",
        body: formData,
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Upload gagal");
      }
      setContent((prev) =>
        prev ? { ...prev, welcomeBannerImage: data.imageUrl } : null
      );
      toast.success("Banner berhasil diupload");
    } catch (err: any) {
      toast.error(err.message || "Gagal upload banner");
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  };

  const handleSave = async () => {
    if (!content) return;
    const payload = {
      welcomeBannerEnabled: content.welcomeBannerEnabled ?? false,
      welcomeBannerTitle: content.welcomeBannerTitle ?? null,
      welcomeBannerDescription: content.welcomeBannerDescription ?? null,
      welcomeBannerCtaText: content.welcomeBannerCtaText ?? null,
      welcomeBannerCtaLink: content.welcomeBannerCtaLink ?? null,
      welcomeBannerVersion: content.welcomeBannerVersion ?? "v1",
    };
    await adminFetch("/api/admin/content", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  };

  return (
    <div>
      <AdminSectionHeading
        title="✨ Welcome Banner"
        description="Banner popup yang muncul saat user pertama buka web. Upload gambar + atur konten."
      />

      {loading || !content ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
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
              <Label className="text-sm font-medium">Aktifkan Welcome Banner</Label>
              <p className="text-xs text-muted-foreground">
                Saat aktif, banner popup muncul saat user pertama buka web (sekali per version)
              </p>
            </div>
            <Switch
              checked={content.welcomeBannerEnabled === true}
              onCheckedChange={(v) => handleChange("welcomeBannerEnabled", v)}
            />
          </AdminCard>

          {/* Image upload */}
          <AdminCard className="space-y-3">
            <AdminField
              label="Gambar Banner"
              hint="Upload gambar (PNG/JPG/WebP, max 5MB). Akan di-resize ke 1200x630px WebP."
            >
              <div className="flex items-center gap-3">
                {content.welcomeBannerImage ? (
                  <div className="relative h-16 w-32 overflow-hidden rounded-lg border border-border bg-muted">
                    <img
                      src={content.welcomeBannerImage}
                      alt="Banner preview"
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex h-16 w-32 items-center justify-center rounded-lg border border-dashed border-border bg-muted/30">
                    <ImageIcon className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-1" />
                      Upload Gambar
                    </>
                  )}
                </Button>
              </div>
            </AdminField>
          </AdminCard>

          {/* Text content */}
          <AdminCard className="space-y-4">
            <AdminField label="Judul Banner" hint="Teks besar di bawah gambar">
              <Input
                value={content.welcomeBannerTitle ?? ""}
                onChange={(e) => handleChange("welcomeBannerTitle", e.target.value)}
                placeholder="Selamat datang di SayurLogi!"
              />
            </AdminField>

            <AdminField label="Deskripsi" hint="Teks pendukung di bawah judul">
              <Textarea
                value={content.welcomeBannerDescription ?? ""}
                onChange={(e) => handleChange("welcomeBannerDescription", e.target.value)}
                placeholder="Belanja sayur & buah segar langsung dari petani lokal."
                rows={2}
                className="resize-none"
              />
            </AdminField>

            <div className="grid grid-cols-2 gap-3">
              <AdminField label="Teks Tombol CTA" hint="Teks tombol (opsional)">
                <Input
                  value={content.welcomeBannerCtaText ?? ""}
                  onChange={(e) => handleChange("welcomeBannerCtaText", e.target.value)}
                  placeholder="Mulai Belanja"
                />
              </AdminField>
              <AdminField label="Link CTA" hint="URL tujuan tombol (opsional)">
                <Input
                  value={content.welcomeBannerCtaLink ?? ""}
                  onChange={(e) => handleChange("welcomeBannerCtaLink", e.target.value)}
                  placeholder="/#belanja atau https://..."
                />
              </AdminField>
            </div>

            <AdminField
              label="Banner Version"
              hint="Ubah versi (mis. v1 → v2) untuk reset dismiss — semua user akan lihat banner lagi"
            >
              <div className="flex items-center gap-2">
                <Input
                  value={content.welcomeBannerVersion ?? "v1"}
                  onChange={(e) => handleChange("welcomeBannerVersion", e.target.value)}
                  placeholder="v1"
                  className="font-mono"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const v = content.welcomeBannerVersion ?? "v1";
                    const num = parseInt(v.replace(/\D/g, "")) || 0;
                    handleChange("welcomeBannerVersion", `v${num + 1}`);
                    toast.success(`Version diubah ke v${num + 1} — semua user akan lihat banner lagi`);
                  }}
                  title="Increment version untuk reset dismiss semua user"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </div>
            </AdminField>

            <div className="flex justify-end pt-2 border-t border-border">
              <SaveButton onSave={handleSave} />
            </div>
          </AdminCard>
        </div>
      )}
    </div>
  );
}
