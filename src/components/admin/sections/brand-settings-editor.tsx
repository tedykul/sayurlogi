"use client";

import { useEffect, useState, useRef } from "react";
import {
  AdminSectionHeading,
  AdminCard,
  AdminField,
  SaveButton,
} from "../admin-ui";
import { adminFetch } from "@/lib/admin-client";
import { toast } from "sonner";
import { Upload, Loader2, ImageIcon, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ============================================================
// BrandSettingsEditor — brand identity settings + logo upload.
// ============================================================

const FIELDS = [
  { key: "brandName", label: "Nama Brand", placeholder: "SayurLogi", hint: "Tampil di header, footer, judul tab browser, manifest" },
  { key: "metaDescription", label: "Meta Description (SEO)", placeholder: "Belanja sayuran dan buah segar langsung dari petani lokal.", hint: "Deskripsi singkat untuk Google search results (max 160 karakter)" },
];

export function BrandSettingsEditor() {
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [logoExists, setLogoExists] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    adminFetch<{ success: boolean; content: Record<string, string | null> }>(
      "/api/admin/content"
    )
      .then((res) => {
        if (cancelled) return;
        const data: Record<string, string> = {};
        for (const f of FIELDS) {
          data[f.key] = (res.content as Record<string, string | null>)?.[f.key] ?? "";
        }
        setForm(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    // Check if custom logo exists
    fetch("/logo-uploaded.png", { method: "HEAD" })
      .then((res) => setLogoExists(res.ok))
      .catch(() => setLogoExists(false));

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await adminFetch("/api/admin/content", {
        method: "POST",
        body: JSON.stringify(form),
      });
      toast.success("Branding tersimpan");
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate client-side
    if (!file.type.startsWith("image/")) {
      toast.error("File harus berupa gambar (PNG, JPG, SVG, WebP)");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Ukuran file terlalu besar (max 5MB)");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("logo", file);

      const token = typeof window !== "undefined"
        ? document.cookie.includes("admin_session")
          ? undefined // cookie will be sent automatically
          : undefined
        : undefined;

      // Use fetch directly (not adminFetch) because FormData needs different content-type
      const res = await fetch("/api/admin/upload-logo", {
        method: "POST",
        body: formData,
        credentials: "include", // send cookie
        headers: {
          // Add Bearer token as fallback
          ...(typeof window !== "undefined"
            ? { Authorization: `Bearer ${localStorage.getItem("admin_token") || sessionStorage.getItem("admin_token") || ""}` }
            : {}),
        },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Upload gagal");
      }

      toast.success("Logo berhasil di-upload!", {
        description: "PWA icons juga di-regenerate. Refresh halaman untuk melihat hasil.",
      });
      setLogoExists(true);

      // Force page reload to pick up new icons
      setTimeout(() => window.location.reload(), 1500);
    } catch (err: any) {
      toast.error(err.message || "Gagal upload logo");
    } finally {
      setUploading(false);
      // Reset file input so same file can be uploaded again
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <AdminSectionHeading
        title="🎨 Branding"
        description="Identitas brand: nama, deskripsi SEO, dan logo."
      />

      {/* Brand Identity */}
      <AdminCard className="space-y-4">
        <h3 className="text-sm font-semibold">Identitas Brand</h3>
        {FIELDS.map((f) => (
          <AdminField key={f.key} label={f.label} hint={f.hint}>
            <Input
              value={form[f.key] ?? ""}
              onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              placeholder={f.placeholder}
              className="h-9"
            />
          </AdminField>
        ))}
        <SaveButton onSave={handleSave} />
      </AdminCard>

      {/* Logo Upload */}
      <AdminCard className="space-y-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <ImageIcon className="h-4 w-4" /> Logo Brand
        </h3>
        <p className="text-xs text-muted-foreground">
          Upload logo untuk digunakan di loading screen, header, PWA icons, dan favicon.
          Format: PNG, JPG, SVG, atau WebP. Maks 5MB. Rekomendasi: 512x512px.
        </p>

        {/* Logo Preview */}
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-xl border-2 border-border bg-muted/30 overflow-hidden">
            {logoExists ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/logo-uploaded.png?t=${Date.now()}`}
                alt="Logo saat ini"
                className="h-full w-full object-contain"
              />
            ) : (
              <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
            )}
          </div>
          <div className="flex flex-col gap-1">
            {logoExists ? (
              <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Logo custom aktif
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">
                Belum ada logo custom (pakai default)
              </span>
            )}
            <span className="text-[11px] text-muted-foreground">
              PWA icons akan otomatis di-regenerate
            </span>
          </div>
        </div>

        {/* Upload Button */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml,image/webp"
          onChange={handleLogoUpload}
          className="hidden"
          id="logo-upload-input"
        />
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          variant="outline"
          size="sm"
          className="w-full"
        >
          {uploading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
              Mengupload...
            </>
          ) : (
            <>
              <Upload className="h-3.5 w-3.5 mr-2" />
              Upload Logo Baru
            </>
          )}
        </Button>
      </AdminCard>
    </div>
  );
}
