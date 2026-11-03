"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Loader2, Search, Filter, Clock, CheckCircle2, XCircle, AlertCircle, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from "framer-motion";
import { adminFetch } from "@/lib/admin-client";
import {
  AdminSectionHeading,
  AdminCard,
  AdminEmptyState,
} from "../admin-ui";

// ============================================================
// AuditLogViewer — list admin actions from /api/admin/audit.
// ============================================================
// Filterable by action type, success status, search query.
// Shows timestamp, action, target, IP, success status.
// ============================================================

interface AuditEntry {
  id: string;
  action: string;
  target: string;
  ip: string | null;
  userAgent: string | null;
  success: boolean;
  detail: string | null;
  createdAt: string;
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  login_success: { label: "Login Berhasil", color: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400" },
  login_failed: { label: "Login Gagal", color: "bg-rose-500/20 text-rose-700 dark:text-rose-400" },
  login_rate_limited: { label: "Rate Limited", color: "bg-amber-500/20 text-amber-700 dark:text-amber-400" },
  create: { label: "Create", color: "bg-blue-500/20 text-blue-700 dark:text-blue-400" },
  update: { label: "Update", color: "bg-violet-500/20 text-violet-700 dark:text-violet-400" },
  delete: { label: "Delete", color: "bg-rose-500/20 text-rose-700 dark:text-rose-400" },
  publish_toggle: { label: "Publish Toggle", color: "bg-cyan-500/20 text-cyan-700 dark:text-cyan-400" },
  reorder: { label: "Reorder", color: "bg-slate-500/20 text-slate-700 dark:text-slate-300" },
  unauthorized_attempt: { label: "Unauthorized", color: "bg-red-500/20 text-red-700 dark:text-red-400" },
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return "Baru saja";
  if (diffMin < 60) return `${diffMin} menit lalu`;
  if (diffHour < 24) return `${diffHour} jam lalu`;
  if (diffDay < 7) return `${diffDay} hari lalu`;
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function formatFullTime(iso: string): string {
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function AuditLogViewer() {
  const [filterAction, setFilterAction] = useState<string>("all");
  const [filterSuccess, setFilterSuccess] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Build query string from filters
  const queryString = useMemo(() => {
    const params = new URLSearchParams({ limit: "100" });
    if (filterAction !== "all") params.set("action", filterAction);
    if (filterSuccess === "true") params.set("success", "true");
    if (filterSuccess === "false") params.set("success", "false");
    return params.toString();
  }, [filterAction, filterSuccess]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminFetch<{ success: boolean; entries: AuditEntry[]; total: number }>(
        `/api/admin/audit?${queryString}`
      );
      setEntries(res.entries || []);
      setTotal(res.total || 0);
    } catch (err: any) {
      setError(err.message || "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Client-side search filter (on target field)
  const filtered = useMemo(() => {
    if (!search.trim()) return entries;
    const q = search.toLowerCase();
    return entries.filter(
      (e) =>
        e.target.toLowerCase().includes(q) ||
        e.ip?.toLowerCase().includes(q) ||
        e.action.toLowerCase().includes(q)
    );
  }, [entries, search]);

  return (
    <div>
      <AdminSectionHeading
        title="📋 Audit Log"
        description="Riwayat semua aksi admin — siapa, kapan, apa, dari IP mana."
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

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-2">
        <Select value={filterAction} onValueChange={setFilterAction}>
          <SelectTrigger className="w-[160px] h-9 rounded-lg text-xs">
            <Filter className="h-3.5 w-3.5 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Aksi</SelectItem>
            <SelectItem value="login_success">Login Berhasil</SelectItem>
            <SelectItem value="login_failed">Login Gagal</SelectItem>
            <SelectItem value="login_rate_limited">Rate Limited</SelectItem>
            <SelectItem value="create">Create</SelectItem>
            <SelectItem value="update">Update</SelectItem>
            <SelectItem value="delete">Delete</SelectItem>
            <SelectItem value="publish_toggle">Publish Toggle</SelectItem>
            <SelectItem value="reorder">Reorder</SelectItem>
            <SelectItem value="unauthorized_attempt">Unauthorized</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterSuccess} onValueChange={setFilterSuccess}>
          <SelectTrigger className="w-[140px] h-9 rounded-lg text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Status</SelectItem>
            <SelectItem value="true">Sukses</SelectItem>
            <SelectItem value="false">Gagal</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari target atau IP..."
            className="h-9 pl-9 rounded-lg text-xs"
          />
        </div>
      </div>

      {/* Stats summary */}
      {!loading && !error && (
        <div className="mb-4 grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-border/60 bg-secondary/30 p-2.5 text-center">
            <p className="text-lg font-bold tabular-nums">{total}</p>
            <p className="text-[10px] text-muted-foreground">Total Entries</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-secondary/30 p-2.5 text-center">
            <p className="text-lg font-bold tabular-nums text-emerald-600">
              {entries.filter((e) => e.success).length}
            </p>
            <p className="text-[10px] text-muted-foreground">Sukses</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-secondary/30 p-2.5 text-center">
            <p className="text-lg font-bold tabular-nums text-rose-600">
              {entries.filter((e) => !e.success).length}
            </p>
            <p className="text-[10px] text-muted-foreground">Gagal</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <AdminCard className="border-destructive/40 bg-destructive/5">
          <p className="text-sm text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </p>
        </AdminCard>
      )}

      {/* Loading state */}
      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl border border-border/60 bg-card animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <AdminEmptyState
          icon={<Clock className="h-8 w-8" />}
          title="Tidak ada log"
          description="Belum ada aktivitas admin yang tercatat dengan filter ini."
        />
      )}

      {/* Log entries */}
      {filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((entry, i) => {
            const meta = ACTION_LABELS[entry.action] || { label: entry.action, color: "bg-muted text-muted-foreground" };
            return (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: Math.min(i * 0.02, 0.3) }}
              >
                <AdminCard className="flex items-start gap-3 py-3">
                  {/* Success icon */}
                  <div className="shrink-0 mt-0.5">
                    {entry.success ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-rose-500" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={`text-[10px] font-medium ${meta.color}`} variant="secondary">
                        {meta.label}
                      </Badge>
                      <code className="text-xs font-mono text-foreground bg-secondary px-1.5 py-0.5 rounded">
                        {entry.target}
                      </code>
                      <span
                        className="text-[10px] text-muted-foreground ml-auto"
                        title={formatFullTime(entry.createdAt)}
                      >
                        {formatTime(entry.createdAt)}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                      {entry.ip && (
                        <span className="flex items-center gap-0.5">
                          🌐 {entry.ip}
                        </span>
                      )}
                      {entry.detail && (
                        <span className="flex items-center gap-0.5 truncate">
                          ℹ️ {entry.detail}
                        </span>
                      )}
                    </div>
                  </div>
                </AdminCard>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Note */}
      <p className="mt-4 rounded-lg border border-border/60 bg-secondary/30 p-3 text-xs text-muted-foreground">
        💡 <strong>Tip:</strong> Audit log mencatat IP address & waktu. Untuk tracking user spesifik
        (siapa karyawan), upgrade ke NextAuth.js (lihat Plan B di dokumentasi).
        Log entries lebih dari 90 hari akan di-prune otomatis (TODO).
      </p>
    </div>
  );
}
