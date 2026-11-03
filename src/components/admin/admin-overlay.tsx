"use client";

import { useState, useEffect } from "react";
import { SessionProvider, useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Lock, Loader2, AlertCircle, LogOut, Mail, UserCog,
  Home, Sparkles, Phone, HelpCircle, Users, MessageSquare,
  Layers, PanelBottom, PanelTop, ScrollText, Package, Palette,
  ShoppingCart, LayoutDashboard, Link2, Ticket, Star, Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  getAdminAuthedFlag,
  getAdminUser,
  loginAdminNextAuth,
  loginAdminLegacy,
  logoutAdmin,
  checkAuthStatus,
  setCurrentUserId,
  setAdminUser,
  type AdminUser,
  type AdminRole,
} from "@/lib/admin-client";
import { HeroPromoContactEditor } from "./sections/hero-promo-contact-editor";
import { FaqEditor } from "./sections/faq-editor";
import { TestimonialEditor } from "./sections/testimonial-editor";
import { AboutEditor } from "./sections/about-editor";
import { CategoryEditor } from "./sections/category-editor";
import { FooterEditor } from "./sections/footer-editor";
import { AuditLogViewer } from "./sections/audit-log-viewer";
import { OrderEditor } from "./sections/order-editor";
import { BrandSettingsEditor } from "./sections/brand-settings-editor";
import { ProductEditor } from "./sections/product-editor";
import { UserEditor } from "./sections/user-editor";
import { HeaderEditor } from "./sections/header-editor";
import { DashboardEditor } from "./sections/dashboard-editor";
import { IntegrationEditor } from "./sections/integration-editor";
import { CouponEditor } from "./sections/coupon-editor";
import { ReviewEditor } from "./sections/review-editor";
import { DeliveryEditor } from "./sections/delivery-editor";
import { toast } from "sonner";

// ============================================================
// AdminOverlay — full-screen content management overlay.
// ============================================================
// Mount in page.tsx (hidden by default). Open via:
//   - Footer admin button (gear icon)
//   - Keyboard shortcut Ctrl+Shift+A
// Login gate (email + password) → if no token in sessionStorage,
// show login form. Empty email = legacy password-only gate.
//
// Outer component wraps everything in SessionProvider (NextAuth)
// so child sections can use useSession(). Inner component holds
// the actual state + UI.
// ============================================================

interface AdminOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AdminOverlay(props: AdminOverlayProps) {
  return (
    <SessionProvider>
      <AdminOverlayInner {...props} />
    </SessionProvider>
  );
}

type Tab =
  | "dashboard"
  | "orders"
  | "products"
  | "header"
  | "hero"
  | "promo"
  | "contact"
  | "faq"
  | "testimonials"
  | "about"
  | "categories"
  | "footer"
  | "branding"
  | "coupons"
  | "reviews"
  | "delivery"
  | "users"
  | "audit"
  | "integration";

interface TabDef {
  id: Tab;
  label: string;
  icon: typeof Home;
  adminOnly?: boolean;
}

const TABS: TabDef[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "orders", label: "Pesanan", icon: Package },
  { id: "products", label: "Produk", icon: ShoppingCart },
  { id: "header", label: "Header", icon: PanelTop },
  { id: "hero", label: "Hero", icon: Home },
  { id: "promo", label: "Promo", icon: Sparkles },
  { id: "contact", label: "Kontak", icon: Phone },
  { id: "faq", label: "FAQ", icon: HelpCircle },
  { id: "testimonials", label: "Testimoni", icon: MessageSquare },
  { id: "about", label: "Tentang", icon: Users },
  { id: "categories", label: "Kategori", icon: Layers },
  { id: "footer", label: "Footer", icon: PanelBottom },
  { id: "branding", label: "Branding", icon: Palette },
  { id: "coupons", label: "Kupon", icon: Ticket },
  { id: "reviews", label: "Reviews", icon: Star },
  { id: "delivery", label: "Delivery", icon: Truck },
  { id: "users", label: "Users", icon: UserCog, adminOnly: true },
  { id: "audit", label: "Audit Log", icon: ScrollText },
  { id: "integration", label: "Integrasi", icon: Link2 },
];

function AdminOverlayInner({ open, onOpenChange }: AdminOverlayProps) {
  const { data: session } = useSession();
  // Lazy init: read UI flag + cached user from sessionStorage on
  // client, false/null on SSR. The flag is NOT authoritative —
  // checkAuthStatus() runs on mount to confirm against the server.
  const [authed, setAuthed] = useState(() => getAdminAuthedFlag());
  const [user, setUser] = useState<AdminUser | null>(() => getAdminUser());
  // mounted: false on SSR, true on client. Used to skip rendering
  // during hydration (avoid flash of login form when flag exists).
  const [mounted] = useState(() => typeof window !== "undefined");
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");

  // On mount: always validate the session against the server.
  // The httpOnly cookie is sent automatically; if valid, populate
  // user + keep authed=true. If invalid, clear the UI cache so the
  // login form shows.
  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;
    checkAuthStatus().then((u) => {
      if (cancelled) return;
      if (u) {
        setUser(u);
        setCurrentUserId(u.id);
        setAuthed(true);
      } else {
        setAdminUser(null);
        setUser(null);
        setAuthed(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [mounted]);

  // Keyboard shortcut: Ctrl+Shift+A toggles admin
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "A") {
        e.preventDefault();
        onOpenChange(!open);
      }
      if (e.key === "Escape" && open) {
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const handleLogout = async () => {
    await logoutAdmin();
    setUser(null);
    setAuthed(false);
    toast.success("Logged out dari admin");
  };

  // Don't render anything until mounted (avoid hydration flash)
  if (!mounted || !open) return null;

  const visibleTabs = TABS.filter((t) => !t.adminOnly || user?.role === "super_admin" || user?.role === "admin");

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[100] bg-background"
        role="dialog"
        aria-label="Admin dashboard"
        aria-modal="true"
      >
        {!authed ? (
          <LoginGate
            onSuccess={(u) => {
              setUser(u);
              if (u?.id) setCurrentUserId(u.id);
              setAuthed(true);
            }}
            onClose={() => onOpenChange(false)}
          />
        ) : (
          <div className="flex h-full flex-col">
            {/* Top bar */}
            <header className="flex items-center justify-between border-b border-border bg-secondary/50 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
                  S
                </div>
                <div>
                  <h1 className="text-sm font-bold leading-tight">SayurLogi Admin</h1>
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    Content Management
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Current user display (name + role badge) */}
                {user && (
                  <div className="hidden md:flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-primary text-[10px] font-bold">
                      {(user.name || user.email).charAt(0).toUpperCase()}
                    </div>
                    <div className="leading-tight">
                      <p className="text-[11px] font-semibold">{user.name || user.email}</p>
                      <RoleBadge role={user.role} />
                    </div>
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.location.reload()}
                  className="h-8 text-xs"
                  title="Reload halaman untuk lihat perubahan"
                >
                  🔄 Preview
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="h-8 text-xs"
                >
                  <LogOut className="h-3.5 w-3.5 mr-1" />
                  Logout
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onOpenChange(false)}
                  className="h-8 w-8"
                  aria-label="Tutup admin"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </header>

            {/* Body: sidebar + content */}
            <div className="flex flex-1 overflow-hidden">
              {/* Sidebar */}
              <nav className="w-16 md:w-48 shrink-0 border-r border-border bg-secondary/30 overflow-y-auto scrollbar-grocery">
                <ul className="p-2 space-y-1">
                  {visibleTabs.map((tab) => (
                    <li key={tab.id}>
                      <button
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium transition-colors ${
                          activeTab === tab.id
                            ? "bg-primary text-primary-foreground"
                            : "text-foreground hover:bg-accent"
                        }`}
                        aria-current={activeTab === tab.id ? "page" : undefined}
                      >
                        <tab.icon className="h-4 w-4 shrink-0" />
                        <span className="hidden md:inline">{tab.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </nav>

              {/* Content area */}
              <div className="flex-1 overflow-y-auto scrollbar-grocery p-4 md:p-6">
                <div className="mx-auto max-w-3xl">
                  {activeTab === "dashboard" && <DashboardEditor />}
                  {activeTab === "orders" && <OrderEditor />}
                  {activeTab === "products" && <ProductEditor />}
                  {activeTab === "header" && <HeaderEditor />}
                  {activeTab === "hero" && <HeroPromoContactEditor section="hero" />}
                  {activeTab === "promo" && <HeroPromoContactEditor section="promo" />}
                  {activeTab === "contact" && <HeroPromoContactEditor section="contact" />}
                  {activeTab === "faq" && <FaqEditor />}
                  {activeTab === "testimonials" && <TestimonialEditor />}
                  {activeTab === "about" && <AboutEditor />}
                  {activeTab === "categories" && <CategoryEditor />}
                  {activeTab === "footer" && <FooterEditor />}
                  {activeTab === "branding" && <BrandSettingsEditor />}
                  {activeTab === "coupons" && <CouponEditor />}
                  {activeTab === "reviews" && <ReviewEditor />}
                  {activeTab === "delivery" && <DeliveryEditor />}
                  {activeTab === "users" && <UserEditor />}
                  {activeTab === "audit" && <AuditLogViewer />}
                  {activeTab === "integration" && <IntegrationEditor />}
                </div>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

// ============================================================
// RoleBadge — colored pill for admin role
// ============================================================
function RoleBadge({ role }: { role: AdminRole }) {
  const label =
    role === "super_admin" ? "Super Admin" : role === "admin" ? "Admin" : "Staff";
  const cls =
    role === "super_admin"
      ? "bg-violet-500/15 text-violet-700 dark:text-violet-300"
      : role === "admin"
      ? "bg-blue-500/15 text-blue-700 dark:text-blue-300"
      : "bg-slate-500/15 text-slate-700 dark:text-slate-300";
  return (
    <Badge variant="secondary" className={`text-[9px] px-1 py-0 ${cls}`}>
      {label}
    </Badge>
  );
}

// ============================================================
// LoginGate — email + password form
// ============================================================
// Email field is optional. Empty email → legacy password gate
// (password only). Filled email → NextAuth credentials login.
// ============================================================
function LoginGate({
  onSuccess,
  onClose,
}: {
  onSuccess: (user: AdminUser | null) => void;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError("Password diperlukan");
      return;
    }
    setLoading(true);
    setError("");
    // Email empty → legacy gate. Email filled → NextAuth.
    const result = email.trim()
      ? await loginAdminNextAuth(email.trim(), password)
      : await loginAdminLegacy(password);
    setLoading(false);
    if (result.success) {
      onSuccess(result.user ?? null);
      toast.success("Login berhasil!");
    } else {
      setError(result.message || "Login gagal");
    }
  };

  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">Admin Login</h2>
              <p className="text-xs text-muted-foreground">SayurLogi Content Manager</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Tutup"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="admin-email" className="text-xs font-medium">
              Email <span className="text-muted-foreground font-normal">(opsional)</span>
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="admin-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError("");
                }}
                placeholder="kamu@sayurlogi.id (kosongkan untuk password gate)"
                disabled={loading}
                className="pl-9"
                autoComplete="email"
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              Kosongkan email untuk login pakai password admin lama.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="admin-password" className="text-xs font-medium">
              Password Admin
            </Label>
            <Input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError("");
              }}
              placeholder="Masukkan password..."
              disabled={loading}
              autoFocus={!email}
              aria-invalid={!!error}
            />
          </div>

          {error && (
            <p className="flex items-center gap-1 text-xs text-destructive" role="alert">
              <AlertCircle className="h-3 w-3" />
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-10 rounded-lg"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Memverifikasi...
              </>
            ) : (
              <>
                <Lock className="h-4 w-4 mr-2" />
                Masuk
              </>
            )}
          </Button>
        </form>

        <p className="mt-4 text-center text-[10px] text-muted-foreground">
          💡 Hint: Tekan <kbd className="rounded bg-secondary px-1">Ctrl+Shift+A</kbd> untuk buka admin
        </p>
      </motion.div>
    </div>
  );
}
