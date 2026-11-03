"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Save, CheckCircle2, AlertCircle, Plus, Trash2, Pencil, X, Check, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { adminFetch } from "@/lib/admin-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ============================================================
// Admin UI primitives — reusable building blocks for editors.
// ============================================================

/** Section heading with title + optional description. */
export function AdminSectionHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-xl font-bold tracking-tight">{title}</h2>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

/** Labeled form field wrapper. */
export function AdminField({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Save button with loading + success state. */
export function SaveButton({
  onSave,
  label = "Simpan Perubahan",
  className,
}: {
  onSave: () => Promise<void>;
  label?: string;
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");

  const handleSave = async () => {
    setState("saving");
    try {
      await onSave();
      setState("saved");
      toast.success("Tersimpan!");
      setTimeout(() => setState("idle"), 2000);
    } catch (err: any) {
      setState("idle");
      toast.error(err.message || "Gagal menyimpan");
    }
  };

  return (
    <Button
      onClick={handleSave}
      disabled={state === "saving"}
      className={cn("h-10", className)}
    >
      {state === "saving" ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Menyimpan...
        </>
      ) : state === "saved" ? (
        <>
          <CheckCircle2 className="h-4 w-4 mr-2" />
          Tersimpan!
        </>
      ) : (
        <>
          <Save className="h-4 w-4 mr-2" />
          {label}
        </>
      )}
    </Button>
  );
}

/** Delete confirmation button (click once to arm, again to confirm). */
export function DeleteButton({
  onDelete,
  label = "Hapus",
  className,
}: {
  onDelete: () => Promise<void> | void;
  label?: string;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleClick = async () => {
    if (!armed) {
      setArmed(true);
      setTimeout(() => setArmed(false), 3000); // auto-disarm after 3s
      return;
    }
    setDeleting(true);
    try {
      await onDelete();
      toast.success("Berhasil dihapus");
    } catch (err: any) {
      toast.error(err.message || "Gagal menghapus");
    } finally {
      setDeleting(false);
      setArmed(false);
    }
  };

  return (
    <Button
      variant={armed ? "destructive" : "outline"}
      size="sm"
      onClick={handleClick}
      disabled={deleting}
      className={cn("h-8 text-xs", className)}
    >
      {deleting ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : armed ? (
        <>
          <AlertCircle className="h-3 w-3 mr-1" />
          Konfirmasi?
        </>
      ) : (
        <>
          <Trash2 className="h-3 w-3 mr-1" />
          {label}
        </>
      )}
    </Button>
  );
}

/** Card container for list items (FAQ, testimonial, etc). */
export function AdminCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-4 shadow-sm",
        className
      )}
    >
      {children}
    </div>
  );
}

/** Empty state placeholder. */
export function AdminEmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-12 text-center">
      {icon && <div className="text-muted-foreground">{icon}</div>}
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground max-w-xs">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

/** Hook: fetch JSON via adminFetch with loading + error states. */
export function useAdminFetch<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminFetch<{ success: boolean } & Record<string, unknown>>(url);
      // Convention: API returns { success, [key]: data }
      // Find first non-success key as data
      const keys = Object.keys(res).filter((k) => k !== "success");
      setData((keys[0] ? res[keys[0]] : res) as T);
    } catch (err: any) {
      setError(err.message || "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
