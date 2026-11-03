"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, GripVertical, ChevronUp, ChevronDown, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { motion, AnimatePresence } from "framer-motion";
import { adminFetch } from "@/lib/admin-client";
import { toast } from "sonner";
import {
  AdminSectionHeading,
  AdminField,
  AdminCard,
  AdminEmptyState,
  DeleteButton,
  useAdminFetch,
} from "../admin-ui";

interface FaqItem {
  id: string;
  question: string;
  answer: string;
  order: number;
  published: boolean;
}

export function FaqEditor() {
  const { data: faqs, loading, refetch } = useAdminFetch<FaqItem[]>("/api/admin/faqs");
  const [editing, setEditing] = useState<FaqItem | null>(null);
  const [creating, setCreating] = useState(false);

  const handleReorder = async (faq: FaqItem, direction: "up" | "down") => {
    if (!faqs) return;
    const idx = faqs.findIndex((f) => f.id === faq.id);
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= faqs.length) return;
    const target = faqs[targetIdx];
    try {
      await adminFetch(`/api/admin/faqs/${faq.id}`, {
        method: "PUT",
        body: JSON.stringify({ order: target.order }),
      });
      await adminFetch(`/api/admin/faqs/${target.id}`, {
        method: "PUT",
        body: JSON.stringify({ order: faq.order }),
      });
      refetch();
      toast.success("Urutan diubah");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleTogglePublish = async (faq: FaqItem) => {
    try {
      await adminFetch(`/api/admin/faqs/${faq.id}`, {
        method: "PUT",
        body: JSON.stringify({ published: !faq.published }),
      });
      refetch();
      toast.success(faq.published ? "FAQ disembunyikan" : "FAQ dipublikasi");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    await adminFetch(`/api/admin/faqs/${id}`, { method: "DELETE" });
    refetch();
  };

  if (loading) {
    return (
      <div>
        <AdminSectionHeading title="FAQ" description="Kelola pertanyaan yang sering diajukan." />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <AdminCard key={i}>
              <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
            </AdminCard>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <AdminSectionHeading
        title="FAQ"
        description="Kelola pertanyaan yang sering diajukan."
        action={
          <Button size="sm" onClick={() => setCreating(true)} className="h-9">
            <Plus className="h-4 w-4 mr-1" />
            Tambah FAQ
          </Button>
        }
      />

      {creating && (
        <FaqForm
          onSave={async (q, a) => {
            await adminFetch("/api/admin/faqs", {
              method: "POST",
              body: JSON.stringify({ question: q, answer: a }),
            });
            refetch();
            setCreating(false);
            toast.success("FAQ ditambahkan");
          }}
          onCancel={() => setCreating(false)}
        />
      )}

      {!faqs || faqs.length === 0 ? (
        <AdminEmptyState
          title="Belum ada FAQ"
          description="Tambahkan pertanyaan pertama untuk membantu pelanggan."
        />
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {faqs.map((faq, i) => (
              <motion.div
                key={faq.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                {editing?.id === faq.id ? (
                  <FaqForm
                    initial={faq}
                    onSave={async (q, a) => {
                      await adminFetch(`/api/admin/faqs/${faq.id}`, {
                        method: "PUT",
                        body: JSON.stringify({ question: q, answer: a }),
                      });
                      refetch();
                      setEditing(null);
                      toast.success("FAQ diupdate");
                    }}
                    onCancel={() => setEditing(null)}
                  />
                ) : (
                  <AdminCard className="flex items-start gap-3">
                    <div className="flex flex-col gap-0.5 shrink-0">
                      <button
                        onClick={() => handleReorder(faq, "up")}
                        disabled={i === 0}
                        className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                        aria-label="Pindah ke atas"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <GripVertical className="h-4 w-4 text-muted-foreground/50" />
                      <button
                        onClick={() => handleReorder(faq, "down")}
                        disabled={i === (faqs.length - 1)}
                        className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                        aria-label="Pindah ke bawah"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-semibold leading-tight">{faq.question}</h3>
                        <Badge variant={faq.published ? "default" : "secondary"} className="shrink-0 text-[10px]">
                          {faq.published ? "Live" : "Hidden"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{faq.answer}</p>
                      <div className="mt-2 flex gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditing(faq)}
                          className="h-7 text-xs"
                        >
                          <Pencil className="h-3 w-3 mr-1" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleTogglePublish(faq)}
                          className="h-7 text-xs"
                        >
                          {faq.published ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                          {faq.published ? "Sembunyikan" : "Publikasi"}
                        </Button>
                        <DeleteButton onDelete={() => handleDelete(faq.id)} />
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

function FaqForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: FaqItem;
  onSave: (q: string, a: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [question, setQuestion] = useState(initial?.question ?? "");
  const [answer, setAnswer] = useState(initial?.answer ?? "");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (question.trim().length < 3) {
      toast.error("Pertanyaan minimal 3 karakter");
      return;
    }
    if (answer.trim().length < 5) {
      toast.error("Jawaban minimal 5 karakter");
      return;
    }
    setSaving(true);
    try {
      await onSave(question.trim(), answer.trim());
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminCard>
      <form onSubmit={handleSubmit} className="space-y-3">
        <AdminField label="Pertanyaan" required>
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Bagaimana cara memesan?"
            autoFocus
          />
        </AdminField>
        <AdminField label="Jawaban" required>
          <Textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Jelaskan jawabannya..."
            rows={4}
            className="resize-none"
          />
        </AdminField>
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="outline" size="sm" onClick={onCancel} className="h-8">
            Batal
          </Button>
          <Button type="submit" disabled={saving} size="sm" className="h-8">
            {saving ? "Menyimpan..." : "Simpan"}
          </Button>
        </div>
      </form>
    </AdminCard>
  );
}
