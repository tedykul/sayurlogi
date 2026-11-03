"use client";

import { useState, useEffect } from "react";
import { Star, Loader2, CheckCircle2, Clock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ============================================================
// OrderReviewForm — customer submits a review after delivery.
// ============================================================
// Shows one of three states based on the order:
//   1. Order not delivered → prompt to wait
//   2. Already reviewed → status badge (pending/published/rejected)
//   3. Not reviewed + delivered → the form
//
// Sub-ratings (freshness/delivery/packing) are optional.
// ============================================================

interface Review {
  id: string;
  status: "pending" | "published" | "rejected";
  rating: number;
  title: string | null;
  comment: string | null;
  adminReply: string | null;
  createdAt: string;
}

export function OrderReviewForm({
  trackingId,
  orderStatus,
}: {
  trackingId: string;
  orderStatus: string;
}) {
  const [existing, setExisting] = useState<Review | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/orders/${trackingId}/review`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setExisting(data.review ?? null);
      })
      .catch(() => {
        if (!cancelled) setExisting(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [trackingId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Not delivered yet
  if (orderStatus !== "delivered") {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-300">
        <Clock className="h-4 w-4 inline mr-1" />
        Pesanan belum selesai. Anda bisa memberikan review setelah pesanan diterima.
      </div>
    );
  }

  // Already reviewed
  if (existing) {
    return <ExistingReviewView review={existing} />;
  }

  // Form
  return (
    <ReviewForm
      trackingId={trackingId}
      onSubmitted={(r) => setExisting(r)}
    />
  );
}

// ============================================================
// ReviewForm
// ============================================================

function ReviewForm({
  trackingId,
  onSubmitted,
}: {
  trackingId: string;
  onSubmitted: (r: Review) => void;
}) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [freshnessRating, setFreshnessRating] = useState(0);
  const [deliveryRating, setDeliveryRating] = useState(0);
  const [packingRating, setPackingRating] = useState(0);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating < 1 || rating > 5) {
      toast.error("Pilih rating bintang 1-5");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/orders/${trackingId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          title: title.trim() || undefined,
          comment: comment.trim() || undefined,
          freshnessRating: freshnessRating || undefined,
          deliveryRating: deliveryRating || undefined,
          packingRating: packingRating || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Review terkirim! Menunggu moderasi admin.");
        onSubmitted(data.review);
      } else {
        toast.error(data.message || "Gagal kirim review");
      }
    } catch {
      toast.error("Koneksi gagal");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-border/60 p-3">
      <div>
        <h4 className="text-sm font-bold flex items-center gap-1.5">
          <Star className="h-4 w-4 text-amber-500" />
          Beri Review Pesanan
        </h4>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          Bagikan pengalaman belanja Anda. Review akan tampil setelah dimoderasi admin.
        </p>
      </div>

      {/* Overall rating */}
      <div>
        <Label className="text-xs font-medium">Rating Keseluruhan *</Label>
        <div className="mt-1 flex gap-1">
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setRating(s)}
              onMouseEnter={() => setHoverRating(s)}
              onMouseLeave={() => setHoverRating(0)}
              className="p-0.5"
              aria-label={`${s} bintang`}
            >
              <Star
                className={cn(
                  "h-6 w-6 transition-colors",
                  s <= (hoverRating || rating)
                    ? "fill-amber-400 text-amber-400"
                    : "fill-muted text-muted-foreground"
                )}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Sub-ratings */}
      <div className="grid grid-cols-1 gap-2">
        <SubRating label="🥬 Kesegaran" value={freshnessRating} onChange={setFreshnessRating} />
        <SubRating label="🚚 Pengiriman" value={deliveryRating} onChange={setDeliveryRating} />
        <SubRating label="📦 Packing" value={packingRating} onChange={setPackingRating} />
      </div>

      <div>
        <Label className="text-xs font-medium">Judul (opsional)</Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Pelayanan cepat, sayur segar!"
          maxLength={100}
          className="mt-1 h-9"
        />
      </div>

      <div>
        <Label className="text-xs font-medium">Komentar (opsional)</Label>
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Ceritakan pengalaman belanja Anda..."
          rows={3}
          maxLength={500}
          className="mt-1 resize-none"
        />
      </div>

      <Button type="submit" disabled={submitting || rating === 0} size="sm" className="w-full">
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            Mengirim...
          </>
        ) : (
          <>
            <Star className="h-4 w-4 mr-1" />
            Kirim Review
          </>
        )}
      </Button>
    </form>
  );
}

// ============================================================
// SubRating — 5-star row for a sub-category
// ============================================================

function SubRating({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s === value ? 0 : s)}
            onMouseEnter={() => setHover(s)}
            onMouseLeave={() => setHover(0)}
            className="p-0.5"
            aria-label={`${label} ${s} bintang`}
          >
            <Star
              className={cn(
                "h-4 w-4 transition-colors",
                s <= (hover || value)
                  ? "fill-amber-400 text-amber-400"
                  : "fill-muted text-muted-foreground"
              )}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// ExistingReviewView — shown after submit or when review exists
// ============================================================

function ExistingReviewView({ review }: { review: Review }) {
  const statusMeta =
    review.status === "published"
      ? { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-500/10", label: "Dipublikasi" }
      : review.status === "rejected"
      ? { icon: XCircle, color: "text-rose-600", bg: "bg-rose-500/10", label: "Ditolak" }
      : { icon: Clock, color: "text-amber-600", bg: "bg-amber-500/10", label: "Menunggu moderasi" };
  const Icon = statusMeta.icon;

  return (
    <div className="rounded-xl border border-border/60 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold flex items-center gap-1.5">
          <Star className="h-4 w-4 text-amber-500" />
          Review Anda
        </h4>
        <span className={`inline-flex items-center gap-1 rounded-full ${statusMeta.bg} ${statusMeta.color} px-2 py-0.5 text-[10px] font-medium`}>
          <Icon className="h-3 w-3" />
          {statusMeta.label}
        </span>
      </div>
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((s) => (
          <Star
            key={s}
            className={cn(
              "h-3.5 w-3.5",
              s <= review.rating ? "fill-amber-400 text-amber-400" : "fill-muted text-muted-foreground"
            )}
          />
        ))}
      </div>
      {review.title && <p className="text-xs font-semibold">{review.title}</p>}
      {review.comment && <p className="text-xs text-muted-foreground">{review.comment}</p>}
      {review.adminReply && (
        <div className="rounded-lg bg-secondary/50 p-2 text-xs">
          <p className="font-semibold text-[10px] text-muted-foreground">Balasan Admin:</p>
          <p className="mt-0.5">{review.adminReply}</p>
        </div>
      )}
    </div>
  );
}
