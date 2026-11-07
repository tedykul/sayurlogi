"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  Mail,
  Lock,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Eye,
  EyeOff,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { CustomerPublic } from "@/lib/customer-auth";

// ============================================================
// ForgotPasswordDialog — 3-step password reset flow.
// ============================================================
// Step 1: User enters email → API generates token + (pretends to) send email.
//         Show success message regardless (prevent email enumeration).
// Step 2: User enters the reset token (extracted from email link) OR
//         clicks the link in the email which auto-fills token.
// Step 3: User enters new password (with confirm) → API verifies token
//         + updates password + auto-login.
//
// Backward compatible: when `token` prop is empty, dialog opens at step 1.
// When `token` prop is set (from URL ?token=...), dialog skips to step 3.
// ============================================================

interface ForgotPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-filled token (from URL ?token=... when user clicks email link) */
  initialToken?: string;
  /** Called when password successfully reset (customer auto-logged-in) */
  onSuccess?: (customer: CustomerPublic) => void;
  /** Called when user wants to go back to login dialog */
  onBackToLogin?: () => void;
}

type Step = "request" | "verify" | "success";

export function ForgotPasswordDialog({
  open,
  onOpenChange,
  initialToken,
  onSuccess,
  onBackToLogin,
}: ForgotPasswordDialogProps) {
  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState(initialToken || "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [emailWarning, setEmailWarning] = useState("");

  // If initialToken is provided (user clicked link in email), skip
  // directly to verify step with token pre-filled.
  useEffect(() => {
    if (initialToken) {
      setToken(initialToken);
      setStep("verify");
    }
  }, [initialToken]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      // Small delay so user doesn't see state reset flash
      const t = setTimeout(() => {
        setStep("request");
        setEmail("");
        setToken(initialToken || "");
        setNewPassword("");
        setConfirmPassword("");
        setError("");
        setEmailWarning("");
        setShowPassword(false);
      }, 200);
      return () => clearTimeout(t);
    }
  }, [open, initialToken]);

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailWarning("Format email belum benar");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/customer/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.success) {
        // Always proceed to verify step, regardless of whether email
        // actually exists (prevent enumeration).
        setStep("verify");
        toast.success("Permintaan reset terkirim. Cek email Anda.");
      } else {
        setError(data.message || "Gagal mengirim permintaan reset.");
      }
    } catch {
      setError("Koneksi gagal. Coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError("Token reset wajib diisi.");
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setError("Password baru minimal 6 karakter.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Konfirmasi password tidak cocok.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/customer/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
        credentials: "include",
      });
      const data = await res.json();
      if (data.success && data.customer) {
        setStep("success");
        toast.success("Password berhasil diubah!");
        // Auto-close + notify parent after short delay (let user see success state)
        setTimeout(() => {
          onSuccess?.(data.customer);
          onOpenChange(false);
        }, 1500);
      } else {
        setError(data.message || "Gagal reset password.");
      }
    } catch {
      setError("Koneksi gagal. Coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <KeyRound className="h-4 w-4" />
            </div>
            {step === "request" && "Lupa Password"}
            {step === "verify" && "Reset Password"}
            {step === "success" && "Berhasil!"}
          </DialogTitle>
          <DialogDescription>
            {step === "request" &&
              "Masukkan email akun Anda. Kami kirim link reset password."}
            {step === "verify" &&
              "Masukkan token dari email + password baru Anda."}
            {step === "success" && "Password Anda berhasil diubah."}
          </DialogDescription>
        </DialogHeader>

        {/* Back to login button (only on request step) */}
        {step === "request" && onBackToLogin && (
          <button
            type="button"
            onClick={onBackToLogin}
            className="flex items-center gap-1 self-start text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" />
            Kembali ke login
          </button>
        )}

        {step === "request" && (
          <form onSubmit={handleRequestReset} className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
                      setEmailWarning("Format email belum benar");
                    } else {
                      setEmailWarning("");
                    }
                    setEmail(val);
                    if (error) setError("");
                  }}
                  placeholder="kamu@email.com"
                  disabled={loading}
                  className={cn("pl-9 h-10", emailWarning && "border-amber-500/50 ring-1 ring-amber-500/20")}
                  autoFocus
                  autoComplete="email"
                />
                {emailWarning && (
                  <p className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    {emailWarning}
                  </p>
                )}
              </div>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button type="submit" disabled={loading} className="h-10 w-full">
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
              Kirim Link Reset
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Link reset berlaku 1 jam. Cek folder spam kalau tidak ada di inbox.
            </p>
          </form>
        )}

        {step === "verify" && (
          <form onSubmit={handleResetPassword} className="space-y-3">
            {/* Info banner — explains the flow */}
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300">
              {email ? (
                <>
                  Link reset telah dikirim ke <strong>{email}</strong>.
                  Cek email Anda + klik link, atau paste token di bawah.
                </>
              ) : (
                <>Masukkan token reset yang Anda terima via email.</>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Token Reset</Label>
              <Input
                type="text"
                value={token}
                onChange={(e) => { setToken(e.target.value); if (error) setError(""); }}
                placeholder="Paste token dari email..."
                disabled={loading}
                className="h-10 font-mono text-xs"
                autoFocus={!initialToken}
                autoComplete="off"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Password Baru <span className="text-muted-foreground">(min 6 karakter)</span>
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); if (error) setError(""); }}
                  placeholder="••••••••"
                  disabled={loading}
                  className="pl-9 pr-10 h-10"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:text-foreground"
                  tabIndex={-1}
                  aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Konfirmasi Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); if (error) setError(""); }}
                  placeholder="••••••••"
                  disabled={loading}
                  className="pl-9 h-10"
                  autoComplete="new-password"
                />
              </div>
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="flex items-center gap-1 text-xs text-destructive">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  Password tidak cocok
                </p>
              )}
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button
              type="submit"
              disabled={loading || (!!confirmPassword && newPassword !== confirmPassword)}
              className="h-10 w-full"
            >
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <KeyRound className="h-4 w-4 mr-2" />}
              Reset Password
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Setelah reset, Anda otomatis login dengan password baru.
            </p>
          </form>
        )}

        {step === "success" && (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-950/40">
              <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-center text-sm">
              Password Anda berhasil diubah.
              <br />
              Anda akan otomatis login...
            </p>
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
