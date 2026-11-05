"use client";

import { useState } from "react";
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
import { Loader2, User, Mail, Phone, Lock, MapPin, UserPlus, LogIn, AlertCircle } from "lucide-react";
import { useCustomerStore } from "@/lib/store/customer";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { CustomerPublic } from "@/lib/customer-auth";

// ============================================================
// CustomerAuthDialog — login + register tabs.
// ============================================================
// Controlled by useCustomerStore.authDialogOpen. On success,
// the store is updated with the returned customer + the dialog
// closes. Guest checkout still works independently.
// ============================================================

type Tab = "login" | "register";

export function CustomerAuthDialog() {
  const { authDialogOpen, closeAuthDialog, setCustomer } = useCustomerStore();
  const [tab, setTab] = useState<Tab>("login");

  const handleClose = (open: boolean) => {
    if (!open) closeAuthDialog();
  };

  const onSuccess = (customer: CustomerPublic) => {
    setCustomer(customer);
    closeAuthDialog();
    toast.success(tab === "login" ? "Selamat datang kembali!" : "Pendaftaran berhasil!");
  };

  return (
    <Dialog open={authDialogOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <User className="h-4 w-4" />
            </div>
            {tab === "login" ? "Masuk Akun" : "Daftar Akun Baru"}
          </DialogTitle>
          <DialogDescription>
            {tab === "login"
              ? "Login untuk lacak pesanan & checkout lebih cepat."
              : "Buat akun untuk menyimpan alamat & riwayat pesanan."}
          </DialogDescription>
        </DialogHeader>

        {/* Tab switcher */}
        <div className="flex gap-1 rounded-lg bg-secondary p-1">
          <button
            onClick={() => setTab("login")}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === "login" ? "bg-background shadow-sm" : "text-muted-foreground"
            }`}
          >
            <LogIn className="inline h-3.5 w-3.5 mr-1" />
            Masuk
          </button>
          <button
            onClick={() => setTab("register")}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === "register" ? "bg-background shadow-sm" : "text-muted-foreground"
            }`}
          >
            <UserPlus className="inline h-3.5 w-3.5 mr-1" />
            Daftar
          </button>
        </div>

        {tab === "login" ? (
          <LoginForm onSuccess={onSuccess} onSwitchToRegister={() => setTab("register")} />
        ) : (
          <RegisterForm onSuccess={onSuccess} onSwitchToLogin={() => setTab("login")} />
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// LoginForm
// ============================================================

function LoginForm({
  onSuccess,
  onSwitchToRegister,
}: {
  onSuccess: (c: CustomerPublic) => void;
  onSwitchToRegister: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [emailWarning, setEmailWarning] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Email dan password wajib diisi");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/customer/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });
      const data = await res.json();
      if (data.success && data.customer) {
        onSuccess(data.customer);
      } else {
        setError(data.message || "Login gagal");
      }
    } catch {
      setError("Koneksi gagal");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
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
          />
          {emailWarning && (
            <p className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-3 w-3 shrink-0" />
              {emailWarning}
            </p>
          )}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Password</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); if (error) setError(""); }}
            placeholder="••••••••"
            disabled={loading}
            className="pl-9 h-10"
          />
        </div>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button type="submit" disabled={loading} className="h-10 w-full">
        {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <LogIn className="h-4 w-4 mr-2" />}
        Masuk
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Belum punya akun?{" "}
        <button type="button" onClick={onSwitchToRegister} className="text-primary hover:underline font-medium">
          Daftar di sini
        </button>
      </p>
    </form>
  );
}

// ============================================================
// RegisterForm
// ============================================================

function RegisterForm({
  onSuccess,
  onSwitchToLogin,
}: {
  onSuccess: (c: CustomerPublic) => void;
  onSwitchToLogin: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    address: "",
    city: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [phoneWarning, setPhoneWarning] = useState("");
  const [emailWarning, setEmailWarning] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.phone || !form.password) {
      setError("Nama, email, telepon, dan password wajib diisi");
      return;
    }
    if (form.phone.length < 8 || form.phone.length > 15) {
      setError("Nomor telepon tidak valid (8-15 digit)");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/customer/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          password: form.password,
          defaultAddress: form.address || undefined,
          defaultCity: form.city || undefined,
        }),
        credentials: "include",
      });
      const data = await res.json();
      if (data.success && data.customer) {
        onSuccess(data.customer);
      } else {
        setError(data.message || "Pendaftaran gagal");
      }
    } catch {
      setError("Koneksi gagal");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Nama Lengkap *</Label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={form.name}
            onChange={(e) => { setForm({ ...form, name: e.target.value }); if (error) setError(""); }}
            placeholder="Budi Santoso"
            disabled={loading}
            className="pl-9 h-10"
            autoFocus
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Email *</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="email"
              value={form.email}
              onChange={(e) => {
                const val = e.target.value;
                if (val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
                  setEmailWarning("Format email belum benar");
                } else {
                  setEmailWarning("");
                }
                setForm({ ...form, email: val });
                if (error) setError("");
              }}
              placeholder="kamu@email.com"
              disabled={loading}
              className={cn("pl-9 h-10", emailWarning && "border-amber-500/50 ring-1 ring-amber-500/20")}
            />
            {emailWarning && (
              <p className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                <AlertCircle className="h-3 w-3 shrink-0" />
                {emailWarning}
              </p>
            )}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Telepon *</Label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="tel"
              value={form.phone}
              onChange={(e) => {
                const raw = e.target.value;
                if (/[^0-9]/.test(raw)) {
                  setPhoneWarning("Nomor telepon hanya boleh angka");
                } else {
                  setPhoneWarning("");
                }
                const cleaned = raw.replace(/[^0-9]/g, "").slice(0, 15);
                setForm({ ...form, phone: cleaned });
                if (error) setError("");
              }}
              placeholder="0812xxxxxxx"
              disabled={loading}
              className={cn("pl-9 h-10", phoneWarning && "border-amber-500/50 ring-1 ring-amber-500/20")}
              inputMode="numeric"
              pattern="[0-9]*"
            />
            {phoneWarning && (
              <p className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                <AlertCircle className="h-3 w-3 shrink-0" />
                {phoneWarning}
              </p>
            )}
          </div>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Password * <span className="text-muted-foreground">(min 6 karakter)</span></Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="password"
            value={form.password}
            onChange={(e) => { setForm({ ...form, password: e.target.value }); if (error) setError(""); }}
            placeholder="••••••••"
            disabled={loading}
            className="pl-9 h-10"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Alamat <span className="text-muted-foreground">(opsional, untuk prefill checkout)</span></Label>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            placeholder="Jl. Mawar No. 12, RT 02/RW 05..."
            disabled={loading}
            className="pl-9 h-10"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Kota <span className="text-muted-foreground">(opsional)</span></Label>
        <Input
          value={form.city}
          onChange={(e) => setForm({ ...form, city: e.target.value })}
          placeholder="Jakarta Selatan"
          disabled={loading}
          className="h-10"
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button type="submit" disabled={loading} className="h-10 w-full">
        {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserPlus className="h-4 w-4 mr-2" />}
        Daftar
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Sudah punya akun?{" "}
        <button type="button" onClick={onSwitchToLogin} className="text-primary hover:underline font-medium">
          Masuk di sini
        </button>
      </p>
    </form>
  );
}
