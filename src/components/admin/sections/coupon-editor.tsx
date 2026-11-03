"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Ticket, Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { adminFetch } from "@/lib/admin-client";
import { toast } from "sonner";
import {
  AdminSectionHeading,
  AdminField,
  AdminEmptyState,
  DeleteButton,
  useAdminFetch,
} from "../admin-ui";

// ============================================================
// CouponEditor — manage discount codes (admin).
// ============================================================

type CouponType = "percent" | "fixed" | "free_shipping";
type ScopeType = "all" | "category" | "product";

interface Coupon {
  id: string;
  code: string;
  type: CouponType;
  value: number;
  minOrder: number;
  maxUsage: number;
  maxPerUser: number;
  usedCount: number;
  startsAt: string | null;
  expiresAt: string | null;
  active: boolean;
  scopeType: ScopeType;
  scopeValue: string | null;
  note: string | null;
  createdAt: string;
  _count?: { usages: number };
}

const TYPE_LABELS: Record<CouponType, string> = {
  percent: "Persen (%)",
  fixed: "Nominal (Rp)",
  free_shipping: "Gratis Ongkir",
};

const SCOPE_LABELS: Record<ScopeType, string> = {
  all: "Semua Produk",
  category: "Kategori Spesifik",
  product: "Produk Spesifik",
};

function formatIDR(n: number) {
  return "Rp " + n.toLocaleString("id-ID");
}

function formatDate(iso: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function CouponEditor() {
  const { data: coupons, loading, refetch } = useAdminFetch<Coupon[]>("/api/admin/coupons");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  return (
    <div>
      <AdminSectionHeading
        title="Kupon Diskon"
        description="Kelola kode diskon untuk customer. Kupon divalidasi saat checkout."
        action={
          <Button onClick={() => setCreating(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Tambah Kupon
          </Button>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !coupons || coupons.length === 0 ? (
        <AdminEmptyState
          icon={<Ticket className="h-8 w-8" />}
          title="Belum ada kupon"
          description="Buat kupon pertama untuk menarik customer baru."
          action={
            <Button onClick={() => setCreating(true)} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Tambah Kupon
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {coupons.map((c) => (
              <CouponRow
                key={c.id}
                coupon={c}
                onEdit={() => setEditing(c)}
                onDelete={() => setDeleteId(c.id)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {(creating || editing) && (
        <CouponFormDialog
          coupon={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            refetch();
          }}
        />
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus kupon?</AlertDialogTitle>
            <AlertDialogDescription>
              Kupon akan dihapus permanen beserta riwayat pemakaiannya. Tindakan ini tidak bisa dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deleteId) return;
                try {
                  await adminFetch(`/api/admin/coupons/${deleteId}`, { method: "DELETE" });
                  toast.success("Kupon dihapus");
                  refetch();
                } catch (err: any) {
                  toast.error(err.message || "Gagal hapus kupon");
                }
                setDeleteId(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============================================================
// CouponRow — single coupon card in the list.
// ============================================================

function CouponRow({
  coupon,
  onEdit,
  onDelete,
}: {
  coupon: Coupon;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const usagePct =
    coupon.maxUsage > 0 ? Math.min(100, (coupon.usedCount / coupon.maxUsage) * 100) : 0;
  const isExpired = coupon.expiresAt ? new Date(coupon.expiresAt) < new Date() : false;
  const statusColor = !coupon.active
    ? "bg-slate-500/15 text-slate-700 dark:text-slate-300"
    : isExpired
    ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
    : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
  const statusLabel = !coupon.active
    ? "Nonaktif"
    : isExpired
    ? "Kedaluwarsa"
    : "Aktif";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className="rounded-xl border border-border bg-card p-3.5 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <code className="text-base font-mono font-bold">{coupon.code}</code>
            <Badge variant="secondary" className="text-[10px]">
              {TYPE_LABELS[coupon.type]}
            </Badge>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${statusColor}`}>
              {statusLabel}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {coupon.type === "percent" && `${coupon.value}% off subtotal`}
            {coupon.type === "fixed" && `${formatIDR(coupon.value)} off subtotal`}
            {coupon.type === "free_shipping" && "Gratis ongkir"}
            {coupon.minOrder > 0 && ` · min ${formatIDR(coupon.minOrder)}`}
            {coupon.scopeType !== "all" && ` · ${SCOPE_LABELS[coupon.scopeType]}: ${coupon.scopeValue}`}
          </p>
          <div className="mt-2 flex items-center gap-3 text-[10px] text-muted-foreground">
            <span>
              Terpakai: <strong className="text-foreground">{coupon.usedCount}</strong>
              {coupon.maxUsage > 0 ? ` / ${coupon.maxUsage}` : " (∞)"}
            </span>
            <span>·</span>
            <span>Per user: {coupon.maxPerUser > 0 ? coupon.maxPerUser : "∞"}</span>
            <span>·</span>
            <span>History: {coupon._count?.usages ?? 0}</span>
            {coupon.expiresAt && (
              <>
                <span>·</span>
                <span>Berakhir: {formatDate(coupon.expiresAt)}</span>
              </>
            )}
          </div>
          {coupon.maxUsage > 0 && (
            <div className="mt-2 h-1 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${usagePct}%` }}
              />
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit} aria-label="Edit">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <DeleteButton onClick={onDelete} aria-label="Hapus" />
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================
// CouponFormDialog — create/edit coupon form.
// ============================================================

interface FormData {
  code: string;
  type: CouponType;
  value: number;
  minOrder: number;
  maxUsage: number;
  maxPerUser: number;
  active: boolean;
  scopeType: ScopeType;
  scopeValue: string;
  startsAt: string;
  expiresAt: string;
  note: string;
}

const EMPTY: FormData = {
  code: "",
  type: "percent",
  value: 10,
  minOrder: 0,
  maxUsage: 0,
  maxPerUser: 1,
  active: true,
  scopeType: "all",
  scopeValue: "",
  startsAt: "",
  expiresAt: "",
  note: "",
};

function CouponFormDialog({
  coupon,
  onClose,
  onSaved,
}: {
  coupon: Coupon | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormData>(
    coupon
      ? {
          code: coupon.code,
          type: coupon.type,
          value: coupon.value,
          minOrder: coupon.minOrder,
          maxUsage: coupon.maxUsage,
          maxPerUser: coupon.maxPerUser,
          active: coupon.active,
          scopeType: coupon.scopeType,
          scopeValue: coupon.scopeValue ?? "",
          startsAt: coupon.startsAt ? coupon.startsAt.slice(0, 10) : "",
          expiresAt: coupon.expiresAt ? coupon.expiresAt.slice(0, 10) : "",
          note: coupon.note ?? "",
        }
      : EMPTY
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.code.trim()) {
      toast.error("Kode kupon wajib diisi");
      return;
    }
    if (form.type === "percent" && (form.value < 1 || form.value > 100)) {
      toast.error("Persen harus 1-100");
      return;
    }
    setSaving(true);
    try {
      const body = {
        code: form.code.trim().toUpperCase(),
        type: form.type,
        value: form.type === "free_shipping" ? 0 : form.value,
        minOrder: form.minOrder,
        maxUsage: form.maxUsage,
        maxPerUser: form.maxPerUser,
        active: form.active,
        scopeType: form.scopeType,
        scopeValue: form.scopeType === "all" ? null : form.scopeValue.trim() || null,
        startsAt: form.startsAt || null,
        expiresAt: form.expiresAt || null,
        note: form.note.trim() || null,
      };
      if (coupon) {
        await adminFetch(`/api/admin/coupons/${coupon.id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        toast.success("Kupon diupdate");
      } else {
        await adminFetch("/api/admin/coupons", {
          method: "POST",
          body: JSON.stringify(body),
        });
        toast.success("Kupon dibuat");
      }
      onSaved();
    } catch (err: any) {
      toast.error(err.message || "Gagal simpan kupon");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{coupon ? "Edit Kupon" : "Tambah Kupon"}</DialogTitle>
          <DialogDescription>
            Atur kode diskon, tipe, batas pemakaian, dan masa berlaku.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          <AdminField label="Kode Kupon" required hint="Huruf besar otomatis. Contoh: WELCOME10">
            <Input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              placeholder="WELCOME10"
              className="font-mono"
            />
          </AdminField>

          <div className="grid grid-cols-2 gap-3">
            <AdminField label="Tipe Diskon" required>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as CouponType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Persen (%)</SelectItem>
                  <SelectItem value="fixed">Nominal (Rp)</SelectItem>
                  <SelectItem value="free_shipping">Gratis Ongkir</SelectItem>
                </SelectContent>
              </Select>
            </AdminField>
            <AdminField
              label={form.type === "percent" ? "Persen (1-100)" : "Nominal (Rp)"}
              required={form.type !== "free_shipping"}
            >
              <Input
                type="number"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: Number(e.target.value) })}
                disabled={form.type === "free_shipping"}
                min={0}
              />
            </AdminField>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <AdminField label="Min. Belanja (Rp)" hint="0 = tanpa batas">
              <Input
                type="number"
                value={form.minOrder}
                onChange={(e) => setForm({ ...form, minOrder: Number(e.target.value) })}
                min={0}
              />
            </AdminField>
            <AdminField label="Max Total Pakai" hint="0 = ∞">
              <Input
                type="number"
                value={form.maxUsage}
                onChange={(e) => setForm({ ...form, maxUsage: Number(e.target.value) })}
                min={0}
              />
            </AdminField>
            <AdminField label="Max Per User" hint="0 = ∞">
              <Input
                type="number"
                value={form.maxPerUser}
                onChange={(e) => setForm({ ...form, maxPerUser: Number(e.target.value) })}
                min={0}
              />
            </AdminField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <AdminField label="Berlaku Mulai" hint="Kosongkan = langsung">
              <Input
                type="date"
                value={form.startsAt}
                onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
              />
            </AdminField>
            <AdminField label="Berakhir" hint="Kosongkan = tanpa batas">
              <Input
                type="date"
                value={form.expiresAt}
                onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
              />
            </AdminField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <AdminField label="Scope" hint="Batasi ke kategori/produk">
              <Select value={form.scopeType} onValueChange={(v) => setForm({ ...form, scopeType: v as ScopeType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Produk</SelectItem>
                  <SelectItem value="category">Kategori Spesifik</SelectItem>
                  <SelectItem value="product">Produk Spesifik</SelectItem>
                </SelectContent>
              </Select>
            </AdminField>
            {form.scopeType !== "all" && (
              <AdminField
                label={form.scopeType === "category" ? "Nama Kategori" : "Item Code"}
                required
              >
                <Input
                  value={form.scopeValue}
                  onChange={(e) => setForm({ ...form, scopeValue: e.target.value })}
                  placeholder={form.scopeType === "category" ? "Sayuran" : "TOMAT-001"}
                />
              </AdminField>
            )}
          </div>

          <AdminField label="Catatan Internal" hint="Hanya untuk admin, tidak tampil ke customer">
            <Textarea
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              rows={2}
              placeholder="Contoh: campaign Ramadan 2026"
            />
          </AdminField>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <Label className="text-sm font-medium">Aktif</Label>
              <p className="text-xs text-muted-foreground">Kupon bisa dipakai saat checkout</p>
            </div>
            <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Batal
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
            {coupon ? "Simpan" : "Buat Kupon"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
