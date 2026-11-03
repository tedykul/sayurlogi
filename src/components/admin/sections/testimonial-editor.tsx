"use client";

import { useState } from "react";
import { Plus, Pencil, Star, ChevronUp, ChevronDown, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { adminFetch } from "@/lib/admin-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  AdminSectionHeading,
  AdminField,
  AdminCard,
  AdminEmptyState,
  DeleteButton,
  useAdminFetch,
} from "../admin-ui";

interface Testimonial {
  id: string;
  name: string;
  role: string;
  avatar: string;
  rating: number;
  text: string;
  location: string;
  order: number;
  published: boolean;
}

export function TestimonialEditor() {
  const { data: items, loading, refetch } = useAdminFetch<Testimonial[]>("/api/admin/testimonials");
  const [editing, setEditing] = useState<Testimonial | null>(null);
  const [creating, setCreating] = useState(false);

  const handleReorder = async (item: Testimonial, direction: "up" | "down") => {
    if (!items) return;
    const idx = items.findIndex((i) => i.id === item.id);
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= items.length) return;
    const target = items[targetIdx];
    try {
      await adminFetch(`/api/admin/testimonials/${item.id}`, {
        method: "PUT",
        body: JSON.stringify({ order: target.order }),
      });
      await adminFetch(`/api/admin/testimonials/${target.id}`, {
        method: "PUT",
        body: JSON.stringify({ order: item.order }),
      });
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleTogglePublish = async (item: Testimonial) => {
    try {
      await adminFetch(`/api/admin/testimonials/${item.id}`, {
        method: "PUT",
        body: JSON.stringify({ published: !item.published }),
      });
      refetch();
      toast.success(item.published ? "Disembunyikan" : "Dipublikasi");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    await adminFetch(`/api/admin/testimonials/${id}`, { method: "DELETE" });
    refetch();
  };

  if (loading) {
    return (
      <div>
        <AdminSectionHeading title="Testimoni" description="Kelola ulasan pelanggan." />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <AdminCard key={i}>
              <div className="h-4 w-1/2 bg-muted rounded animate-pulse" />
            </AdminCard>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <AdminSectionHeading
        title="Testimoni"
        description="Keloma ulasan pelanggan yang tampil di section 'Apa Kata Pelanggan'."
        action={
          <Button size="sm" onClick={() => setCreating(true)} className="h-9">
            <Plus className="h-4 w-4 mr-1" />
            Tambah
          </Button>
        }
      />

      {creating && (
        <TestimonialForm
          onSave={async (data) => {
            await adminFetch("/api/admin/testimonials", {
              method: "POST",
              body: JSON.stringify(data),
            });
            refetch();
            setCreating(false);
            toast.success("Testimoni ditambahkan");
          }}
          onCancel={() => setCreating(false)}
        />
      )}

      {!items || items.length === 0 ? (
        <AdminEmptyState title="Belum ada testimoni" />
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {items.map((item, i) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                {editing?.id === item.id ? (
                  <TestimonialForm
                    initial={item}
                    onSave={async (data) => {
                      await adminFetch(`/api/admin/testimonials/${item.id}`, {
                        method: "PUT",
                        body: JSON.stringify(data),
                      });
                      refetch();
                      setEditing(null);
                      toast.success("Testimoni diupdate");
                    }}
                    onCancel={() => setEditing(null)}
                  />
                ) : (
                  <AdminCard className="flex items-start gap-3">
                    <div className="flex flex-col shrink-0">
                      <button
                        onClick={() => handleReorder(item, "up")}
                        disabled={i === 0}
                        className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                        aria-label="Naik"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleReorder(item, "down")}
                        disabled={i === items.length - 1}
                        className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                        aria-label="Turun"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="text-2xl shrink-0">{item.avatar}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-semibold leading-tight">{item.name}</h3>
                          <p className="text-xs text-muted-foreground">
                            {item.role} · {item.location}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                          <span className="text-xs font-semibold">{item.rating}</span>
                          <Badge variant={item.published ? "default" : "secondary"} className="ml-1 text-[10px]">
                            {item.published ? "Live" : "Hidden"}
                          </Badge>
                        </div>
                      </div>
                      <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2 italic">"{item.text}"</p>
                      <div className="mt-2 flex gap-1.5">
                        <Button size="sm" variant="outline" onClick={() => setEditing(item)} className="h-7 text-xs">
                          <Pencil className="h-3 w-3 mr-1" />
                          Edit
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleTogglePublish(item)} className="h-7 text-xs">
                          {item.published ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                          {item.published ? "Sembunyikan" : "Publikasi"}
                        </Button>
                        <DeleteButton onDelete={() => handleDelete(item.id)} />
                      </div>
                    </div>
                  </AdminCard>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

interface FormData {
  name: string;
  role: string;
  avatar: string;
  rating: number;
  text: string;
  location: string;
}

function TestimonialForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Testimonial;
  onSave: (data: FormData) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<FormData>({
    name: initial?.name ?? "",
    role: initial?.role ?? "",
    avatar: initial?.avatar ?? "👤",
    rating: initial?.rating ?? 5,
    text: initial?.text ?? "",
    location: initial?.location ?? "",
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.name.trim().length < 2) return toast.error("Nama minimal 2 karakter");
    if (form.text.trim().length < 10) return toast.error("Testimoni minimal 10 karakter");
    setSaving(true);
    try {
      await onSave(form);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const EMOJIS = ["👤", "👩", "👨", "👩‍💼", "👨‍💼", "👩‍🍳", "👨‍🍳", "🏃", "👵", "👴", "🧑‍🎨", "👩‍🏫"];

  return (
    <AdminCard>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <AdminField label="Nama" required>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Dewi Lestari" />
          </AdminField>
          <AdminField label="Role/Profesi">
            <Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="Ibu Rumah Tangga" />
          </AdminField>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <AdminField label="Lokasi">
            <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Jakarta" />
          </AdminField>
          <AdminField label="Rating (0-5)" required>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setForm({ ...form, rating: n })}
                  aria-label={`Rating ${n}`}
                >
                  <Star
                    className={cn(
                      "h-6 w-6 transition-colors",
                      n <= form.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"
                    )}
                  />
                </button>
              ))}
            </div>
          </AdminField>
        </div>
        <AdminField label="Avatar (emoji)">
          <div className="flex flex-wrap gap-1.5">
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setForm({ ...form, avatar: e })}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-lg border text-lg transition-colors",
                  form.avatar === e ? "border-primary bg-primary/10" : "border-border hover:bg-accent"
                )}
              >
                {e}
              </button>
            ))}
          </div>
        </AdminField>
        <AdminField label="Testimoni" required>
          <Textarea
            value={form.text}
            onChange={(e) => setForm({ ...form, text: e.target.value })}
            placeholder="Tulis ulasan pelanggan..."
            rows={4}
            className="resize-none"
          />
        </AdminField>
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="outline" size="sm" onClick={onCancel} className="h-8">Batal</Button>
          <Button type="submit" disabled={saving} size="sm" className="h-8">
            {saving ? "Menyimpan..." : "Simpan"}
          </Button>
        </div>
      </form>
    </AdminCard>
  );
}
