"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Star, Check, X, MessageSquareReply } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { motion, AnimatePresence } from "framer-motion";
import { adminFetch } from "@/lib/admin-client";
import { toast } from "sonner";
import {
  AdminSectionHeading,
  AdminEmptyState,
} from "../admin-ui";

// ============================================================
// ReviewEditor — moderate customer reviews (admin).
// ============================================================

type ReviewStatus = "pending" | "published" | "rejected";

interface Review {
  id: string;
  orderId: string;
  trackingId: string;
  customerName: string;
  rating: number;
  freshnessRating: number | null;
  deliveryRating: number | null;
  packingRating: number | null;
  title: string | null;
  comment: string | null;
  status: ReviewStatus;
  adminReply: string | null;
  createdAt: string;
  publishedAt: string | null;
}

interface ReviewsResponse {
  reviews: Review[];
  counts: Record<string, number>;
}

const STATUS_TABS: { id: "all" | ReviewStatus; label: string }[] = [
  { id: "all", label: "Semua" },
  { id: "pending", label: "Menunggu" },
  { id: "published", label: "Dipublikasi" },
  { id: "rejected", label: "Ditolak" },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ReviewEditor() {
  const [filter, setFilter] = useState<"all" | ReviewStatus>("pending");
  const [data, setData] = useState<ReviewsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [replying, setReplying] = useState<Review | null>(null);

  const url = `/api/admin/reviews${filter !== "all" ? `?status=${filter}` : ""}`;

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch<{ success: boolean; reviews: Review[]; counts: Record<string, number> }>(url);
      setData({ reviews: res.reviews ?? [], counts: res.counts ?? {} });
    } catch (err: any) {
      toast.error(err.message || "Gagal memuat review");
      setData({ reviews: [], counts: {} });
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const reviews = data?.reviews ?? [];
  const counts = data?.counts ?? {};

  return (
    <div>
      <AdminSectionHeading
        title="Review Pelanggan"
        description="Moderasi review per-order. Publish untuk tampil di storefront, reject untuk sembunyikan."
      />

      {/* Filter tabs */}
      <div className="mb-4 flex gap-1 border-b border-border">
        {STATUS_TABS.map((tab) => {
          const count = tab.id === "all" ? Object.values(counts).reduce((s, c) => s + c, 0) : counts[tab.id] ?? 0;
          const active = filter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`relative px-3 py-2 text-xs font-medium transition-colors ${
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
              <span className="ml-1.5 rounded bg-secondary px-1.5 py-0.5 text-[10px]">
                {count}
              </span>
              {active && (
                <div className="absolute inset-x-0 -bottom-px h-0.5 bg-primary" />
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : reviews.length === 0 ? (
        <AdminEmptyState
          icon={<Star className="h-8 w-8" />}
          title="Tidak ada review"
          description={filter === "pending" ? "Tidak ada review menunggu moderasi." : "Belum ada review dengan status ini."}
        />
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {reviews.map((r) => (
              <ReviewRow key={r.id} review={r} onReply={() => setReplying(r)} onModerated={refetch} />
            ))}
          </AnimatePresence>
        </div>
      )}

      {replying && (
        <ReplyDialog
          review={replying}
          onClose={() => setReplying(null)}
          onSaved={() => {
            setReplying(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// ReviewRow
// ============================================================

function ReviewRow({
  review,
  onReply,
  onModerated,
}: {
  review: Review;
  onReply: () => void;
  onModerated: () => void;
}) {
  const statusColor =
    review.status === "published"
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
      : review.status === "rejected"
      ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
      : "bg-amber-500/15 text-amber-700 dark:text-amber-300";
  const statusLabel =
    review.status === "published" ? "Dipublikasi" : review.status === "rejected" ? "Ditolak" : "Menunggu";

  const handleModerate = async (status: ReviewStatus) => {
    try {
      await adminFetch(`/api/admin/reviews/${review.id}`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
      toast.success(status === "published" ? "Review dipublikasi" : "Review ditolak");
      onModerated();
    } catch (err: any) {
      toast.error(err.message || "Gagal moderasi");
    }
  };

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
            <span className="text-sm font-bold">{review.customerName}</span>
            <code className="text-[10px] font-mono text-muted-foreground">#{review.trackingId}</code>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${statusColor}`}>
              {statusLabel}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                className={`h-3 w-3 ${
                  s <= review.rating
                    ? "fill-amber-400 text-amber-400"
                    : "fill-muted text-muted"
                }`}
              />
            ))}
            <span className="ml-1 text-[10px] text-muted-foreground">{review.rating}.0</span>
          </div>
          {review.title && <p className="mt-1.5 text-xs font-semibold">{review.title}</p>}
          {review.comment && <p className="mt-0.5 text-xs text-muted-foreground">{review.comment}</p>}
          <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
            {review.freshnessRating && <span>🥬 Kesegaran: {review.freshnessRating}/5</span>}
            {review.deliveryRating && <span>🚚 Pengiriman: {review.deliveryRating}/5</span>}
            {review.packingRating && <span>📦 Packing: {review.packingRating}/5</span>}
          </div>
          {review.adminReply && (
            <div className="mt-2 rounded-lg bg-secondary/50 p-2 text-xs">
              <p className="font-semibold text-[10px] text-muted-foreground">Balasan Admin:</p>
              <p className="mt-0.5">{review.adminReply}</p>
            </div>
          )}
          <p className="mt-1.5 text-[10px] text-muted-foreground">{formatDate(review.createdAt)}</p>
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          {review.status !== "published" && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-[11px] text-emerald-600 hover:bg-emerald-500/10"
              onClick={() => handleModerate("published")}
            >
              <Check className="h-3 w-3 mr-1" />
              Publish
            </Button>
          )}
          {review.status !== "rejected" && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-[11px] text-rose-600 hover:bg-rose-500/10"
              onClick={() => handleModerate("rejected")}
            >
              <X className="h-3 w-3 mr-1" />
              Tolak
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-[11px]"
            onClick={onReply}
          >
            <MessageSquareReply className="h-3 w-3 mr-1" />
            Balas
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================
// ReplyDialog — set/publish with admin reply
// ============================================================

function ReplyDialog({
  review,
  onClose,
  onSaved,
}: {
  review: Review;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [reply, setReply] = useState(review.adminReply ?? "");
  const [status, setStatus] = useState<ReviewStatus>(review.status);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await adminFetch(`/api/admin/reviews/${review.id}`, {
        method: "PUT",
        body: JSON.stringify({ status, adminReply: reply.trim() || null }),
      });
      toast.success("Review diupdate");
      onSaved();
    } catch (err: any) {
      toast.error(err.message || "Gagal simpan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Moderasi Review</DialogTitle>
          <DialogDescription>
            {review.customerName} · #{review.trackingId} · {review.rating}/5 ★
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {review.comment && (
            <div className="rounded-lg bg-secondary/50 p-2.5 text-xs">
              {review.comment}
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Status</label>
            <Select value={status} onValueChange={(v) => setStatus(v as ReviewStatus)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Menunggu</SelectItem>
                <SelectItem value="published">Dipublikasi</SelectItem>
                <SelectItem value="rejected">Ditolak</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Balasan Admin (opsional)</label>
            <Textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={3}
              placeholder="Terima kasih atas review Anda..."
              className="mt-1"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Batal
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
