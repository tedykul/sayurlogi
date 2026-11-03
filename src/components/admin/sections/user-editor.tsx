"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Loader2, Search, RefreshCw, Plus, Pencil, Trash2, UserCog, AlertCircle,
  X, ShieldCheck, ShieldUser, User, Mail, Power, Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import { adminFetch, getCurrentUserId, type AdminUser, type AdminRole } from "@/lib/admin-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  AdminSectionHeading,
  AdminField,
  AdminCard,
  AdminEmptyState,
} from "../admin-ui";

// ============================================================
// UserEditor — manage admin users (create, edit, delete, toggle).
// ============================================================
// Features:
//   - List users with avatar, name, email, role badge, active
//     status, last login timestamp.
//   - Search by email/name/role.
//   - Stats summary (total, active, non-active, admin count).
//   - Create modal (email + name + password + role + active).
//   - Edit modal (name + password optional + role + active).
//   - Delete confirmation modal (custom modal at z-[200] so it
//     appears above the AdminOverlay which sits at z-[100]).
//   - Quick toggle active button per row.
//   - Self-protection: hide disable/delete on own account;
//     "Anda" badge marks the current user.
//
// API route: /api/admin/users
//   GET    → list all users
//   POST   → create new user
//   PUT    /api/admin/users/[id]  → update (name/password/role/active)
//   DELETE /api/admin/users/[id]  → delete
//
// Current user id is read from sessionStorage["admin-user-id"]
// (set by AdminOverlay on login / checkAuthStatus).
// ============================================================

type UserListResponse = { success: boolean; users: AdminUser[] };

export function UserEditor() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState<AdminUser | null>(null);
  const [busy, setBusy] = useState(false);

  const currentUserId = getCurrentUserId();

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminFetch<UserListResponse>("/api/admin/users");
      setUsers(res.users || []);
    } catch (err: any) {
      setError(err.message || "Gagal memuat users");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const filtered = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        (u.name || "").toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
    );
  }, [users, search]);

  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.isActive).length;
    const nonActive = total - active;
    const adminCount = users.filter(
      (u) => u.role === "super_admin" || u.role === "admin"
    ).length;
    return { total, active, nonActive, adminCount };
  }, [users]);

  const handleToggleActive = async (u: AdminUser) => {
    if (u.id === currentUserId) {
      toast.error("Tidak bisa menonaktifkan akun sendiri");
      return;
    }
    setBusy(true);
    try {
      await adminFetch(`/api/admin/users/${u.id}`, {
        method: "PUT",
        body: JSON.stringify({ isActive: !u.isActive }),
      });
      setUsers((prev) =>
        prev.map((x) => (x.id === u.id ? { ...x, isActive: !x.isActive } : x))
      );
      toast.success(u.isActive ? "User dinonaktifkan" : "User diaktifkan");
    } catch (err: any) {
      toast.error(err.message || "Gagal update status");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (u: AdminUser) => {
    setBusy(true);
    try {
      await adminFetch(`/api/admin/users/${u.id}`, { method: "DELETE" });
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
      toast.success("User dihapus");
      setDeleting(null);
    } catch (err: any) {
      toast.error(err.message || "Gagal menghapus user");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <AdminSectionHeading
        title="👤 Users"
        description="Kelola akun admin — tambah, edit role, aktif/nonaktifkan."
        action={
          <Button size="sm" onClick={() => setCreating(true)} className="h-9">
            <Plus className="h-4 w-4 mr-1" />
            Tambah User
          </Button>
        }
      />

      {/* Stats summary */}
      {!loading && !error && users.length > 0 && (
        <div className="mb-4 grid grid-cols-4 gap-2">
          <StatCard label="Total" value={stats.total} />
          <StatCard label="Aktif" value={stats.active} tone="emerald" />
          <StatCard label="Nonaktif" value={stats.nonActive} tone="slate" />
          <StatCard label="Admin" value={stats.adminCount} tone="violet" />
        </div>
      )}

      {/* Search + refresh */}
      <div className="mb-3 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari email, nama, role..."
            className="h-9 pl-9 rounded-lg text-xs"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchUsers}
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

      {/* Error */}
      {error && (
        <AdminCard className="mb-3 border-destructive/40 bg-destructive/5">
          <p className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {error}
          </p>
        </AdminCard>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl border border-border/60 bg-card animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && filtered.length === 0 && !creating && (
        <AdminEmptyState
          icon={<UserCog className="h-8 w-8" />}
          title="Belum ada user"
          description="Tambahkan admin pertama untuk mulai mengelola akses."
        />
      )}

      {/* Create modal */}
      {creating && (
        <UserModal
          mode="create"
          onClose={() => setCreating(false)}
          onSubmit={async (data) => {
            await adminFetch("/api/admin/users", {
              method: "POST",
              body: JSON.stringify(data),
            });
            toast.success("User ditambahkan");
            setCreating(false);
            fetchUsers();
          }}
        />
      )}

      {/* Edit modal */}
      {editing && (
        <UserModal
          mode="edit"
          initial={editing}
          isSelf={editing.id === currentUserId}
          onClose={() => setEditing(null)}
          onSubmit={async (data) => {
            await adminFetch(`/api/admin/users/${editing.id}`, {
              method: "PUT",
              body: JSON.stringify(data),
            });
            toast.success("User diupdate");
            setEditing(null);
            fetchUsers();
          }}
        />
      )}

      {/* Delete confirmation modal (z-[200] to overlay above AdminOverlay) */}
      <AnimatePresence>
        {deleting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
            onClick={() => setDeleting(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl"
            >
              <div className="mb-3 flex items-center gap-2 text-destructive">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/15">
                  <AlertCircle className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold">Hapus User?</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Anda akan menghapus{" "}
                <span className="font-semibold text-foreground">
                  {deleting.name || deleting.email}
                </span>
                . Aksi ini tidak bisa dibatalkan.
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleting(null)}
                  disabled={busy}
                  className="h-9"
                >
                  Batal
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(deleting)}
                  disabled={busy}
                  className="h-9"
                >
                  {busy ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Hapus Permanen
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* User list */}
      {filtered.length > 0 && (
        <div className="space-y-2">
          <AnimatePresence>
            {filtered.map((u, i) => {
              const isSelf = u.id === currentUserId;
              return (
                <motion.div
                  key={u.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2, delay: Math.min(i * 0.02, 0.3) }}
                >
                  <AdminCard className="flex items-center gap-3 py-3">
                    {/* Avatar */}
                    <div
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                        u.isActive
                          ? "bg-primary/15 text-primary"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {(u.name || u.email).charAt(0).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold truncate">
                          {u.name || "(tanpa nama)"}
                        </h3>
                        <RoleBadge role={u.role} />
                        {u.isActive ? (
                          <Badge variant="secondary" className="text-[9px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                            Aktif
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[9px] bg-slate-500/15 text-slate-700 dark:text-slate-300">
                            Nonaktif
                          </Badge>
                        )}
                        {isSelf && (
                          <Badge variant="outline" className="text-[9px] border-primary text-primary">
                            Anda
                          </Badge>
                        )}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" /> {u.email}
                        </span>
                        {u.lastLoginAt && (
                          <span>
                            Login terakhir:{" "}
                            {new Date(u.lastLoginAt).toLocaleString("id-ID", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex shrink-0 gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditing(u)}
                        className="h-7 text-xs"
                      >
                        <Pencil className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                      {/* Toggle active — hidden for self */}
                      {!isSelf && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleToggleActive(u)}
                          disabled={busy}
                          className="h-7 px-2"
                          aria-label={u.isActive ? "Nonaktifkan" : "Aktifkan"}
                          title={u.isActive ? "Nonaktifkan" : "Aktifkan"}
                        >
                          <Power className={cn("h-3 w-3", u.isActive && "text-emerald-600")} />
                        </Button>
                      )}
                      {/* Delete — hidden for self */}
                      {!isSelf && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDeleting(u)}
                          className="h-7 px-2 hover:bg-destructive hover:text-destructive-foreground"
                          aria-label="Hapus user"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </AdminCard>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      <p className="mt-4 rounded-lg border border-border/60 bg-secondary/30 p-3 text-xs text-muted-foreground">
        🔒 <strong>Self-protection:</strong> Akun sendiri tidak bisa dinonaktifkan
        atau dihapus. Role <code>super_admin</code> bisa semua aksi, <code>admin</code>{" "}
        bisa kelola produk/konten, <code>staff</code> read-only.
      </p>
    </div>
  );
}

// ============================================================
// RoleBadge
// ============================================================
function RoleBadge({ role }: { role: AdminRole }) {
  const label =
    role === "super_admin" ? "Super Admin" : role === "admin" ? "Admin" : "Staff";
  const Icon = role === "super_admin" ? ShieldCheck : role === "admin" ? ShieldUser : User;
  const cls =
    role === "super_admin"
      ? "bg-violet-500/15 text-violet-700 dark:text-violet-300"
      : role === "admin"
      ? "bg-blue-500/15 text-blue-700 dark:text-blue-300"
      : "bg-slate-500/15 text-slate-700 dark:text-slate-300";
  return (
    <Badge variant="secondary" className={cn("text-[9px] gap-0.5", cls)}>
      <Icon className="h-2.5 w-2.5" />
      {label}
    </Badge>
  );
}

// ============================================================
// StatCard
// ============================================================
function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "emerald" | "slate" | "violet";
}) {
  const cls =
    tone === "emerald"
      ? "text-emerald-600"
      : tone === "slate"
      ? "text-slate-600 dark:text-slate-300"
      : tone === "violet"
      ? "text-violet-600"
      : "text-foreground";
  return (
    <div className="rounded-lg border border-border/60 bg-secondary/30 p-2.5 text-center">
      <p className={cn("text-lg font-bold tabular-nums", cls)}>{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

// ============================================================
// UserModal — create / edit user
// ============================================================
interface UserModalProps {
  mode: "create" | "edit";
  initial?: AdminUser;
  isSelf?: boolean;
  onClose: () => void;
  onSubmit: (data: {
    email: string;
    name: string;
    password?: string;
    role: AdminRole;
    isActive: boolean;
  }) => Promise<void>;
}

function UserModal({ mode, initial, isSelf, onClose, onSubmit }: UserModalProps) {
  const [email, setEmail] = useState(initial?.email ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AdminRole>(initial?.role ?? "staff");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "create") {
      if (!email.trim()) return toast.error("Email diperlukan");
      if (!password || password.length < 6)
        return toast.error("Password minimal 6 karakter");
    } else {
      // Edit: password optional
      if (password && password.length < 6)
        return toast.error("Password minimal 6 karakter");
    }
    setSaving(true);
    try {
      await onSubmit({
        email: email.trim(),
        name: name.trim() || "",
        password: password || undefined,
        role,
        isActive,
      });
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan user");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold">
            {mode === "create" ? "Tambah User Baru" : "Edit User"}
          </h3>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Tutup"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <AdminField label="Email" required>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="kamu@sayurlogi.id"
              disabled={mode === "edit"}
              autoFocus={mode === "create"}
            />
          </AdminField>

          <AdminField label="Nama Lengkap">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nama Karyawan"
            />
          </AdminField>

          <AdminField
            label={mode === "create" ? "Password" : "Password Baru"}
            required={mode === "create"}
            hint={mode === "edit" ? "Kosongkan jika tidak ingin ganti password" : undefined}
          >
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimal 6 karakter"
              autoComplete="new-password"
            />
          </AdminField>

          <AdminField label="Role">
            <Select value={role} onValueChange={(v) => setRole(v as AdminRole)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="super_admin">
                  Super Admin (akses penuh)
                </SelectItem>
                <SelectItem value="admin">Admin (kelola konten)</SelectItem>
                <SelectItem value="staff">Staff (read-only)</SelectItem>
              </SelectContent>
            </Select>
          </AdminField>

          <AdminField label="Status Aktif">
            <label
              className={cn(
                "flex items-center justify-between gap-2 rounded-lg border p-2.5 cursor-pointer transition-colors",
                isActive ? "border-primary bg-primary/5" : "border-border"
              )}
            >
              <div>
                <p className="text-xs font-medium">Aktif</p>
                <p className="text-[10px] text-muted-foreground">
                  User nonaktif tidak bisa login
                </p>
              </div>
              <Switch
                checked={isActive}
                onCheckedChange={setIsActive}
                disabled={isSelf}
              />
            </label>
            {isSelf && (
              <p className="text-[10px] text-amber-600">
                ⚠️ Tidak bisa menonaktifkan akun sendiri
              </p>
            )}
          </AdminField>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={saving} className="h-9">
              Batal
            </Button>
            <Button type="submit" disabled={saving} size="sm" className="h-9">
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5 mr-1.5" />
              )}
              {mode === "create" ? "Tambah" : "Simpan"}
            </Button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
