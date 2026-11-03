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
// FooterEditor — edit footer brand text + tagline.
// ============================================================

const FIELDS = [
  { key: "footerBrandText", label: "Brand Description", multiline: true, placeholder: "Marketplace sayur & buah segar..." },
  { key: "footerTagline", label: "Tagline (di bawah logo)", placeholder: "Sayur & Buah Segar" },
] as const;

export function FooterEditor() {
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
    return () => {
      cancelled = true;
    };
  }, []);

  const handleChange = (key: string, value: string) => {
    setContent((prev) => ({ ...(prev || {}), [key]: value }));
  };

  const handleSave = async () => {
    if (!content) return;
    const payload: Record<string, string | null> = {};
    for (const f of FIELDS) payload[f.key] = content[f.key] ?? null;
    await adminFetch("/api/admin/content", { method: "POST", body: JSON.stringify(payload) });
  };

  if (loading || !content) {
    return (
      <div>
        <AdminSectionHeading title="Footer" description="Edit konten footer." />
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
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
      <AdminSectionHeading title="Footer" description="Edit teks brand dan tagline di footer." />
      <AdminCard className="space-y-4">
        {FIELDS.map((f) => (
          <AdminField key={f.key} label={f.label}>
            {"multiline" in f && f.multiline ? (
              <Textarea
                value={content[f.key] ?? ""}
                onChange={(e) => handleChange(f.key, e.target.value)}
                placeholder={f.placeholder}
                rows={3}
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
        <div className="flex justify-end pt-2">
          <SaveButton onSave={handleSave} />
        </div>
      </AdminCard>

      <p className="mt-4 rounded-lg border border-border/60 bg-secondary/30 p-3 text-xs text-muted-foreground">
        💡 <strong>Note:</strong> Info kontak (telepon, email, alamat, jam operasional) di footer
        otomatis ikut dari tab <strong>Kontak</strong>. Tidak perlu edit terpisah.
      </p>
    </div>
  );
}
