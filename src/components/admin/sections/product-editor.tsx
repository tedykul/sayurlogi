"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  Loader2, Search, Filter, RefreshCw, Plus, Pencil, Trash2, Eye, EyeOff,
  Package, AlertCircle, Upload, X, CheckSquare, Square, ChevronDown,
  ChevronUp, Tag, Copy, RefreshCcw, Sparkles, Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import { adminFetch } from "@/lib/admin-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatIDR } from "@/lib/mock-data";
import {
  AdminSectionHeading,
  AdminField,
  AdminCard,
  AdminEmptyState,
  DeleteButton,
} from "../admin-ui";
import { Pagination } from "../pagination";

const PRODUCTS_PER_PAGE = 10;

// ============================================================
// ProductEditor — WooCommerce-style product management.
// ============================================================
// Features:
//   - List products with search, category filter, bulk select +
//     bulk publish/unpublish/delete.
//   - Inline form (create/edit) with all fields: itemCode, name,
//     description, longDescription, category, price, oldPrice,
//     unit, stock, emoji, image, organic, onSale, tags, benefits,
//     storageTip, origin, published, order.
//   - Emoji picker + image upload preview.
//   - Variant management (add/edit/remove inline).
//   - ERPNext sync button + sync status card.
//
// API routes used (adminFetch auto-attaches Bearer token):
//   GET    /api/admin/products            → list
//   POST   /api/admin/products            → create
//   PUT    /api/admin/products/[id]       → update
//   DELETE /api/admin/products/[id]       → delete
//   POST   /api/admin/products/bulk       → bulk actions
//   POST   /api/admin/products/upload     → image upload (multipart)
//   GET/PUT/POST/DELETE /api/admin/products/[id]/variants → variants
//   POST   /api/admin/products/sync       → ERPNext sync trigger
// ============================================================

interface Variant {
  id?: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
}

interface Product {
  id: string;
  itemCode: string;
  name: string;
  description: string;
  longDescription?: string;
  category: string;
  price: number;
  oldPrice?: number | null;
  unit: string;
  stock: number;
  emoji: string;
  image?: string | null;
  organic?: boolean;
  onSale?: boolean;
  tags?: string[];
  benefits?: string[];
  storageTip?: string;
  origin?: string;
  published?: boolean;
  order?: number;
  variants?: Variant[];
  erpSyncedAt?: string | null;
}

interface SyncStatus {
  lastSyncAt: string | null;
  source: "erpnext" | "mock" | "unknown";
  totalProducts: number;
  syncedProducts: number;
}

const EMOJI_CHOICES = [
  "🥬", "🍎", "🌿", "🧺", "🥕", "🌽", "🍇", "🥦", "🍅", "🍊", "🍋", "🍆",
  "🍌", "🥑", "🥒", "🫐", "🍓", "🍈", "🍑", "🍐", "🥭", "🍍", "🥥", "🧄",
  "🧅", "🥔", "🍠", "🌶️", "🫑", "🥬", "🥬",
];

const UNITS = ["kg", "ikat", "pcs", "bungkus", "gram", "liter", "papan", "pack"];

const CATEGORIES = ["Sayuran", "Buah", "Herbal", "Paket", "Bumbu", "Lainnya"];

const DEFAULT_FORM: ProductFormData = {
  itemCode: "",
  name: "",
  description: "",
  longDescription: "",
  category: "Sayuran",
  price: 0,
  oldPrice: "",
  unit: "kg",
  stock: 0,
  emoji: "🥬",
  image: "",
  organic: false,
  onSale: false,
  tags: "",
  benefits: "",
  storageTip: "",
  origin: "",
  published: true,
  order: 0,
  variants: [],
};

interface ProductFormData {
  itemCode: string;
  name: string;
  description: string;
  longDescription: string;
  category: string;
  price: number;
  oldPrice: string;
  unit: string;
  stock: number;
  emoji: string;
  image: string;
  organic: boolean;
  onSale: boolean;
  tags: string;
  benefits: string;
  storageTip: string;
  origin: string;
  published: boolean;
  order: number;
  variants: Variant[];
}

export function ProductEditor() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterPublished, setFilterPublished] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [page, setPage] = useState(1);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminFetch<{ success: boolean; products: Product[] }>(
        "/api/admin/products"
      );
      setProducts(res.products || []);
    } catch (err: any) {
      setError(err.message || "Gagal memuat produk");
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSyncStatus = useCallback(async () => {
    try {
      const res = await adminFetch<{ success: boolean; status: SyncStatus }>(
        "/api/admin/products/sync"
      );
      setSyncStatus(res.status);
    } catch {
      // Endpoint may not be configured — silently ignore
    }
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchSyncStatus();
  }, [fetchProducts, fetchSyncStatus]);

  // Filtered list (client-side search + filters)
  const filtered = useMemo(() => {
    let list = products;
    if (filterCategory !== "all") {
      list = list.filter((p) => p.category === filterCategory);
    }
    if (filterPublished === "published") {
      list = list.filter((p) => p.published);
    } else if (filterPublished === "unpublished") {
      list = list.filter((p) => !p.published);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.itemCode.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          (p.tags || []).some((t) => t.toLowerCase().includes(q))
      );
    }
    return list;
  }, [products, filterCategory, filterPublished, search]);

  // Paginated slice of filtered results (client-side pagination)
  const totalFiltered = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / PRODUCTS_PER_PAGE));
  // Clamp page if filtered results shrink (e.g. after filter change)
  const currentPage = Math.min(page, totalPages);
  const paginatedFiltered = useMemo(() => {
    const start = (currentPage - 1) * PRODUCTS_PER_PAGE;
    return filtered.slice(start, start + PRODUCTS_PER_PAGE);
  }, [filtered, currentPage]);

  // Reset page to 1 when filter/search changes
  useEffect(() => {
    setPage(1);
  }, [filterCategory, filterPublished, search]);

  // Dynamic category list — derived from actual products in DB.
  // This ensures the filter dropdown always matches real data (e.g.
  // "Bumbu dapur", "Makanan Beku" from ERPNext sync), instead of a
  // hardcoded list that may drift out of sync.
  const categoryOptions = useMemo(() => {
    const cats = new Set<string>();
    products.forEach((p) => {
      if (p.category) cats.add(p.category);
    });
    return Array.from(cats).sort();
  }, [products]);

  // Count per category (for badge display in dropdown)
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    products.forEach((p) => {
      if (p.category) {
        counts[p.category] = (counts[p.category] || 0) + 1;
      }
    });
    return counts;
  }, [products]);

  // Count per publish status (for badge display in dropdown)
  const statusCounts = useMemo(() => {
    let published = 0;
    let unpublished = 0;
    products.forEach((p) => {
      if (p.published) published++;
      else unpublished++;
    });
    return { published, unpublished, total: products.length };
  }, [products]);

  const allFilteredSelected =
    paginatedFiltered.length > 0 && paginatedFiltered.every((p) => selected.has(p.id));

  const toggleSelectAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        paginatedFiltered.forEach((p) => next.delete(p.id));
      } else {
        paginatedFiltered.forEach((p) => next.add(p.id));
      }
      return next;
    });
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDelete = async (id: string) => {
    try {
      await adminFetch(`/api/admin/products/${id}`, { method: "DELETE" });
      setProducts((prev) => prev.filter((p) => p.id !== id));
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (err: any) {
      toast.error(err.message || "Gagal menghapus produk");
    }
  };

  const handleTogglePublish = async (p: Product) => {
    try {
      await adminFetch(`/api/admin/products/${p.id}`, {
        method: "PUT",
        body: JSON.stringify({ published: !p.published }),
      });
      setProducts((prev) =>
        prev.map((x) => (x.id === p.id ? { ...x, published: !x.published } : x))
      );
      toast.success(p.published ? "Disembunyikan" : "Dipublikasi");
    } catch (err: any) {
      toast.error(err.message || "Gagal update status");
    }
  };

  const handleDuplicate = async (p: Product) => {
    try {
      const { id, ...rest } = p;
      void id;
      await adminFetch("/api/admin/products", {
        method: "POST",
        body: JSON.stringify({
          ...rest,
          itemCode: `${p.itemCode}-copy`,
          name: `${p.name} (salinan)`,
          published: false,
        }),
      });
      toast.success("Produk diduplikat");
      fetchProducts();
    } catch (err: any) {
      toast.error(err.message || "Gagal menduplikat");
    }
  };

  const handleBulkAction = async (action: "publish" | "unpublish" | "delete") => {
    if (selected.size === 0) {
      toast.error("Pilih produk dulu");
      return;
    }
    setBulkBusy(true);
    try {
      await adminFetch("/api/admin/products/bulk", {
        method: "POST",
        body: JSON.stringify({ ids: Array.from(selected), action }),
      });
      toast.success(
        action === "delete"
          ? `${selected.size} produk dihapus`
          : action === "publish"
          ? `${selected.size} produk dipublikasi`
          : `${selected.size} produk disembunyikan`
      );
      setSelected(new Set());
      fetchProducts();
    } catch (err: any) {
      toast.error(err.message || "Gagal eksekusi bulk action");
    } finally {
      setBulkBusy(false);
    }
  };

  const handleSyncErp = async () => {
    setSyncing(true);
    try {
      const res = await adminFetch<{ success: boolean; status: SyncStatus; message?: string }>(
        "/api/admin/products/sync",
        { method: "POST" }
      );
      setSyncStatus(res.status);
      toast.success(res.message || "Sinkron ERPNext selesai");
      fetchProducts();
    } catch (err: any) {
      toast.error(err.message || "Gagal sinkron ERPNext");
    } finally {
      setSyncing(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div>
      <AdminSectionHeading
        title="🛒 Produk"
        description="Kelola produk — tambah, edit, duplikat, sinkron ERPNext."
        action={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncErp}
              disabled={syncing}
              className="h-9"
              title="Sinkron dari ERPNext"
            >
              {syncing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="h-4 w-4" />
              )}
              <span className="ml-1 hidden sm:inline">Sync ERPNext</span>
            </Button>
            <Button
              size="sm"
              onClick={() => setCreating(true)}
              className="h-9"
            >
              <Plus className="h-4 w-4 mr-1" />
              Tambah
            </Button>
          </div>
        }
      />

      {/* ERPNext sync status card */}
      {syncStatus && (
        <AdminCard className="mb-4 flex items-center gap-3 py-3">
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
              syncStatus.source === "erpnext"
                ? "bg-emerald-500/15 text-emerald-600"
                : "bg-amber-500/15 text-amber-600"
            )}
          >
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold">ERPNext Sync</p>
              <Badge
                variant="secondary"
                className={cn(
                  "text-[9px]",
                  syncStatus.source === "erpnext"
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                    : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                )}
              >
                {syncStatus.source === "erpnext" ? "Live" : "Mock"}
              </Badge>
            </div>
            <p className="text-[10px] text-muted-foreground">
              {syncStatus.syncedProducts} / {syncStatus.totalProducts} produk tersinkron
              {syncStatus.lastSyncAt &&
                ` · ${new Date(syncStatus.lastSyncAt).toLocaleString("id-ID", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}`}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncErp}
            disabled={syncing}
            className="h-8 text-xs"
          >
            {syncing ? "Syncing..." : "Sync"
            }
          </Button>
        </AdminCard>
      )}

      {/* Filters + bulk actions */}
      <div className="mb-3 flex flex-wrap gap-2">
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[160px] h-9 rounded-lg text-xs">
            <Filter className="h-3.5 w-3.5 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              Semua Kategori ({statusCounts.total})
            </SelectItem>
            {categoryOptions.map((c) => (
              <SelectItem key={c} value={c}>
                {c} ({categoryCounts[c] || 0})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterPublished} onValueChange={setFilterPublished}>
          <SelectTrigger className="w-[160px] h-9 rounded-lg text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              Semua Status ({statusCounts.total})
            </SelectItem>
            <SelectItem value="published">
              Published ({statusCounts.published})
            </SelectItem>
            <SelectItem value="unpublished">
              Hidden ({statusCounts.unpublished})
            </SelectItem>
          </SelectContent>
        </Select>

        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama, kode, deskripsi, tag..."
            className="h-9 pl-9 rounded-lg text-xs"
          />
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchProducts}
          disabled={loading}
          className="h-9"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Bulk action toolbar */}
      {selected.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 p-2">
          <span className="text-xs font-medium">
            {selected.size} produk dipilih
          </span>
          <div className="ml-auto flex gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleBulkAction("publish")}
              disabled={bulkBusy}
              className="h-7 text-xs"
            >
              Publish
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleBulkAction("unpublish")}
              disabled={bulkBusy}
              className="h-7 text-xs"
            >
              Hide
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => handleBulkAction("delete")}
              disabled={bulkBusy}
              className="h-7 text-xs"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Hapus
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelected(new Set())}
              className="h-7 text-xs"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <AdminCard className="mb-3 border-destructive/40 bg-destructive/5">
          <p className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {error}
          </p>
        </AdminCard>
      )}

      {/* Create form */}
      {creating && (
        <ProductForm
          initial={DEFAULT_FORM}
          isNew
          onSave={async (data) => {
            await adminFetch("/api/admin/products", {
              method: "POST",
              body: JSON.stringify(data),
            });
            toast.success("Produk ditambahkan");
            setCreating(false);
            fetchProducts();
          }}
          onCancel={() => setCreating(false)}
        />
      )}

      {/* Loading state */}
      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl border border-border/60 bg-card animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && !creating && (
        <AdminEmptyState
          icon={<Package className="h-8 w-8" />}
          title="Belum ada produk"
          description="Tambahkan produk pertama atau sinkron dari ERPNext."
          action={
            <Button size="sm" onClick={() => setCreating(true)} className="h-9">
              <Plus className="h-4 w-4 mr-1" />
              Tambah Produk
            </Button>
          }
        />
      )}

      {/* Product list */}
      {filtered.length > 0 && (
        <div className="space-y-2">
          {/* Select-all row */}
          <div className="flex items-center gap-2 px-1 text-[11px] text-muted-foreground">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-1 hover:text-foreground"
              aria-label="Pilih semua"
            >
              {allFilteredSelected ? (
                <CheckSquare className="h-3.5 w-3.5" />
              ) : (
                <Square className="h-3.5 w-3.5" />
              )}
              Pilih semua ({paginatedFiltered.length} di halaman ini)
            </button>
          </div>

          <AnimatePresence>
            {paginatedFiltered.map((p, i) => (
              <motion.div
                key={p.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2, delay: Math.min(i * 0.02, 0.3) }}
              >
                {editing?.id === p.id ? (
                  <ProductForm
                    initial={productToForm(editing)}
                    onSave={async (data) => {
                      await adminFetch(`/api/admin/products/${p.id}`, {
                        method: "PUT",
                        body: JSON.stringify(data),
                      });
                      toast.success("Produk diupdate");
                      setEditing(null);
                      fetchProducts();
                    }}
                    onCancel={() => setEditing(null)}
                  />
                ) : (
                  <AdminCard className="py-3">
                    {/* Row */}
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => toggleSelect(p.id)}
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                        aria-label={`Pilih ${p.name}`}
                      >
                        {selected.has(p.id) ? (
                          <CheckSquare className="h-4 w-4 text-primary" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </button>

                      <button
                        onClick={() => toggleExpand(p.id)}
                        className="text-muted-foreground hover:text-foreground shrink-0"
                        aria-label={expandedId === p.id ? "Tutup detail" : "Buka detail"}
                      >
                        {expandedId === p.id ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>

                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-lg">
                        {p.emoji || "📦"}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-semibold truncate">{p.name}</h3>
                          <Badge
                            variant={p.published ? "default" : "secondary"}
                            className="text-[9px]"
                          >
                            {p.published ? "Live" : "Hidden"}
                          </Badge>
                          {p.organic && (
                            <Badge variant="secondary" className="text-[9px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                              Organic
                            </Badge>
                          )}
                          {p.onSale && (
                            <Badge variant="secondary" className="text-[9px] bg-rose-500/15 text-rose-700 dark:text-rose-300">
                              Sale
                            </Badge>
                          )}
                          {p.variants && p.variants.length > 0 && (
                            <Badge variant="outline" className="text-[9px]">
                              {p.variants.length} varian
                            </Badge>
                          )}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                          <code className="font-mono">{p.itemCode}</code>
                          <span>· {p.category}</span>
                          <span>· {formatIDR(p.price)}/{p.unit}</span>
                          <span>· stok: {p.stock}</span>
                        </div>
                      </div>

                      <div className="flex shrink-0 gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditing(p)}
                          className="h-7 text-xs"
                        >
                          <Pencil className="h-3 w-3 mr-1" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleTogglePublish(p)}
                          className="h-7 px-2"
                          aria-label={p.published ? "Sembunyikan" : "Publikasi"}
                        >
                          {p.published ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDuplicate(p)}
                          className="h-7 px-2"
                          aria-label="Duplikat"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        <DeleteButton onDelete={() => handleDelete(p.id)} />
                      </div>
                    </div>

                    {/* Expanded details */}
                    <AnimatePresence>
                      {expandedId === p.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-3 pt-3 border-t border-border/60 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                            <div className="space-y-1">
                              {p.image && (
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground">🖼️</span>
                                  <img
                                    src={p.image}
                                    alt={p.name}
                                    className="h-12 w-12 rounded object-cover border border-border"
                                  />
                                </div>
                              )}
                              {p.description && (
                                <p className="text-muted-foreground">
                                  <span className="font-medium text-foreground">Desc:</span> {p.description}
                                </p>
                              )}
                              {p.origin && (
                                <p className="text-muted-foreground">
                                  <span className="font-medium text-foreground">Asal:</span> {p.origin}
                                </p>
                              )}
                              {p.storageTip && (
                                <p className="text-muted-foreground">
                                  <span className="font-medium text-foreground">Simpan:</span> {p.storageTip}
                                </p>
                              )}
                            </div>
                            <div className="space-y-1">
                              {p.oldPrice != null && p.oldPrice > 0 && (
                                <p className="text-muted-foreground">
                                  <span className="font-medium text-foreground">Harga lama:</span>{" "}
                                  <span className="line-through">{formatIDR(p.oldPrice)}</span>
                                </p>
                              )}
                              {p.tags && p.tags.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1">
                                  <Tag className="h-3 w-3 text-muted-foreground" />
                                  {p.tags.map((t) => (
                                    <Badge key={t} variant="outline" className="text-[9px]">
                                      {t}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                              {p.benefits && p.benefits.length > 0 && (
                                <div>
                                  <p className="font-medium text-foreground">Manfaat:</p>
                                  <ul className="ml-4 list-disc text-muted-foreground">
                                    {p.benefits.map((b, idx) => (
                                      <li key={idx}>{b}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {p.variants && p.variants.length > 0 && (
                                <div>
                                  <p className="font-medium text-foreground">Varian:</p>
                                  <ul className="space-y-0.5">
                                    {p.variants.map((v, idx) => (
                                      <li key={v.id || idx} className="text-muted-foreground">
                                        {v.name} ({v.sku}) — {formatIDR(v.price)} · stok {v.stock}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {p.erpSyncedAt && (
                                <p className="text-[10px] text-muted-foreground italic">
                                  ERP synced: {new Date(p.erpSyncedAt).toLocaleString("id-ID")}
                                </p>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </AdminCard>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Pagination (client-side on filtered results) */}
      {!loading && totalFiltered > PRODUCTS_PER_PAGE && (
        <Pagination
          page={currentPage}
          totalPages={totalPages}
          total={totalFiltered}
          limit={PRODUCTS_PER_PAGE}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}

// ============================================================
// Helpers
// ============================================================

function productToForm(p: Product): ProductFormData {
  return {
    itemCode: p.itemCode ?? "",
    name: p.name ?? "",
    description: p.description ?? "",
    longDescription: p.longDescription ?? "",
    category: p.category ?? "Sayuran",
    price: p.price ?? 0,
    oldPrice: p.oldPrice != null ? String(p.oldPrice) : "",
    unit: p.unit ?? "kg",
    stock: p.stock ?? 0,
    emoji: p.emoji ?? "🥬",
    image: p.image ?? "",
    organic: !!p.organic,
    onSale: !!p.onSale,
    tags: (p.tags || []).join(", "),
    benefits: (p.benefits || []).join("\n"),
    storageTip: p.storageTip ?? "",
    origin: p.origin ?? "",
    published: p.published !== false,
    order: p.order ?? 0,
    variants: p.variants ?? [],
  };
}

function formToPayload(f: ProductFormData) {
  return {
    itemCode: f.itemCode.trim(),
    name: f.name.trim(),
    description: f.description.trim(),
    longDescription: f.longDescription.trim() || undefined,
    category: f.category,
    price: Number(f.price) || 0,
    oldPrice: f.oldPrice.trim() ? Number(f.oldPrice) : null,
    unit: f.unit,
    stock: Number(f.stock) || 0,
    emoji: f.emoji,
    image: f.image.trim() || null,
    organic: f.organic,
    onSale: f.onSale,
    tags: f.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    benefits: f.benefits
      .split("\n")
      .map((b) => b.trim())
      .filter(Boolean),
    storageTip: f.storageTip.trim() || undefined,
    origin: f.origin.trim() || undefined,
    published: f.published,
    order: Number(f.order) || 0,
    variants: f.variants,
  };
}

// ============================================================
// ProductForm — create/edit form with all fields
// ============================================================

interface ProductFormProps {
  initial: ProductFormData;
  isNew?: boolean;
  onSave: (data: ReturnType<typeof formToPayload>) => Promise<void>;
  onCancel: () => void;
}

function ProductForm({ initial, isNew, onSave, onCancel }: ProductFormProps) {
  const [form, setForm] = useState<ProductFormData>(initial);
  const [saving, setSaving] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof ProductFormData>(key: K, value: ProductFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const token = sessionStorage.getItem("admin-token");
      const res = await fetch("/api/admin/products/upload", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Upload gagal");
      }
      set("image", data.url);
      toast.success("Gambar diupload");
    } catch (err: any) {
      toast.error(err.message || "Gagal upload gambar");
    } finally {
      setUploading(false);
    }
  };

  const handleAddVariant = () => {
    set("variants", [
      ...form.variants,
      { name: "", sku: "", price: form.price, stock: 0 },
    ]);
  };

  const handleUpdateVariant = (idx: number, patch: Partial<Variant>) => {
    set(
      "variants",
      form.variants.map((v, i) => (i === idx ? { ...v, ...patch } : v))
    );
  };

  const handleRemoveVariant = (idx: number) => {
    set("variants", form.variants.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.name.trim().length < 2) {
      toast.error("Nama minimal 2 karakter");
      return;
    }
    if (!form.itemCode.trim()) {
      toast.error("Item code diperlukan");
      return;
    }
    setSaving(true);
    try {
      await onSave(formToPayload(form));
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminCard>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <h3 className="text-sm font-bold">
            {isNew ? "Tambah Produk Baru" : "Edit Produk"}
          </h3>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onCancel}
            className="h-7 w-7"
            aria-label="Tutup"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Identity row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <AdminField label="Emoji" required>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowEmojiPicker((s) => !s)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary text-lg"
                aria-label="Pilih emoji"
              >
                {form.emoji}
              </button>
              <Input
                value={form.emoji}
                onChange={(e) => set("emoji", e.target.value)}
                placeholder="🥬"
                className="w-20"
              />
            </div>
            {showEmojiPicker && (
              <div className="mt-2 flex flex-wrap gap-1 rounded-lg border border-border bg-card p-2">
                {EMOJI_CHOICES.map((e, idx) => (
                  <button
                    key={`${e}-${idx}`}
                    type="button"
                    onClick={() => {
                      set("emoji", e);
                      setShowEmojiPicker(false);
                    }}
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded text-base hover:bg-accent",
                      form.emoji === e && "bg-primary/15 ring-1 ring-primary"
                    )}
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
          </AdminField>

          <AdminField label="Item Code" required>
            <Input
              value={form.itemCode}
              onChange={(e) => set("itemCode", e.target.value)}
              placeholder="TOMAT-001"
            />
          </AdminField>

          <AdminField label="Order">
            <Input
              type="number"
              value={form.order}
              onChange={(e) => set("order", Number(e.target.value))}
              placeholder="0"
            />
          </AdminField>
        </div>

        <AdminField label="Nama Produk" required>
          <Input
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Tomat Segar"
          />
        </AdminField>

        <AdminField label="Deskripsi Singkat">
          <Textarea
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Tomat merah segar langsung dari kebun..."
            rows={2}
            className="resize-none"
          />
        </AdminField>

        <AdminField
          label="Long Description (Markdown/WYSIWYG)"
          hint="Tampilkan di detail produk. Mendukung baris baru."
        >
          <Textarea
            value={form.longDescription}
            onChange={(e) => set("longDescription", e.target.value)}
            placeholder="Deskripsi lengkap produk..."
            rows={4}
            className="resize-y font-mono text-xs"
          />
        </AdminField>

        {/* Pricing + stock row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <AdminField label="Harga (IDR)" required>
            <Input
              type="number"
              value={form.price}
              onChange={(e) => set("price", Number(e.target.value))}
              placeholder="15000"
            />
          </AdminField>
          <AdminField label="Harga Lama" hint="Hemat: isi jika onSale">
            <Input
              type="number"
              value={form.oldPrice}
              onChange={(e) => set("oldPrice", e.target.value)}
              placeholder="20000"
            />
          </AdminField>
          <AdminField label="Stok">
            <Input
              type="number"
              value={form.stock}
              onChange={(e) => set("stock", Number(e.target.value))}
              placeholder="50"
            />
          </AdminField>
          <AdminField label="Satuan">
            <Select value={form.unit} onValueChange={(v) => set("unit", v)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UNITS.map((u) => (
                  <SelectItem key={u} value={u}>
                    {u}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </AdminField>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <AdminField label="Kategori">
            <Select value={form.category} onValueChange={(v) => set("category", v)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {/* Merge dynamic categories (from existing products) with
                    hardcoded fallback. Dedupe + sort for consistency. */}
                {Array.from(new Set([...categoryOptions, ...CATEGORIES]))
                  .sort()
                  .map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </AdminField>
          <AdminField label="Asal (opsional)">
            <Input
              value={form.origin}
              onChange={(e) => set("origin", e.target.value)}
              placeholder="Cianjur, Jawa Barat"
            />
          </AdminField>
        </div>

        {/* Image upload */}
        <AdminField label="Gambar Produk" hint="Upload file atau tempel URL">
          <div className="flex items-center gap-2">
            <Input
              value={form.image}
              onChange={(e) => set("image", e.target.value)}
              placeholder="/products/tomat.png atau https://..."
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImageUpload(f);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="h-9"
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              <span className="ml-1 text-xs">Upload</span>
            </Button>
          </div>
          {form.image && (
            <div className="mt-2 flex items-center gap-2">
              <img
                src={form.image}
                alt="Preview"
                className="h-16 w-16 rounded-lg border border-border object-cover"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => set("image", "")}
                className="h-7 text-xs"
              >
                <X className="h-3 w-3 mr-1" />
                Hapus
              </Button>
            </div>
          )}
        </AdminField>

        {/* Tags + benefits + storage tip */}
        <AdminField label="Tags" hint="Pisahkan dengan koma">
          <Input
            value={form.tags}
            onChange={(e) => set("tags", e.target.value)}
            placeholder="lokal, segar, organik"
          />
        </AdminField>

        <AdminField label="Manfaat" hint="Satu per baris">
          <Textarea
            value={form.benefits}
            onChange={(e) => set("benefits", e.target.value)}
            placeholder="Kaya vitamin C&#10;Baik untuk jantung"
            rows={3}
            className="resize-none"
          />
        </AdminField>

        <AdminField label="Tips Penyimpanan">
          <Input
            value={form.storageTip}
            onChange={(e) => set("storageTip", e.target.value)}
            placeholder="Simpan di kulkas, tahan 5 hari"
          />
        </AdminField>

        {/* Toggles */}
        <div className="grid grid-cols-3 gap-2">
          <ToggleCard
            label="Organic"
            checked={form.organic}
            onChange={(v) => set("organic", v)}
          />
          <ToggleCard
            label="On Sale"
            checked={form.onSale}
            onChange={(v) => set("onSale", v)}
          />
          <ToggleCard
            label="Published"
            checked={form.published}
            onChange={(v) => set("published", v)}
          />
        </div>

        {/* Variants */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium text-muted-foreground">
              Varian
            </Label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleAddVariant}
              className="h-7 text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              Tambah Varian
            </Button>
          </div>
          {form.variants.length === 0 ? (
            <p className="text-[10px] text-muted-foreground italic">
              Belum ada varian. Contoh: 250gr, 500gr, 1kg.
            </p>
          ) : (
            <div className="space-y-2">
              {form.variants.map((v, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-12 gap-2 rounded-lg border border-border bg-secondary/30 p-2"
                >
                  <Input
                    className="col-span-4 h-8 text-xs"
                    placeholder="Nama varian"
                    value={v.name}
                    onChange={(e) => handleUpdateVariant(idx, { name: e.target.value })}
                  />
                  <Input
                    className="col-span-3 h-8 text-xs"
                    placeholder="SKU"
                    value={v.sku}
                    onChange={(e) => handleUpdateVariant(idx, { sku: e.target.value })}
                  />
                  <Input
                    className="col-span-2 h-8 text-xs"
                    type="number"
                    placeholder="Harga"
                    value={v.price}
                    onChange={(e) => handleUpdateVariant(idx, { price: Number(e.target.value) })}
                  />
                  <Input
                    className="col-span-2 h-8 text-xs"
                    type="number"
                    placeholder="Stok"
                    value={v.stock}
                    onChange={(e) => handleUpdateVariant(idx, { stock: Number(e.target.value) })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveVariant(idx)}
                    className="col-span-1 h-8 w-8"
                    aria-label="Hapus varian"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button type="button" variant="outline" size="sm" onClick={onCancel} className="h-9">
            Batal
          </Button>
          <Button type="submit" disabled={saving} size="sm" className="h-9">
            {saving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Menyimpan...
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5 mr-1.5" />
                Simpan
              </>
            )}
          </Button>
        </div>
      </form>
    </AdminCard>
  );
}

function ToggleCard({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      className={cn(
        "flex items-center justify-between gap-2 rounded-lg border p-2 cursor-pointer transition-colors",
        checked ? "border-primary bg-primary/5" : "border-border"
      )}
    >
      <span className="text-xs font-medium">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

// Re-export for type-only usage by other components if needed
export type { Product, Variant };
