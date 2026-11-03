"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { adminFetch } from "@/lib/admin-client";
import {
  AdminSectionHeading,
  AdminField,
  SaveButton,
  AdminCard,
} from "../admin-ui";

// ============================================================
// BrandSettingsEditor — edit brand name, meta description, social links.
// ============================================================

const FIELDS = [
  { key: "brandName", label: "Nama Brand", placeholder: "SayurLogi", hint: "Tampil di header, footer, judul tab browser, manifest" },
  { key: "metaDescription", label: "Meta Description (SEO)", placeholder: "Belanja sayuran dan buah segar...", multiline: true, hint: "Tampil di hasil pencarian Google (maks 160 karakter)" },
] as const;

const SOCIAL_FIELDS = [
  { key: "socialInstagram", label: "Instagram URL", placeholder: "https://instagram.com/sayurbox" },
  { key: "socialFacebook", label: "Facebook URL", placeholder: "https://facebook.com/sayurbox" },
  { key: "socialTwitter", label: "Twitter/X URL", placeholder: "https://twitter.com/sayurbox" },
  { key: "socialTiktok", label: "TikTok URL", placeholder: "https://tiktok.com/@sayurbox" },
  { key: "socialWhatsapp", label: "WhatsApp Link", placeholder: "https://wa.me/6281234567890" },
] as const;

export function BrandSettingsEditor() {
  const [content, setContent] = useState<Record<string, string | null> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    adminFetch<Record<string, unknown>>("/api/admin/content")
      .then((res) => {
        if (cancelled) return;
        setContent(res.content as Record<string, string | null>);
      })
      .catch(() => {
        if (!cancelled) setContent({});
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const handleChange = (key: string, value: string) => {
    setContent((prev) => ({ ...(prev || {}), [key]: value }));
  };

  const handleSave = async () => {
    if (!content) return;
    const payload: Record<string, string | null> = {};
    for (const f of FIELDS) payload[f.key] = content[f.key] ?? null;
    for (const f of SOCIAL_FIELDS) payload[f.key] = content[f.key] ?? null;
    await adminFetch("/api/admin/content", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  };

  if (loading || !content) {
    return (
      <div>
        <AdminSectionHeading title="Branding" description="Edit nama brand dan social media." />
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <AdminSectionHeading
        title="🎨 Branding"
        description="Edit nama brand, meta description, dan social media links."
      />

      <div className="space-y-5">
        {/* Brand identity */}
        <AdminCard className="space-y-4">
          <h3 className="text-sm font-bold border-b border-border pb-2">Identitas Brand</h3>
          {FIELDS.map((f) => (
            <AdminField key={f.key} label={f.label} hint={"hint" in f ? f.hint : undefined}>
              {"multiline" in f && f.multiline ? (
                <Textarea
                  value={content[f.key] ?? ""}
                  onChange={(e) => handleChange(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  rows={3}
                  maxLength={160}
                  className="resize-none"
                />
              ) : (
                <Input
                  value={content[f.key] ?? ""}
                  onChange={(e) => handleChange(f.key, e.target.value)}
                  placeholder={f.placeholder}
                />
              )}
            </AdminField>
          ))}
        </AdminCard>

        {/* Social media */}
        <AdminCard className="space-y-4">
          <h3 className="text-sm font-bold border-b border-border pb-2">Social Media Links</h3>
          <p className="text-xs text-muted-foreground">
            Isi URL untuk mengaktifkan link social media di footer. Kosongkan jika belum ada.
          </p>
          {SOCIAL_FIELDS.map((f) => (
            <AdminField key={f.key} label={f.label}>
              <Input
                value={content[f.key] ?? ""}
                onChange={(e) => handleChange(f.key, e.target.value)}
                placeholder={f.placeholder}
                type="url"
              />
            </AdminField>
          ))}
        </AdminCard>

        <div className="flex justify-end">
          <SaveButton onSave={handleSave} />
        </div>
      </div>
    </div>
  );
}
