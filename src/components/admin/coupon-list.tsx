"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Ticket,
  Copy,
  Share2,
  FileText,
  Trash2,
  Power,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import type { Coupon } from "@/types";

interface CouponListProps {
  coupons: Coupon[];
  loading: boolean;
  onDelete: (id: string) => void;
  onToggleActive: (coupon: Coupon) => void;
  onShare: (coupon: Coupon) => void;
  onPdf: (coupon: Coupon) => void;
  onBatchPdf: (ids: string[]) => void;
}

function formatType(c: Coupon): string {
  if (c.type === "percent") return `${c.value}%`;
  if (c.type === "fixed") return `Rp${c.value.toLocaleString("id-ID")}`;
  return "Gratis Ongkir";
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function CouponList({
  coupons,
  loading,
  onDelete,
  onToggleActive,
  onShare,
  onPdf,
  onBatchPdf,
}: CouponListProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(coupons.map((c) => c.id)));
  };

  const clearSelection = () => setSelected(new Set());

  const handleCopyLink = async (c: Coupon) => {
    const url = `${window.location.origin}/?coupon=${c.code}`;
    await navigator.clipboard.writeText(url);
    toast.success(`Link ${c.code} disalin`);
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    );
  }

  if (coupons.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Ticket className="h-10 w-10 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Belum ada kupon. Klik "Generate" untuk membuat.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Batch actions */}
      {selected.size > 0 && (
        <div className="flex items-center justify-between gap-2 p-2 bg-muted/50 rounded-lg">
          <span className="text-xs">{selected.size} kupon dipilih</span>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => onBatchPdf(Array.from(selected))}
            >
              <FileText className="h-3 w-3 mr-1" /> Export PDF
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={clearSelection}
            >
              Batal
            </Button>
          </div>
        </div>
      )}

      {selected.size === 0 && (
        <div className="flex justify-end">
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={selectAll}>
            Pilih semua
          </Button>
        </div>
      )}

      {/* Coupon cards */}
      <div className="space-y-2">
        {coupons.map((c) => (
          <Card key={c.id} className="p-3">
            <div className="flex items-start gap-3">
              <Checkbox
                checked={selected.has(c.id)}
                onCheckedChange={() => toggleSelect(c.id)}
                className="mt-1"
              />

              <div className="flex-1 min-w-0">
                {/* Code + type */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-bold text-base text-green-700">
                    {c.code}
                  </span>
                  <Badge variant="outline" className="text-[10px] h-5 py-0">
                    {formatType(c)}
                  </Badge>
                  {!c.active && (
                    <Badge variant="secondary" className="text-[10px] h-5 py-0">
                      Nonaktif
                    </Badge>
                  )}
                  {c.batchId && (
                    <Badge variant="outline" className="text-[9px] h-5 py-0 text-muted-foreground">
                      batch
                    </Badge>
                  )}
                </div>

                {c.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                    {c.description}
                  </p>
                )}

                {/* Stats row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 mt-2 text-[10px] text-muted-foreground">
                  <span>
                    📊 Klik: <b className="text-foreground">{c.clickCount}</b>
                  </span>
                  <span>
                    📤 Share: <b className="text-foreground">{c.shareCount}</b>
                  </span>
                  <span>
                    🎯 Pakai: <b className="text-foreground">
                      {c.usedCount}
                      {c.maxUsage > 0 ? `/${c.maxUsage}` : ""}
                    </b>
                  </span>
                  <span>
                    🖨 Cetak: <b className="text-foreground">{c.printedCount}</b>
                  </span>
                </div>

                {/* Meta row */}
                <div className="text-[10px] text-muted-foreground mt-1">
                  Min: Rp{c.minOrder.toLocaleString("id-ID")} ·
                  Exp: {formatDate(c.expiresAt)} ·
                  {c.maxPerUser > 0 ? ` ${c.maxPerUser}×/user` : " unlimited/user"}
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-1 mt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => handleCopyLink(c)}
                  >
                    <Copy className="h-3 w-3 mr-1" /> Copy
                  </Button>
                  <Button
                    size="sm"
                    variant="default"
                    className="h-7 text-xs bg-green-600 hover:bg-green-700"
                    onClick={() => onShare(c)}
                  >
                    <Share2 className="h-3 w-3 mr-1" /> WA
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => onPdf(c)}
                  >
                    <FileText className="h-3 w-3 mr-1" /> PDF
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => onToggleActive(c)}
                    title={c.active ? "Nonaktifkan" : "Aktifkan"}
                  >
                    <Power className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs hover:text-red-500"
                    onClick={() => onDelete(c.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
