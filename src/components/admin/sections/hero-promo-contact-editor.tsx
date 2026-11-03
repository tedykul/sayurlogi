"use client";

import { useState, useEffect } from "react";
import { Home, Sparkles, Phone } from "lucide-react";
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
// HeroPromoContactEditor — edit Hero / Promo / Contact sections.
// All 3 share SiteSetting singleton, so we load once and save
// only the relevant fields per section.
// ============================================================

type Section = "hero" | "promo" | "contact";

const SECTION_CONFIG: Record<Section, { title: string; desc: string; icon: typeof Home }> = {
  hero: {
    title: "Hero Section",
    desc: "Bagian atas halaman dengan headline utama dan CTA.",
    icon: Home,
  },
  promo: {
    title: "Promo Banner",
    desc: "Banner promo di bawah hero. Ubah promoId untuk reset dismiss.",
    icon: Sparkles,
  },
  contact: {
    title: "Info Kontak",
    desc: "Informasi kontak yang tampil di section Kontak dan footer.",
    icon: Phone,
  },
};

const HERO_FIELDS = [
  { key: "heroBadge", label: "Badge (pill kecil di atas)", placeholder: "Dipetik pagi, sampai rumah siang" },
  { key: "heroTitleA", label: "Judul Bagian 1", placeholder: "Sayur & Buah" },
  { key: "heroTitleHighlight", label: "Judul Highlight (berwarna)", placeholder: "Segar Harian" },
  { key: "heroTitleB", label: "Judul Bagian 2", placeholder: "dari Petani Lokal" },
  { key: "heroSubtitle", label: "Subtitle", placeholder: "Belanja sayuran organik...", multiline: true },
  { key: "heroCtaPrimary", label: "Tombol Utama", placeholder: "Mulai Belanja" },
  { key: "heroCtaSecondary", label: "Tombol Sekunder", placeholder: "Lihat Promo" },
] as const;

const PROMO_FIELDS = [
  { key: "promoId", label: "Promo ID (ubah untuk reset dismiss)", placeholder: "promo-akhir-pekan-v1", hint: "Ubah ID ini kalau mau pakai promo baru — user yang sudah dismiss akan lihat lagi." },
  { key: "promoTitle", label: "Judul Promo", placeholder: "Promo Akhir Pekan!" },
  { key: "promoDescription", label: "Deskripsi Promo", placeholder: "Diskon hingga 25%...", multiline: true },
] as const;

const CONTACT_FIELDS = [
  { key: "contactPhone", label: "Nomor Telepon", placeholder: "0800-1234-5678" },
  { key: "contactEmail", label: "Email", placeholder: "halo@sayurbox.id" },
  { key: "contactAddress", label: "Alamat", placeholder: "Jl. Petani Sejahtera No. 88, Jakarta Selatan", multiline: true },
  { key: "contactHours", label: "Jam Operasional", placeholder: "Setiap hari, 08.00 - 21.00 WIB" },
] as const;

export function HeroPromoContactEditor({ section }: { section: Section }) {
  const config = SECTION_CONFIG[section];
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

  const fields =
    section === "hero" ? HERO_FIELDS : section === "promo" ? PROMO_FIELDS : CONTACT_FIELDS;

  const handleChange = (key: string, value: string) => {
    setContent((prev) => ({ ...(prev || {}), [key]: value }));
  };

  const handleSave = async () => {
    const payload: Record<string, string | null> = {};
    for (const f of fields) {
      const key = f.key as string;
      payload[key] = content?.[key] ?? null;
    }
    await adminFetch("/api/admin/content", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  };

  return (
    <div>
      <AdminSectionHeading
        title={config.title}
        description={config.desc}
      />

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
          {fields.map((f) => (
            <AdminField key={f.key} label={f.label} hint={"hint" in f ? f.hint : undefined}>
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
      )}
    </div>
  );
}
