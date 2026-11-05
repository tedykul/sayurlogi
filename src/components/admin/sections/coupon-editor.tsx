"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Ticket,
  Loader2,
  QrCode,
  Share2,
  FileText,
  Copy,
  Check,
  MousePointerClick,
  Printer,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
// CouponEditor — manage discount codes + QR/Share/PDF (admin).
// ============================================================
// Features:
//   - Create / edit / delete coupons (existing)
//   - Share via WhatsApp (wa.me link, pre-filled message)
//   - QR Code preview dialog (base64 PNG, copy share URL)
//   - PDF export single (printable HTML in new tab)
//   - Batch generate (prefix + count → N coupons)
//   - Batch PDF export (multi-select → printable HTML)
//   - Tracking metrics display (clicks, shares, prints)
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
  // Tracking (backward compatible — all default 0 in schema)
  clickCount?: number;
  shareCount?: number;
  printedCount?: number;
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
  const [qrCoupon, setQrCoupon] = useState<Coupon | null>(null);
  const [batchGenOpen, setBatchGenOpen] = useState(false);

  // Multi-select for batch PDF
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (!coupons) return;
    setSelectedIds(new Set(coupons.map((c) => c.id)));
  }, [coupons]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const handleBatchPdf = useCallback(() => {
    if (selectedIds.size === 0) {
      toast.error("Pilih minimal 1 kupon");
      return;
    }
    const ids = Array.from(selectedIds).join(",");
    // Cookie (admin_session) is sent automatically for same-origin GET.
    window.open(`/api/admin/coupons/export-pdf?ids=${ids}`, "_blank");
    toast.success(`Membuka PDF ${selectedIds.size} kupon di tab baru`);
  }, [selectedIds]);

  return (
    <div>
      <AdminSectionHeading
        title="Kupon Diskon"
        description="Kelola kode diskon + QR Code + Share WhatsApp + Export PDF."
        action={
          <div className="flex items-center gap-2">
            <Button onClick={() => setBatchGenOpen(true)} variant="outline" size="sm">
              <Sparkles className="h-4 w-4 mr-1" />
              Batch Generate
            </Button>
            <Button onClick={() => setCreating(true)} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Tambah Kupon
            </Button>
          </div>
        }
      />

      {selectedIds.size > 0 && (
        <div className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
          <span className="text-sm font-medium">
            {selectedIds.size} kupon dipilih
          </span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleBatchPdf}>
              <FileText className="h-4 w-4 mr-1" />
              Export PDF
            </Button>
            <Button size="sm" variant="ghost" onClick={clearSelection}>
              Batal
            </Button>
          </div>
        </div>
      )}

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
          {!loading && coupons && coupons.length > 0 && selectedIds.size === 0 && (
            <div className="flex justify-end">
              <Button size="sm" variant="ghost" onClick={selectAll} className="h-7 text-xs">
                Pilih semua
              </Button>
            </div>
          )}
          <AnimatePresence>
            {coupons.map((c) => (
              <CouponRow
                key={c.id}
                coupon={c}
                selected={selectedIds.has(c.id)}
                onToggleSelect={() => toggleSelect(c.id)}
                onEdit={() => setEditing(c)}
                onDelete={() => setDeleteId(c.id)}
                onShare={() => handleShare(c)}
                onShowQr={() => setQrCoupon(c)}
                onPdf={() => openSinglePdf(c)}
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

      {qrCoupon && (
        <QrPreviewDialog
          coupon={qrCoupon}
          onClose={() => setQrCoupon(null)}
          onShared={() => refetch()}
        />
      )}

      {batchGenOpen && (
        <BatchGenerateDialog
          onClose={() => setBatchGenOpen(false)}
          onSaved={() => {
            setBatchGenOpen(false);
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
// CouponRow — single coupon card with QR/Share/PDF actions.
// ============================================================

function CouponRow({
  coupon,
  selected,
  onToggleSelect,
  onEdit,
  onDelete,
  onShare,
  onShowQr,
  onPdf,
}: {
  coupon: Coupon;
  selected: boolean;
  onToggleSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onShare: () => void;
  onShowQr: () => void;
  onPdf: () => void;
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
      className={`rounded-xl border bg-card p-3.5 shadow-sm transition-colors ${
        selected ? "border-primary" : "border-border"
      }`}
    >
      <div className="flex items-start gap-2">
        <div className="flex h-9 items-center pt-0.5">
          <Checkbox
            checked={selected}
            onCheckedChange={onToggleSelect}
            aria-label={`Pilih ${coupon.code}`}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <code className="text-base font-mono font-bold">{coupon.code}</code>
            <Badge variant="secondary" className="text-xs">
              {TYPE_LABELS[coupon.type]}
            </Badge>
            <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${statusColor}`}>
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
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
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
          {/* Tracking metrics */}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400" title="Jumlah klik link share">
              <MousePointerClick className="h-3 w-3" />
              {coupon.clickCount ?? 0} klik
            </span>
            <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400" title="Jumlah share via WhatsApp">
              <Share2 className="h-3 w-3" />
              {coupon.shareCount ?? 0} share
            </span>
            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400" title="Jumlah export PDF">
              <Printer className="h-3 w-3" />
              {coupon.printedCount ?? 0} cetak
            </span>
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
        <div className="flex flex-col items-end gap-1 shrink-0">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onShowQr} aria-label="QR Code" title="QR Code">
              <QrCode className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onShare} aria-label="Share WhatsApp" title="Share WhatsApp">
              <Share2 className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onPdf} aria-label="Export PDF" title="Export PDF">
              <FileText className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit} aria-label="Edit">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <DeleteButton onDelete={onDelete} label="" className="h-8 w-8 px-0" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================
// Actions — share via WA + open single PDF.
// ============================================================

async function handleShare(coupon: Coupon) {
  try {
    const data = await adminFetch<{ whatsappUrl: string; shareUrl: string }>(
      `/api/admin/coupons/${coupon.id}/share`,
      {
        method: "POST",
        body: JSON.stringify({ baseUrl: window.location.origin }),
      }
    );
    window.open(data.whatsappUrl, "_blank", "noopener,noreferrer");
    toast.success(`Share WhatsApp dibuka`, {
      description: `Kode: ${coupon.code}`,
    });
  } catch (err: any) {
    toast.error(err.message || "Gagal membuat link share");
  }
}

function openSinglePdf(coupon: Coupon) {
  // Cookie (admin_session) is sent automatically for same-origin GET.
  window.open(`/api/admin/coupons/${coupon.id}/pdf`, "_blank");
  toast.success(`PDF dibuka di tab baru`, {
    description: `Kode: ${coupon.code}`,
  });
}

// ============================================================
// QrPreviewDialog — inline QR preview + copy share URL.
// ============================================================

function QrPreviewDialog({
  coupon,
  onClose,
  onShared,
}: {
  coupon: Coupon;
  onClose: () => void;
  onShared: () => void;
}) {
  const [data, setData] = useState<{
    qrDataUrl: string;
    shareUrl: string;
    code: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Fetch QR on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await adminFetch<{
          qrDataUrl: string;
          shareUrl: string;
          code: string;
        }>(`/api/admin/coupons/${coupon.id}/qr`);
        if (!cancelled) {
          setData(res);
          setLoading(false);
        }
      } catch (err: any) {
        if (!cancelled) {
          toast.error(err.message || "Gagal memuat QR code");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [coupon.id]);

  const handleCopy = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.shareUrl);
      setCopied(true);
      toast.success("Link disalin ke clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Gagal menyalin link");
    }
  };

  const handleShareWa = async () => {
    try {
      const res = await adminFetch<{ whatsappUrl: string }>(
        `/api/admin/coupons/${coupon.id}/share`,
        {
          method: "POST",
          body: JSON.stringify({ baseUrl: window.location.origin }),
        }
      );
      window.open(res.whatsappUrl, "_blank", "noopener,noreferrer");
      onShared();
    } catch (err: any) {
      toast.error(err.message || "Gagal share");
    }
  };

  const handleDownloadQr = () => {
    if (!data) return;
    // Convert data URL → blob → download
    const link = document.createElement("a");
    link.href = data.qrDataUrl;
    link.download = `qr-${coupon.code}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`QR ${coupon.code}.png diunduh`);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>QR Code Kupon</DialogTitle>
          <DialogDescription>
            Scan QR untuk membuka toko dan otomatis menerapkan kupon.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : data ? (
          <div className="flex flex-col items-center gap-3">
            <div className="rounded-xl border-2 border-emerald-500 p-3 bg-white">
              <img
                src={data.qrDataUrl}
                alt={`QR Code ${data.code}`}
                width={200}
                height={200}
                className="block"
              />
            </div>
            <code className="text-lg font-mono font-bold">{data.code}</code>
            <div className="w-full rounded-lg bg-secondary/50 p-2.5">
              <p className="mb-1 text-xs text-muted-foreground">Share URL:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate text-xs">{data.shareUrl}</code>
                <Button size="sm" variant="outline" onClick={handleCopy} className="h-7 shrink-0">
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={handleDownloadQr} disabled={!data}>
              <FileText className="h-4 w-4 mr-1" />
              Unduh PNG
            </Button>
            <Button onClick={handleShareWa}>
              <Share2 className="h-4 w-4 mr-1" />
              Share WA
            </Button>
          </div>
          <Button variant="ghost" onClick={() => window.open(`/api/admin/coupons/${coupon.id}/pdf`, "_blank")}>
            <Printer className="h-4 w-4 mr-1" />
            Buka PDF Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// BatchGenerateDialog — generate N coupons with prefix.
// ============================================================

interface BatchForm {
  prefix: string;
  count: number;
  type: CouponType;
  value: number;
  minOrder: number;
  maxUsage: number;
  maxPerUser: number;
  expiresAt: string;
  note: string;
}

const BATCH_EMPTY: BatchForm = {
  prefix: "PROMO",
  count: 10,
  type: "percent",
  value: 10,
  minOrder: 0,
  maxUsage: 100,
  maxPerUser: 1,
  expiresAt: "",
  note: "",
};

function BatchGenerateDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<BatchForm>(BATCH_EMPTY);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ created: number; codes: string[] } | null>(null);

  const handleSave = async () => {
    if (!form.prefix.trim()) {
      toast.error("Prefix wajib diisi");
      return;
    }
    if (form.count < 1 || form.count > 100) {
      toast.error("Jumlah harus 1-100");
      return;
    }
    if (form.type === "percent" && (form.value < 1 || form.value > 100)) {
      toast.error("Persen harus 1-100");
      return;
    }
    setSaving(true);
    try {
      const data = await adminFetch<{ created: number; codes: string[] }>(
        "/api/admin/coupons/generate",
        {
          method: "POST",
          body: JSON.stringify({
            prefix: form.prefix.trim().toUpperCase(),
            count: form.count,
            type: form.type,
            value: form.type === "free_shipping" ? 0 : form.value,
            minOrder: form.minOrder,
            maxUsage: form.maxUsage,
            maxPerUser: form.maxPerUser,
            expiresAt: form.expiresAt || null,
            note: form.note.trim() || null,
          }),
        }
      );
      setResult(data);
      toast.success(`${data.created} kupon dibuat`);
    } catch (err: any) {
      toast.error(err.message || "Gagal generate kupon");
    } finally {
      setSaving(false);
    }
  };

  const handleCopyAll = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.codes.join("\n"));
      toast.success(`${result.codes.length} kode disalin ke clipboard`);
    } catch {
      toast.error("Gagal menyalin");
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Batch Generate Kupon</DialogTitle>
          <DialogDescription>
            Buat banyak kupon sekaligus dengan prefix yang sama. Berguna untuk kampanye/marketing.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                ✓ {result.created} kupon berhasil dibuat
              </p>
            </div>
            <div className="max-h-60 overflow-y-auto rounded-lg border bg-secondary/30 p-2">
              <div className="grid grid-cols-2 gap-1">
                {result.codes.map((code) => (
                  <code key={code} className="text-xs font-mono">{code}</code>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handleCopyAll}>
                <Copy className="h-4 w-4 mr-1" />
                Copy Semua
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  window.open(
                    `/api/admin/coupons/export-pdf?ids=${result.codes.length}`,
                    "_blank"
                  );
                }}
                disabled
                title="Gunakan multi-select di list untuk export PDF"
              >
                <FileText className="h-4 w-4 mr-1" />
                Export PDF
              </Button>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setResult(null);
                  onSaved();
                }}
              >
                Tutup
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-3">
                <AdminField label="Prefix" required hint="Contoh: PROMO, WELCOME">
                  <Input
                    value={form.prefix}
                    onChange={(e) => setForm({ ...form, prefix: e.target.value.toUpperCase().slice(0, 10) })}
                    placeholder="PROMO"
                    className="font-mono"
                  />
                </AdminField>
                <AdminField label="Jumlah" required hint="1-100 kupon">
                  <Input
                    type="number"
                    value={form.count}
                    onChange={(e) => setForm({ ...form, count: Number(e.target.value) })}
                    min={1}
                    max={100}
                  />
                </AdminField>
              </div>

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

              <AdminField label="Berakhir" hint="Kosongkan = tanpa batas">
                <Input
                  type="date"
                  value={form.expiresAt}
                  onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                />
              </AdminField>

              <AdminField label="Catatan Internal" hint="Hanya untuk admin">
                <Textarea
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  rows={2}
                  placeholder="Contoh: campaign Lebaran 2026"
                />
              </AdminField>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={saving}>
                Batal
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
                Generate {form.count} Kupon
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// CouponFormDialog — create/edit coupon (existing, unchanged).
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
