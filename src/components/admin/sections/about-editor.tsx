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
// AboutEditor — edit About section (story, 4 stats, 4 values).
// All fields come from SiteSetting singleton.
// ============================================================

const STORY_FIELDS = [
  { key: "aboutBadge", label: "Badge" },
  { key: "aboutTitleA", label: "Judul Bagian 1" },
  { key: "aboutTitleHighlight", label: "Judul Highlight (berwarna)" },
  { key: "aboutTitleB", label: "Judul Bagian 2" },
  { key: "aboutSubtitle", label: "Subtitle", multiline: true },
  { key: "aboutStoryH3", label: "Heading Story (h3)" },
  { key: "aboutStoryP1", label: "Story Paragraf 1", multiline: true },
  { key: "aboutStoryP2", label: "Story Paragraf 2", multiline: true },
] as const;

const STATS = [
  { num: 1, valueKey: "aboutStat1Value", labelKey: "aboutStat1Label" },
  { num: 2, valueKey: "aboutStat2Value", labelKey: "aboutStat2Label" },
  { num: 3, valueKey: "aboutStat3Value", labelKey: "aboutStat3Label" },
  { num: 4, valueKey: "aboutStat4Value", labelKey: "aboutStat4Label" },
] as const;

const VALUES = [
  { num: 1, titleKey: "aboutValue1Title", descKey: "aboutValue1Desc" },
  { num: 2, titleKey: "aboutValue2Title", descKey: "aboutValue2Desc" },
  { num: 3, titleKey: "aboutValue3Title", descKey: "aboutValue3Desc" },
  { num: 4, titleKey: "aboutValue4Title", descKey: "aboutValue4Desc" },
] as const;

export function AboutEditor() {
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
    await adminFetch("/api/admin/content", {
      method: "POST",
      body: JSON.stringify(content),
    });
  };

  if (loading || !content) {
    return (
      <div>
        <AdminSectionHeading title="Tentang Kami" description="Edit konten section About." />
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
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
        title="Tentang Kami"
        description="Edit konten section About — story, statistik, dan nilai-nilai."
      />

      <div className="space-y-5">
        {/* Story */}
        <AdminCard className="space-y-4">
          <h3 className="text-sm font-bold border-b border-border pb-2">Story & Heading</h3>
          {STORY_FIELDS.map((f) => (
            <AdminField key={f.key} label={f.label}>
              {"multiline" in f && f.multiline ? (
                <Textarea
                  value={content[f.key] ?? ""}
                  onChange={(e) => handleChange(f.key, e.target.value)}
                  rows={3}
                  className="resize-none"
                />
              ) : (
                <Input
                  value={content[f.key] ?? ""}
                  onChange={(e) => handleChange(f.key, e.target.value)}
                />
              )}
            </AdminField>
          ))}
        </AdminCard>

        {/* Stats */}
        <AdminCard className="space-y-4">
          <h3 className="text-sm font-bold border-b border-border pb-2">Statistik (4 kartu)</h3>
          <div className="grid grid-cols-2 gap-3">
            {STATS.map((s) => (
              <div key={s.num} className="space-y-2 rounded-lg border border-border/60 p-3">
                <p className="text-xs font-semibold text-muted-foreground">Stat {s.num}</p>
                <AdminField label="Nilai">
                  <Input
                    value={content[s.valueKey] ?? ""}
                    onChange={(e) => handleChange(s.valueKey, e.target.value)}
                    placeholder="5.000+"
                  />
                </AdminField>
                <AdminField label="Label">
                  <Input
                    value={content[s.labelKey] ?? ""}
                    onChange={(e) => handleChange(s.labelKey, e.target.value)}
                    placeholder="Pelanggan Bahagia"
                  />
                </AdminField>
              </div>
            ))}
          </div>
        </AdminCard>

        {/* Values */}
        <AdminCard className="space-y-4">
          <h3 className="text-sm font-bold border-b border-border pb-2">Nilai (4 kartu)</h3>
          <div className="grid grid-cols-2 gap-3">
            {VALUES.map((v) => (
              <div key={v.num} className="space-y-2 rounded-lg border border-border/60 p-3">
                <p className="text-xs font-semibold text-muted-foreground">Nilai {v.num}</p>
                <AdminField label="Judul">
                  <Input
                    value={content[v.titleKey] ?? ""}
                    onChange={(e) => handleChange(v.titleKey, e.target.value)}
                  />
                </AdminField>
                <AdminField label="Deskripsi">
                  <Textarea
                    value={content[v.descKey] ?? ""}
                    onChange={(e) => handleChange(v.descKey, e.target.value)}
                    rows={2}
                    className="resize-none text-xs"
                  />
                </AdminField>
              </div>
            ))}
          </div>
        </AdminCard>

        <div className="flex justify-end">
          <SaveButton onSave={handleSave} />
        </div>
      </div>
    </div>
  );
}
