"use client";

import { useState } from "react";
import { Plus, Pencil, ChevronUp, ChevronDown, Eye, EyeOff } from "lucide-react";
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

interface Category {
  id: string;
  name: string;
  emoji: string;
  description: string | null;
  gradient: string;
  order: number;
  published: boolean;
}

const GRADIENTS = [
  { value: "from-green-400 to-emerald-600", label: "Hijau", preview: "bg-gradient-to-br from-green-400 to-emerald-600" },
  { value: "from-rose-400 to-red-600", label: "Merah", preview: "bg-gradient-to-br from-rose-400 to-red-600" },
  { value: "from-lime-400 to-green-600", label: "Lime", preview: "bg-gradient-to-br from-lime-400 to-green-600" },
  { value: "from-amber-400 to-orange-600", label: "Amber", preview: "bg-gradient-to-br from-amber-400 to-orange-600" },
  { value: "from-cyan-400 to-blue-600", label: "Cyan", preview: "bg-gradient-to-br from-cyan-400 to-blue-600" },
  { value: "from-violet-400 to-purple-600", label: "Violet", preview: "bg-gradient-to-br from-violet-400 to-purple-600" },
  { value: "from-slate-400 to-slate-600", label: "Slate", preview: "bg-gradient-to-br from-slate-400 to-slate-600" },
];

const EMOJIS = ["🥬", "🍎", "🌿", "🧺", "🥕", "🌽", "🍇", "🥦", "🍅", "🍊", "🍋", "🍆"];

export function CategoryEditor() {
  const { data: items, loading, refetch } = useAdminFetch<Category[]>("/api/admin/categories");
  const [editing, setEditing] = useState<Category | null>(null);
  const [creating, setCreating] = useState(false);

  const handleReorder = async (item: Category, direction: "up" | "down") => {
    if (!items) return;
    const idx = items.findIndex((i) => i.id === item.id);
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= items.length) return;
    const target = items[targetIdx];
    try {
      await adminFetch(`/api/admin/categories/${item.id}`, { method: "PUT", body: JSON.stringify({ order: target.order }) });
      await adminFetch(`/api/admin/categories/${target.id}`, { method: "PUT", body: JSON.stringify({ order: item.order }) });
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleTogglePublish = async (item: Category) => {
    try {
      await adminFetch(`/api/admin/categories/${item.id}`, { method: "PUT", body: JSON.stringify({ published: !item.published }) });
      refetch();
      toast.success(item.published ? "Disembunyikan" : "Dipublikasi");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    await adminFetch(`/api/admin/categories/${id}`, { method: "DELETE" });
    refetch();
  };

  if (loading) {
    return (
      <div>
        <AdminSectionHeading title="Kategori" description="Kelola kategori produk." />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <AdminCard key={i}><div className="h-4 w-1/3 bg-muted rounded animate-pulse" /></AdminCard>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <AdminSectionHeading
        title="Kategori"
        description="Kelola kategori produk yang tampil di filter belanja."
        action={
          <Button size="sm" onClick={() => setCreating(true)} className="h-9">
            <Plus className="h-4 w-4 mr-1" />
            Tambah
          </Button>
        }
      />

      {creating && (
        <CategoryForm
          onSave={async (data) => {
            await adminFetch("/api/admin/categories", { method: "POST", body: JSON.stringify(data) });
            refetch();
            setCreating(false);
            toast.success("Kategori ditambahkan");
          }}
          onCancel={() => setCreating(false)}
        />
      )}

      {!items || items.length === 0 ? (
        <AdminEmptyState title="Belum ada kategori" />
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
                  <CategoryForm
                    initial={item}
                    onSave={async (data) => {
                      await adminFetch(`/api/admin/categories/${item.id}`, { method: "PUT", body: JSON.stringify(data) });
                      refetch();
                      setEditing(null);
                      toast.success("Kategori diupdate");
                    }}
                    onCancel={() => setEditing(null)}
                  />
                ) : (
                  <AdminCard className="flex items-center gap-3">
                    <div className="flex flex-col shrink-0">
                      <button onClick={() => handleReorder(item, "up")} disabled={i === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30" aria-label="Naik">
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleReorder(item, "down")} disabled={i === items.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30" aria-label="Turun">
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    </div>
                    <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-lg", item.gradient)}>
                      {item.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold">{item.name}</h3>
                        <Badge variant={item.published ? "default" : "secondary"} className="text-[10px]">
                          {item.published ? "Live" : "Hidden"}
                        </Badge>
                      </div>
                      {item.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1">{item.description}</p>
                      )}
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <Button size="sm" variant="outline" onClick={() => setEditing(item)} className="h-7 text-xs">
                        <Pencil className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleTogglePublish(item)} className="h-7 text-xs">
                        {item.published ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                      </Button>
                      <DeleteButton onDelete={() => handleDelete(item.id)} />
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
  emoji: string;
  description: string;
  gradient: string;
}

function CategoryForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Category;
  onSave: (data: FormData) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<FormData>({
    name: initial?.name ?? "",
    emoji: initial?.emoji ?? "🥬",
    description: initial?.description ?? "",
    gradient: initial?.gradient ?? "from-green-400 to-emerald-600",
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.name.trim().length < 2) return toast.error("Nama minimal 2 karakter");
    setSaving(true);
    try {
      await onSave(form);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminCard>
      <form onSubmit={handleSubmit} className="space-y-3">
        <AdminField label="Nama Kategori" required>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Sayuran" />
        </AdminField>
        <AdminField label="Deskripsi">
          <Textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Sayuran segar dari petani lokal"
            rows={2}
            className="resize-none"
          />
        </AdminField>
        <AdminField label="Emoji">
          <div className="flex flex-wrap gap-1.5">
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setForm({ ...form, emoji: e })}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-lg border text-lg transition-colors",
                  form.emoji === e ? "border-primary bg-primary/10" : "border-border hover:bg-accent"
                )}
              >
                {e}
              </button>
            ))}
          </div>
        </AdminField>
        <AdminField label="Warna Gradient">
          <div className="flex flex-wrap gap-1.5">
            {GRADIENTS.map((g) => (
              <button
                key={g.value}
                type="button"
                onClick={() => setForm({ ...form, gradient: g.value })}
                className={cn(
                  "flex h-9 items-center gap-1.5 rounded-lg border px-2 text-xs transition-colors",
                  form.gradient === g.value ? "border-primary" : "border-border"
                )}
              >
                <span className={cn("h-4 w-4 rounded-full", g.preview)} />
                {g.label}
              </button>
            ))}
          </div>
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
