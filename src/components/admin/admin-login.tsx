"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdminStore } from "@/lib/store/admin";
import { toast } from "sonner";
import { Loader2, ShieldCheck, Eye, EyeOff } from "lucide-react";
import type { Coupon } from "@/types";

interface AdminLoginProps {
  open: boolean;
  onclose: () => void;
}

// ============================================================
// AdminLogin — token input dialog.
// ============================================================
// Verifies token by calling GET /api/admin/coupons (returns 401
// if invalid). On success, persists token via admin store.
// ============================================================

export function AdminLogin({ open, onclose }: AdminLoginProps) {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const setStoredToken = useAdminStore((s) => s.setToken);

  const handleLogin = async () => {
    if (!token.trim()) {
      toast.error("Masukkan admin token");
      return;
    }

    setLoading(true);
    try {
      // Test token by fetching coupons
      const res = await fetch("/api/admin/coupons", {
        headers: { "x-admin-token": token.trim() },
      });
      if (!res.ok) {
        throw new Error("Token tidak valid");
      }
      const data = (await res.json()) as { coupons: Coupon[] };
      setStoredToken(token.trim());
      toast.success(`Admin login berhasil (${data.coupons.length} kupon dimuat)`);
      // Don't call onclose — let AdminOverlay auto-switch to AdminDashboard
      // (token is now truthy + isOpen still true → dashboard renders)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login gagal");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onclose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-green-600" /> Admin Login
          </DialogTitle>
          <DialogDescription>
            Masukkan admin token untuk mengakses dashboard kupon.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="admin-token">Admin Token</Label>
            <div className="relative">
              <Input
                id="admin-token"
                type={showToken ? "text" : "password"}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                placeholder="admin-demo-token"
                disabled={loading}
                className="pr-10"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowToken((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:text-foreground"
                tabIndex={-1}
                aria-label={showToken ? "Sembunyikan token" : "Tampilkan token"}
                aria-pressed={showToken}
              >
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">
            💡 Default token: <code className="font-mono bg-muted px-1 rounded">admin-demo-token</code>
            (set <code className="font-mono">ADMIN_TOKEN</code> env untuk produksi)
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onclose} disabled={loading}>
            Batal
          </Button>
          <Button onClick={handleLogin} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Verifikasi...
              </>
            ) : (
              "Login"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
