"use client";

import { useState, useEffect } from "react";
import { PanelTop, Phone, Truck, Tag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { adminFetch } from "@/lib/admin-client";
import {
  AdminSectionHeading,
  AdminField,
  SaveButton,
  AdminCard,
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
    key: "topBarShipping",
    label: "Teks Promo Shipping",
    placeholder: "Gratis ongkir untuk pembelian di atas Rp100.000",
    hint: "Tampil di sebelah kiri top bar. Kosongkan untuk sembunyikan.",
    icon: Truck,
  },
  {
    key: "contactPhone",
    label: "Nomor Telepon",
    placeholder: "0800-1234-5678",
    hint: "Tampil di sebelah kanan top bar. Sync dengan tab Kontak.",
    icon: Phone,
  },
  {
    key: "topBarBadge",
    label: "Badge Top Bar",
    placeholder: "Buka · 08.00–21.00",
    hint: "Pill kecil di sebelah nomor telepon. Kosongkan untuk sembunyikan.",
    icon: Tag,
  },
] as const;

export function HeaderEditor() {
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
    await adminFetch("/api/admin/content", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  };

  return (
    <div>
      <AdminSectionHeading
        title="🔝 Header"
        description="Edit top bar — promo shipping, nomor telepon, dan badge."
      />

      {/* Preview card */}
      <AdminCard className="mb-4 overflow-hidden p-0">
        <div className="border-b border-border bg-secondary/40 px-3 py-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Preview Top Bar
          </p>
        </div>
        <div className="flex items-center justify-between gap-2 bg-primary/5 px-3 py-2 text-xs">
          <span className="flex items-center gap-1.5 text-foreground/80 truncate">
            <Truck className="h-3 w-3 shrink-0 text-primary" />
            {loading ? (
              <Skeleton className="h-3 w-40" />
            ) : (
              <span className="truncate">
                {content?.topBarShipping || (
                  <span className="italic text-muted-foreground/60">
                    (promo shipping kosong)
                  </span>
                )}
              </span>
            )}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            {loading ? (
              <>
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-14 rounded-full" />
              </>
            ) : (
              <>
                <span className="flex items-center gap-1 text-foreground/80">
                  <Phone className="h-3 w-3 text-primary" />
                  {content?.contactPhone || (
                    <span className="italic text-muted-foreground/60">
                      (no telp kosong)
                    </span>
                  )}
                </span>
                {content?.topBarBadge && (
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                    {content.topBarBadge}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </AdminCard>

      {/* Edit form */}
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
            <SaveButton onSave={handleSave} />
          </div>
        </AdminCard>
      )}
    </div>
  );
}
