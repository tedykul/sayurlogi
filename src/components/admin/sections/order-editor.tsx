"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Loader2, Search, Filter, RefreshCw, Package, Phone, MapPin, Clock, ChevronDown, ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import { adminFetch } from "@/lib/admin-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatIDR } from "@/lib/mock-data";
import {
  ORDER_STATUS_FLOW, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, ORDER_STATUS_ICONS,
  type OrderStatus, type OrderWithItems,
} from "@/lib/orders";
import {
  AdminSectionHeading,
  AdminCard,
  AdminEmptyState,
} from "../admin-ui";
import { Pagination } from "../pagination";

// ============================================================
// OrderEditor — admin order management (list + update status).
// ============================================================

interface OrderListResponse {
  success: boolean;
  orders: OrderWithItems[];
  total: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}

const ORDERS_PER_PAGE = 10;

export function OrderEditor() {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: String(ORDERS_PER_PAGE), page: String(page) });
      if (filterStatus !== "all") params.set("status", filterStatus);
      if (search.trim()) params.set("search", search.trim());
      const res = await adminFetch<OrderListResponse>(`/api/admin/orders?${params}`);
      setOrders(res.orders || []);
      setTotal(res.total || 0);
      setTotalPages(res.totalPages || 1);
    } catch (err: any) {
      setError(err.message || "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }, [filterStatus, search, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset to page 1 when filter or search changes
  const handleFilterChange = (value: string) => {
    setFilterStatus(value);
    setPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleUpdateStatus = async (orderId: string, newStatus: OrderStatus) => {
    setUpdatingId(orderId);
    try {
      const res = await adminFetch<{ success: boolean; order: OrderWithItems }>(
        `/api/admin/orders/${orderId}`,
        {
          method: "PUT",
          body: JSON.stringify({ status: newStatus }),
        }
      );
      setOrders((prev) => prev.map((o) => (o.id === orderId ? res.order : o)));
      toast.success(`Status diubah ke: ${ORDER_STATUS_LABELS[newStatus]}`);
    } catch (err: any) {
      toast.error(err.message || "Gagal update status");
    } finally {
      setUpdatingId(null);
    }
  };

  const toggleExpand = (orderId: string) => {
    setExpandedId((prev) => (prev === orderId ? null : orderId));
  };

  return (
    <div>
      <AdminSectionHeading
        title="📦 Pesanan"
        description="Kelola pesanan customer — update status, lihat detail."
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            className="h-9"
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-1 hidden sm:inline">Refresh</span>
          </Button>
        }
      />

      {/* Stats summary */}
      {!loading && !error && orders.length > 0 && (
        <div className="mb-4 grid grid-cols-4 gap-2">
          <div className="rounded-lg border border-border/60 bg-secondary/30 p-2.5 text-center">
            <p className="text-lg font-bold tabular-nums">{total}</p>
            <p className="text-[10px] text-muted-foreground">Total</p>
          </div>
          {(["pending", "preparing", "out_for_delivery"] as OrderStatus[]).map((s) => (
            <div key={s} className="rounded-lg border border-border/60 bg-secondary/30 p-2.5 text-center">
              <p className="text-lg font-bold tabular-nums">
                {orders.filter((o) => o.status === s).length}
              </p>
              <p className="text-[10px] text-muted-foreground">{ORDER_STATUS_LABELS[s].split(" ")[0]}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-2">
        <Select value={filterStatus} onValueChange={handleFilterChange}>
          <SelectTrigger className="w-[180px] h-9 rounded-lg text-xs">
            <Filter className="h-3.5 w-3.5 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Status</SelectItem>
            {(ORDER_STATUS_FLOW as OrderStatus[]).concat(["cancelled"]).map((s) => (
              <SelectItem key={s} value={s}>
                {ORDER_STATUS_ICONS[s]} {ORDER_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Cari tracking ID, nama, telepon..."
            className="h-9 pl-9 rounded-lg text-xs"
          />
        </div>
      </div>

      {/* Error state */}
      {error && (
        <AdminCard className="border-destructive/40 bg-destructive/5">
          <p className="text-sm text-destructive">{error}</p>
        </AdminCard>
      )}

      {/* Loading state */}
      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl border border-border/60 bg-card animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && orders.length === 0 && (
        <AdminEmptyState
          icon={<Package className="h-8 w-8" />}
          title="Belum ada pesanan"
          description="Pesanan yang masuk akan muncul di sini."
        />
      )}

      {/* Order list */}
      {orders.length > 0 && (
        <div className="space-y-2">
          <AnimatePresence>
            {orders.map((order, i) => (
              <motion.div
                key={order.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2, delay: Math.min(i * 0.02, 0.3) }}
              >
                <AdminCard className="py-3">
                  {/* Header row */}
                  <div className="flex items-center gap-3">
                    {/* Expand toggle */}
                    <button
                      onClick={() => toggleExpand(order.id)}
                      className="text-muted-foreground hover:text-foreground shrink-0"
                      aria-label={expandedId === order.id ? "Tutup detail" : "Buka detail"}
                    >
                      {expandedId === order.id ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>

                    {/* Tracking ID + customer */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <code className="text-sm font-mono font-bold text-primary">
                          {order.trackingId}
                        </code>
                        <Badge className={cn("text-[10px] font-medium", ORDER_STATUS_COLORS[order.status])}>
                          {ORDER_STATUS_ICONS[order.status]} {ORDER_STATUS_LABELS[order.status]}
                        </Badge>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                        <span>{order.customerName}</span>
                        <span>· {order.items.length} item</span>
                        <span>· {formatIDR(order.total)}</span>
                        <span>· {new Date(order.createdAt).toLocaleString("id-ID", {
                          day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                        })}</span>
                      </div>
                    </div>

                    {/* Quick status update */}
                    <Select
                      value={order.status}
                      onValueChange={(v) => handleUpdateStatus(order.id, v as OrderStatus)}
                      disabled={updatingId === order.id}
                    >
                      <SelectTrigger className="w-[140px] h-8 rounded-lg text-xs shrink-0">
                        {updatingId === order.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <SelectValue />
                        )}
                      </SelectTrigger>
                      <SelectContent>
                        {(ORDER_STATUS_FLOW as OrderStatus[]).concat(["cancelled"]).map((s) => (
                          <SelectItem key={s} value={s}>
                            {ORDER_STATUS_ICONS[s]} {ORDER_STATUS_LABELS[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Expanded details */}
                  <AnimatePresence>
                    {expandedId === order.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-3 pt-3 border-t border-border/60 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                          {/* Customer info */}
                          <div className="space-y-1.5">
                            <p className="font-semibold text-foreground">Info Customer</p>
                            <p className="flex items-center gap-1.5 text-muted-foreground">
                              <span className="font-medium text-foreground">{order.customerName}</span>
                            </p>
                            <p className="flex items-center gap-1.5 text-muted-foreground">
                              <Phone className="h-3 w-3" /> {order.customerPhone}
                            </p>
                            {order.customerEmail && (
                              <p className="text-muted-foreground">📧 {order.customerEmail}</p>
                            )}
                            <p className="flex items-start gap-1.5 text-muted-foreground">
                              <MapPin className="h-3 w-3 mt-0.5 shrink-0" /> {order.customerAddress}
                              {order.customerCity && `, ${order.customerCity}`}
                            </p>
                            {order.customerNotes && (
                              <p className="text-muted-foreground italic">📝 {order.customerNotes}</p>
                            )}
                          </div>

                          {/* Order details */}
                          <div className="space-y-1.5">
                            <p className="font-semibold text-foreground">Detail Pesanan</p>
                            <div className="space-y-1 max-h-32 overflow-y-auto scrollbar-grocery">
                              {order.items.map((item, idx) => (
                                <div key={idx} className="flex justify-between">
                                  <span className="text-muted-foreground">
                                    {item.product.emoji} {item.product.name} × {item.quantity}
                                  </span>
                                  <span className="font-medium">{formatIDR(item.product.price * item.quantity)}</span>
                                </div>
                              ))}
                            </div>
                            <div className="pt-1 border-t border-border/40 space-y-0.5">
                              <div className="flex justify-between text-muted-foreground">
                                <span>Subtotal</span>
                                <span>{formatIDR(order.subtotal)}</span>
                              </div>
                              <div className="flex justify-between text-muted-foreground">
                                <span>Ongkir ({order.deliveryMethod})</span>
                                <span>{order.shipping === 0 ? "GRATIS" : formatIDR(order.shipping)}</span>
                              </div>
                              <div className="flex justify-between font-bold">
                                <span>Total</span>
                                <span className="text-primary">{formatIDR(order.total)}</span>
                              </div>
                              <p className="text-[10px] text-muted-foreground pt-1">
                                💳 {order.paymentMethod.toUpperCase()}
                                {order.erpSalesOrderName && ` · ERP: ${order.erpSalesOrderName}`}
                              </p>
                            </div>
                          </div>

                          {/* Status history */}
                          <div className="md:col-span-2">
                            <p className="font-semibold text-foreground mb-1.5">Riwayat Status</p>
                            <div className="space-y-1">
                              {order.statusHistory.map((h, idx) => (
                                <div key={idx} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  <span className="font-medium">{ORDER_STATUS_LABELS[h.status]}</span>
                                  <span>·</span>
                                  <span>{new Date(h.timestamp).toLocaleString("id-ID", {
                                    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                                  })}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </AdminCard>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Pagination */}
      {!loading && !error && total > 0 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          limit={ORDERS_PER_PAGE}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
