"use client";

import { useState, useEffect } from "react";
import { PanelTop, Phone, Truck, Tag, MapPin, Leaf } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { adminFetch } from "@/lib/admin-client";
import {
  AdminSectionHeading,
  AdminField,
  SaveButton,
  AdminCard,
  useUnsavedContent,
} from "../admin-ui";

// ============================================================
// HeaderEditor — edit the header top bar (above main nav).
// ============================================================
// Three fields persisted via /api/admin/content:
//   topBarShipping — free-shipping promo line (left side)
//   contactPhone  — phone number (right side; mirrors contact section)
//   topBarBadge   — small badge/pill shown next to phone (e.g. "Buka")
//
// A preview card at the top renders the current top bar so the
// admin can see what customers will see before saving.
// ============================================================

const FIELDS = [
  {
    key: "topBarLocation",
    label: "Lokasi / Area Layanan",
    placeholder: "Antar seluruh kota",
    hint: "Label paling kiri dengan ikon pin. Kosongkan untuk sembunyikan.",
    icon: MapPin,
  },
  {
    key: "topBarShipping",
    label: "Teks Promo Shipping",
    placeholder: "Gratis ongkir min. Rp100.000",
    hint: "Promo ongkir di sebelah label lokasi. Kosongkan untuk sembunyikan.",
    icon: Truck,
  },
  {
    key: "contactPhone",
    label: "Nomor Telepon",
    placeholder: "0800-1234-5678",
    hint: "Nomor telepon dengan link tel:. Sync dengan tab Kontak. Kosongkan untuk sembunyikan.",
    icon: Phone,
  },
  {
    key: "topBarBadge",
    label: "Tagline Kanan (dengan ikon daun)",
    placeholder: "Petani Lokal • 100% Segar",
    hint: "Teks di pojok kanan top bar dengan ikon daun. Kosongkan untuk sembunyikan.",
    icon: Leaf,
  },
] as const;

export function HeaderEditor() {
  const [content, setContent] = useState<Record<string, string | null> | null>(null);
  const [loading, setLoading] = useState(true);
  const { dirty, markSaved } = useUnsavedContent(content);

  useEffect(() => {
    let cancelled = false;
    adminFetch<Record<string, unknown>>("/api/admin/content")
      .then((res) => {
        if (cancelled) return;
        setContent((res.content as Record<string, string | null> | null) ?? {});
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
    await adminFetch("/api/admin/content", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    markSaved();
  };

  return (
    <div>
      <AdminSectionHeading
        title="🔝 Header"
        description="Edit top bar — lokasi, promo shipping, telepon, dan badge. Kosongkan field untuk menyembunyikan elemen."
      />

      {/* Preview card — mirrors the storefront top bar layout */}
      <AdminCard className="mb-4 overflow-hidden p-0">
        <div className="border-b border-border bg-secondary/40 px-3 py-1.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Preview Top Bar
          </p>
        </div>
        {loading ? (
          <div className="flex items-center justify-between gap-2 bg-primary/5 px-3 py-2">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-4 w-20 rounded-full" />
          </div>
        ) : !content?.topBarLocation && !content?.topBarShipping && !content?.contactPhone && !content?.topBarBadge ? (
          <div className="bg-primary/5 px-3 py-2 text-xs italic text-muted-foreground/60">
            (semua field kosong — top bar akan tersembunyi di storefront)
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 bg-primary/5 px-3 py-2 text-xs">
            {/* Left side: location + shipping + phone */}
            <div className="flex items-center gap-3 truncate">
              {(content?.topBarLocation || content?.topBarShipping) && (
                <span className="flex items-center gap-1.5 text-foreground/80">
                  {content?.topBarLocation && (
                    <>
                      <MapPin className="h-3 w-3 shrink-0 text-primary" />
                      <span className="truncate">{content.topBarLocation}</span>
                    </>
                  )}
                  {content?.topBarLocation && content?.topBarShipping && (
                    <span className="text-muted-foreground">·</span>
                  )}
                  {content?.topBarShipping && (
                    <span className="flex items-center gap-1 text-foreground/60">
                      <Truck className="h-3 w-3 shrink-0 text-primary" />
                      <span className="truncate">{content.topBarShipping}</span>
                    </span>
                  )}
                </span>
              )}
              {content?.contactPhone && (
                <span className="flex items-center gap-1 text-foreground/80 shrink-0">
                  <Phone className="h-3 w-3 text-primary" />
                  <span>{content.contactPhone}</span>
                </span>
              )}
            </div>
            {/* Right side: tagline with leaf icon (matches storefront) */}
            {content?.topBarBadge && (
              <span className="flex items-center gap-1.5 text-primary font-semibold shrink-0">
                <Leaf className="h-3 w-3" />
                {content.topBarBadge}
              </span>
            )}
          </div>
        )}
      </AdminCard>

      {/* Edit form */}
      {loading || !content ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
      ) : (
        <AdminCard className="space-y-4">
          {FIELDS.map((f) => {
            const Icon = f.icon;
            return (
              <AdminField key={f.key} label={f.label} hint={f.hint}>
                <div className="relative">
                  <Icon className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={content[f.key] ?? ""}
                    onChange={(e) => handleChange(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    className="pl-9"
                  />
                </div>
              </AdminField>
            );
          })}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <PanelTop className="h-3.5 w-3.5" />
              Perubahan tampil setelah reload halaman.
            </div>
            <div className="flex items-center gap-2">
              {dirty && (
                <span className="text-xs text-amber-600 dark:text-amber-400" role="status">
                  ● Belum disimpan
                </span>
              )}
              <SaveButton onSave={handleSave} />
            </div>
          </div>
        </AdminCard>
      )}
    </div>
  );
}
