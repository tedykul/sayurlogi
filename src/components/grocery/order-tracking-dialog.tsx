"use client";

import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Search, Loader2, Package, CheckCircle2, XCircle, Truck, Clock, MapPin, Phone, Mail,
  AlertCircle, Copy,
} from "lucide-react";
import { motion } from "framer-motion";
import { formatIDR } from "@/lib/mock-data";
import {
  ORDER_STATUS_FLOW, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, ORDER_STATUS_ICONS,
  type OrderStatus, type OrderWithItems,
} from "@/lib/orders";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { OrderReviewForm } from "./order-review-form";

interface OrderTrackingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional: pre-fill tracking ID (e.g., from checkout success) */
  initialTrackingId?: string;
}

export function OrderTrackingDialog({ open, onOpenChange, initialTrackingId }: OrderTrackingDialogProps) {
  const [trackingId, setTrackingId] = useState("");
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<OrderWithItems | null>(null);
  const [error, setError] = useState("");

  // Pre-fill tracking ID if provided (e.g., from checkout success)
  useEffect(() => {
    if (initialTrackingId && open) {
      setTrackingId(initialTrackingId);
      // Auto-search
      handleSearch(initialTrackingId);
    }
  }, [initialTrackingId, open]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setOrder(null);
      setError("");
      if (!initialTrackingId) setTrackingId("");
    }
  }, [open, initialTrackingId]);

  const handleSearch = async (id?: string) => {
    const query = (id || trackingId).trim().toUpperCase();
    if (!query || query.length < 4) {
      setError("Tracking ID minimal 4 karakter");
      return;
    }
    setLoading(true);
    setError("");
    setOrder(null);
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.success) {
        setOrder(data.order);
      } else {
        setError(data.message || "Pesanan tidak ditemukan");
      }
    } catch {
      setError("Koneksi gagal. Coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyTracking = () => {
    if (order) {
      navigator.clipboard.writeText(order.trackingId);
      toast.success("Tracking ID disalin!");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto scrollbar-grocery sm:max-w-lg">
        <DialogDescription className="sr-only">
          Lacak pesanan SayurLogi berdasarkan tracking ID
        </DialogDescription>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Lacak Pesanan
          </DialogTitle>
        </DialogHeader>

        {/* Search form */}
        <div className="space-y-2">
          <Label htmlFor="tracking-id" className="text-xs font-medium text-muted-foreground">
            Tracking ID
          </Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="tracking-id"
                value={trackingId}
                onChange={(e) => {
                  setTrackingId(e.target.value.toUpperCase());
                  if (error) setError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="SBXXXX"
                className="pl-9 font-mono uppercase"
                disabled={loading}
                maxLength={10}
              />
            </div>
            <Button onClick={() => handleSearch()} disabled={loading || !trackingId.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Lacak"}
            </Button>
          </div>
          {error && (
            <p className="flex items-center gap-1 text-xs text-destructive" role="alert">
              <AlertCircle className="h-3 w-3" />
              {error}
            </p>
          )}
          <p className="text-[10px] text-muted-foreground">
            💡 Tracking ID ada di email/konfirmasi pesanan kamu (format: SBXXXX, contoh: SB3X9K)
          </p>
        </div>

        {/* Order result */}
        {order && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            <Separator />

            {/* Tracking ID + status badge */}
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-medium uppercase text-muted-foreground">Tracking ID</p>
                <div className="flex items-center gap-2">
                  <code className="text-lg font-mono font-bold text-primary">{order.trackingId}</code>
                  <button
                    onClick={handleCopyTracking}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Salin tracking ID"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <Badge className={cn("text-xs font-medium", ORDER_STATUS_COLORS[order.status])}>
                {ORDER_STATUS_ICONS[order.status]} {ORDER_STATUS_LABELS[order.status]}
              </Badge>
            </div>

            {/* Status timeline */}
            <div className="rounded-xl border border-border/60 bg-secondary/30 p-4">
              <p className="mb-3 text-xs font-semibold">Progress Pesanan</p>
              <div className="space-y-2.5">
                {ORDER_STATUS_FLOW.map((status, i) => {
                  const currentIndex = ORDER_STATUS_FLOW.indexOf(order.status as OrderStatus);
                  const isDone = i <= currentIndex && order.status !== "cancelled";
                  const isCurrent = i === currentIndex && order.status !== "cancelled";
                  const isCancelled = order.status === "cancelled";

                  return (
                    <div key={status} className="flex items-center gap-3">
                      <div
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs",
                          isDone && !isCancelled && "bg-primary text-primary-foreground",
                          isCurrent && "ring-4 ring-primary/20",
                          !isDone || isCancelled ? "bg-muted text-muted-foreground" : ""
                        )}
                      >
                        {isDone && !isCurrent ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : isCurrent ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          ORDER_STATUS_ICONS[status]
                        )}
                      </div>
                      <div className="flex-1">
                        <p className={cn(
                          "text-xs font-medium",
                          isDone && !isCancelled ? "text-foreground" : "text-muted-foreground"
                        )}>
                          {ORDER_STATUS_LABELS[status]}
                        </p>
                        {isCurrent && order.statusHistory[i] && (
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(order.statusHistory[i].timestamp).toLocaleString("id-ID", {
                              day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                            })}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
                {order.status === "cancelled" && (
                  <div className="flex items-center gap-3 pt-2 border-t border-border">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-500 text-white">
                      <XCircle className="h-4 w-4" />
                    </div>
                    <p className="text-xs font-medium text-rose-600">
                      Pesanan Dibatalkan
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Customer info */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="flex items-start gap-2">
                <Phone className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">{order.customerName}</p>
                  <p className="text-muted-foreground">{order.customerPhone}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">Alamat</p>
                  <p className="text-muted-foreground line-clamp-2">{order.customerAddress}</p>
                </div>
              </div>
            </div>

            {/* Order items */}
            <div className="rounded-xl border border-border/60 p-3">
              <p className="mb-2 text-xs font-semibold">Item Pesanan ({order.items.length})</p>
              <div className="space-y-1.5 max-h-32 overflow-y-auto scrollbar-grocery">
                {order.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">
                      {item.product.emoji} {item.product.name} × {item.quantity}
                    </span>
                    <span className="font-medium">{formatIDR(item.product.price * item.quantity)}</span>
                  </div>
                ))}
              </div>
              <Separator className="my-2" />
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{formatIDR(order.subtotal)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Ongkir</span>
                  <span>{order.shipping === 0 ? "GRATIS" : formatIDR(order.shipping)}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Total</span>
                  <span className="text-primary">{formatIDR(order.total)}</span>
                </div>
              </div>
            </div>

            {/* Estimated delivery */}
            {order.estimatedDelivery && order.status !== "delivered" && order.status !== "cancelled" && (
              <div className="flex items-center gap-2 rounded-lg bg-primary/5 p-3 text-xs">
                <Truck className="h-4 w-4 text-primary shrink-0" />
                <div>
                  <p className="font-medium text-primary">Estimasi {order.deliveryMethod === "delivery" ? "Tiba" : "Siap Diambil"}</p>
                  <p className="text-muted-foreground">
                    {new Date(order.estimatedDelivery).toLocaleString("id-ID", {
                      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                    })} WIB
                  </p>
                </div>
              </div>
            )}

            {/* Delivery slot (if selected at checkout) */}
            {order.deliverySlotLabel && (
              <div className="flex items-center gap-2 rounded-lg bg-cyan-500/5 p-3 text-xs ring-1 ring-cyan-500/20">
                <Clock className="h-4 w-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
                <div>
                  <p className="font-medium text-cyan-700 dark:text-cyan-300">Slot Pengiriman</p>
                  <p className="text-muted-foreground">{order.deliverySlotLabel}</p>
                </div>
              </div>
            )}

            {/* Review form (only for delivered orders) */}
            {order.status !== "cancelled" && (
              <OrderReviewForm trackingId={order.trackingId} orderStatus={order.status} />
            )}
          </motion.div>
        )}
      </DialogContent>
    </Dialog>
  );
}
