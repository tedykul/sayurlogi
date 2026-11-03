"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Clock, Plus, Trash2, Save, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { adminFetch } from "@/lib/admin-client";
import { toast } from "sonner";
import { AdminCard } from "../admin-ui";

// ============================================================
// SlotTemplateEditor — manage custom delivery slot templates.
// ============================================================
// Admin defines time windows (e.g. 08:00-10:00 "Pagi Awal").
// Stored in DB → used by generateAndListSlots() for slot generation.
// Falls back to Pagi/Siang/Sore if empty.
// ============================================================

interface SlotTemplate {
  startHour: number;
  endHour: number;
  label: string;
}

const DEFAULT_TEMPLATES: SlotTemplate[] = [
  { startHour: 9, endHour: 12, label: "Pagi" },
  { startHour: 12, endHour: 15, label: "Siang" },
  { startHour: 15, endHour: 18, label: "Sore" },
];

function formatHour(h: number): string {
  return `${String(h).padStart(2, "0")}:00`;
}

export function SlotTemplateEditor() {
  const [templates, setTemplates] = useState<SlotTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isCustom, setIsCustom] = useState(false);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch<{ success: boolean; templates: SlotTemplate[] }>(
        "/api/admin/delivery/slot-templates"
      );
      setTemplates(res.templates || []);
      // Check if custom (different from default)
      const isDefault =
        res.templates.length === 3 &&
        res.templates[0]?.startHour === 9 &&
        res.templates[1]?.startHour === 12 &&
        res.templates[2]?.startHour === 15;
      setIsCustom(!isDefault);
    } catch (err: any) {
      toast.error(err.message || "Gagal memuat slot templates");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleAdd = () => {
    setTemplates([...templates, { startHour: 18, endHour: 20, label: "Slot Baru" }]);
  };

  const handleRemove = (index: number) => {
    setTemplates(templates.filter((_, i) => i !== index));
  };

  const handleChange = (index: number, field: keyof SlotTemplate, value: string | number) => {
    setTemplates(templates.map((t, i) => (i === index ? { ...t, [field]: value } : t)));
  };

  const handleSave = async () => {
    // Validate
    for (const t of templates) {
      if (!t.label.trim()) {
        toast.error("Label slot tidak boleh kosong");
        return;
      }
      if (t.startHour >= t.endHour) {
        toast.error(`${t.label}: jam mulai harus lebih kecil dari jam selesai`);
        return;
      }
    }
    // Check for duplicate startHours
    const startHours = templates.map((t) => t.startHour);
    if (new Set(startHours).size !== startHours.length) {
      toast.error("Ada jam mulai yang duplikat");
      return;
    }

    setSaving(true);
    try {
      await adminFetch("/api/admin/delivery/slot-templates", {
        method: "PUT",
        body: JSON.stringify({ templates }),
      });
      toast.success("Template slot disimpan");
      fetchTemplates();
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefault = () => {
    setTemplates([...DEFAULT_TEMPLATES]);
    setIsCustom(false);
    toast.info("Reset ke default. Klik Simpan untuk konfirmasi.");
  };

  return (
    <AdminCard>
      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-600 dark:text-cyan-400">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2">
                Template Slot Waktu
                {isCustom ? (
                  <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px]">Custom</Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px]">Default</Badge>
                )}
              </h3>
              <p className="text-[11px] text-muted-foreground">Atur jam pengiriman custom</p>
            </div>
          </div>
          <Button onClick={handleResetDefault} size="sm" variant="ghost" className="h-7 text-[10px]">
            <RotateCcw className="h-3 w-3 mr-1" /> Reset Default
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Memuat...
          </div>
        ) : (
          <>
            {/* Template list */}
            <div className="space-y-2">
              {templates.map((tmpl, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border border-border/60 bg-card p-2">
                  <Input
                    type="text"
                    value={tmpl.label}
                    onChange={(e) => handleChange(i, "label", e.target.value)}
                    className="h-8 text-xs flex-1"
                    placeholder="Label (mis: Pagi)"
                  />
                  <div className="flex items-center gap-1 text-xs">
                    <Input
                      type="number"
                      value={tmpl.startHour}
                      onChange={(e) => handleChange(i, "startHour", parseInt(e.target.value, 10) || 0)}
                      className="h-8 w-14 text-xs text-center"
                      min={0}
                      max={23}
                    />
                    <span className="text-muted-foreground">-</span>
                    <Input
                      type="number"
                      value={tmpl.endHour}
                      onChange={(e) => handleChange(i, "endHour", parseInt(e.target.value, 10) || 0)}
                      className="h-8 w-14 text-xs text-center"
                      min={1}
                      max={24}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0 w-20">
                    {formatHour(tmpl.startHour)}-{formatHour(tmpl.endHour)}
                  </span>
                  <Button
                    onClick={() => handleRemove(i)}
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button onClick={handleAdd} size="sm" variant="outline" className="flex-1 h-8 text-xs">
                <Plus className="h-3.5 w-3.5 mr-1" /> Tambah Slot
              </Button>
              <Button onClick={handleSave} disabled={saving} size="sm" className="flex-1 h-8 text-xs">
                {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                Simpan Template
              </Button>
            </div>

            {/* Info */}
            <div className="rounded-lg bg-secondary/50 p-2.5 text-[10px] text-muted-foreground space-y-1">
              <p><strong className="text-foreground">Cara kerja:</strong></p>
              <p>• Template ini dipakai untuk generate slot 7 hari ke depan</p>
              <p>• Customer pilih slot saat checkout (kalau scheduling di-enable)</p>
              <p>• Default: Pagi (09-12), Siang (12-15), Sore (15-18)</p>
              <p>• Custom: bebas tambah/edit/hapus slot (mis: 08-10 "Pagi Awal", 18-20 "Malam")</p>
              <p>• Jam mulai tidak boleh duplikat (unique constraint)</p>
              <p>• Format: jam dalam angka (0-24). Contoh: 9 = 09:00, 14 = 14:00</p>
            </div>
          </>
        )}
      </div>
    </AdminCard>
  );
}
