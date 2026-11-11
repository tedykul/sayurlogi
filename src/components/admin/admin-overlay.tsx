"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { SessionProvider, useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Lock, Loader2, AlertCircle, LogOut, Mail, UserCog,
  Home, Sparkles, Phone, HelpCircle, Users, MessageSquare,
  Layers, PanelBottom, PanelTop, ScrollText, Package, Palette,
  ShoppingCart, LayoutDashboard, Link2, Ticket, Star, Truck, Globe,
  Smartphone, Tablet, Monitor, Eye, EyeOff, Pencil, RotateCcw,
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
import { WelcomeBannerEditor } from "./sections/welcome-banner-editor";
import { GoogleAuthEditor } from "./sections/google-auth-editor";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
  | "welcome-banner"
  | "google-auth"
  | "users"
  | "audit"
  | "integration";

interface TabDef {
  id: Tab;
  label: string;
  icon: typeof Home;
  adminOnly?: boolean;
}

interface TabGroup {
  label: string;
  tabs: TabDef[];
}

// Sidebar tabs grouped into logical sections (J audit: a flat 21-item
// list caused cognitive overload — grouping reduces scan time and
// makes related editors discoverable). Order within groups preserved
// from the original flat list for backward familiarity.
const TAB_GROUPS: TabGroup[] = [
  {
    label: "Utama",
    tabs: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { id: "orders", label: "Pesanan", icon: Package },
      { id: "products", label: "Produk", icon: ShoppingCart },
    ],
  },
  {
    label: "Tampilan Halaman",
    tabs: [
      { id: "header", label: "Header", icon: PanelTop },
      { id: "hero", label: "Hero", icon: Home },
      { id: "promo", label: "Promo", icon: Sparkles },
      { id: "welcome-banner", label: "Banner", icon: Sparkles },
      { id: "about", label: "Tentang", icon: Users },
      { id: "testimonials", label: "Testimoni", icon: MessageSquare },
      { id: "faq", label: "FAQ", icon: HelpCircle },
      { id: "contact", label: "Kontak", icon: Phone },
      { id: "categories", label: "Kategori", icon: Layers },
      { id: "footer", label: "Footer", icon: PanelBottom },
    ],
  },
  {
    label: "Penjualan",
    tabs: [
      { id: "coupons", label: "Kupon", icon: Ticket },
      { id: "reviews", label: "Reviews", icon: Star },
      { id: "delivery", label: "Delivery", icon: Truck },
    ],
  },
  {
    label: "Sistem",
    tabs: [
      { id: "branding", label: "Branding", icon: Palette },
      { id: "google-auth", label: "Google Auth", icon: Globe },
      { id: "users", label: "Users", icon: UserCog, adminOnly: true },
      { id: "audit", label: "Audit Log", icon: ScrollText },
      { id: "integration", label: "Integrasi", icon: Link2 },
    ],
  },
];

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

type PreviewWidth = "full" | "tablet" | "mobile";

const PREVIEW_WIDTHS: Record<PreviewWidth, { label: string; icon: typeof Smartphone; maxWidth: string; px: string }> = {
  full: { label: "Desktop", icon: Monitor, maxWidth: "max-w-3xl", px: "1280px" },
  tablet: { label: "Tablet", icon: Tablet, maxWidth: "max-w-2xl", px: "768px" },
  mobile: { label: "Mobile", icon: Smartphone, maxWidth: "max-w-sm", px: "375px" },
};

function AdminOverlayInner({ open, onOpenChange }: AdminOverlayProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const overlayRef = useRef<HTMLDivElement>(null);
  // Lazy init: read UI flag + cached user from sessionStorage on
  // client, false/null on SSR. The flag is NOT authoritative —
  // checkAuthStatus() runs on mount to confirm against the server.
  const [authed, setAuthed] = useState(() => getAdminAuthedFlag());
  const [user, setUser] = useState<AdminUser | null>(() => getAdminUser());
  // mounted: false on SSR, true on client. Used to skip rendering
  // during hydration (avoid flash of login form when flag exists).
  const [mounted] = useState(() => typeof window !== "undefined");
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  // Preview Mode (Phase 1): when admin clicks "🔄 Preview", the overlay
  // minimizes to a floating FAB so user can see the live storefront with
  // their changes applied. All React state (authed, user, activeTab,
  // form drafts in child components) is PRESERVED because the component
  // stays mounted — only the rendered UI is swapped.
  // See Phase 2 for the FAB itself.
  const [previewMode, setPreviewMode] = useState(false);
  // Responsive preview frame (Phase 2): admin can constrain the
  // content area to mobile/tablet width to preview how content
  // editors look on smaller screens. Persisted in localStorage.
  const [previewWidth, setPreviewWidth] = useState<PreviewWidth>(() => {
    if (typeof window === "undefined") return "full";
    return (localStorage.getItem("admin-preview-width") as PreviewWidth) || "full";
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("admin-preview-width", previewWidth);
    }
  }, [previewWidth]);

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

  // Focus trap (E-audit): the overlay is role="dialog" aria-modal="true",
  // so keyboard focus must stay inside while open (WCAG 2.4.3).
  // On open: move focus to the first focusable element (the skip link
  // when authed). On close: restore focus to the trigger element.
  // Tab cycles within the overlay; Radix portals (dialogs/sheets opened
  // by sections) manage their own focus and are unaffected.
  useEffect(() => {
    if (!open) return;
    const el = overlayRef.current;
    if (!el) return;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    el.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusables = Array.from(
        el.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((node) => node.offsetParent !== null);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    el.addEventListener("keydown", onKeyDown);
    return () => {
      el.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus();
    };
  }, [open]);

  const handleLogout = async () => {
    await logoutAdmin();
    setUser(null);
    setAuthed(false);
    toast.success("Logged out dari admin");
  };

  // Preview: refresh storefront + MINIMIZE overlay to FAB so user can
  // actually SEE the changes (was: only router.refresh() + toast → user
  // saw nothing change because overlay covered the storefront).
  //
  // State preservation guarantee: setting previewMode=true does NOT
  // unmount AdminOverlayInner. The return null branch below only
  // affects what's rendered. All useState values (authed, user,
  // activeTab) + child component form drafts remain in memory. When
  // user clicks the FAB to restore, previewMode=false → overlay fades
  // back in with everything exactly as it was left.
  //
  // router.refresh() re-renders server components (page content from
  // DB); the custom event tells HomeClient to re-fetch client-side
  // data (products).
  const handlePreview = () => {
    router.refresh();
    window.dispatchEvent(new CustomEvent("sayurlogi:content-refresh"));
    setPreviewMode(true);
    toast.success("Preview aktif", {
      description: "Klik tombol Admin di pojok untuk kembali edit.",
    });
  };

  // Restore overlay from preview mode (called by the FAB in Phase 2).
  // No re-fetch needed — state preserved during preview.
  const handleExitPreview = () => {
    setPreviewMode(false);
  };

  // Don't render anything until mounted (avoid hydration flash)
  // OR when previewMode is active → overlay minimized to FAB (Phase 2).
  // Component state (authed, user, activeTab, child form drafts) is
  // PRESERVED because the React tree stays mounted — only the DOM
  // output is suppressed.
  if (!mounted || !open) return null;
  if (previewMode) {
    return (
      <AnimatePresence>
        <PreviewFab key="preview-fab" onRestore={handleExitPreview} />
      </AnimatePresence>
    );
  }

  const canSeeAdminTabs = user?.role === "super_admin" || user?.role === "admin";
  const visibleGroups = TAB_GROUPS.map((g) => ({
    ...g,
    tabs: g.tabs.filter((t) => !t.adminOnly || canSeeAdminTabs),
  })).filter((g) => g.tabs.length > 0);

  return (
    <AnimatePresence>
      <motion.div
        ref={overlayRef}
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
            {/* Skip link (E-audit a11y): keyboard users can jump past
                the sidebar nav straight to the editor content. */}
            <a
              href="#admin-main-content"
              className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[60] focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground focus:shadow-lg"
            >
              Lewati ke konten utama
            </a>
            {/* Top bar */}
            <header className="flex items-center justify-between border-b border-border bg-secondary/50 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
                  S
                </div>
                <div>
                  <h1 className="text-sm font-bold leading-tight">SayurLogi Admin</h1>
                  <p className="text-xs text-muted-foreground leading-tight">
                    Content Management
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Current user display (name + role badge) */}
                {user && (
                  <div className="hidden md:flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-primary text-xs font-bold">
                      {(user.name || user.email).charAt(0).toUpperCase()}
                    </div>
                    <div className="leading-tight">
                      <p className="text-[11px] font-semibold">{user.name || user.email}</p>
                      <RoleBadge role={user.role} />
                    </div>
                  </div>
                )}
                {/* Responsive preview frame toggle (Phase 2): constrains
                    the editor content width to simulate mobile/tablet/desktop.
                    Only visible on md+ (mobile sidebar already collapses). */}
                <div className="hidden md:flex items-center rounded-lg border border-border bg-card p-0.5" role="group" aria-label="Lebar preview konten">
                  {(Object.keys(PREVIEW_WIDTHS) as PreviewWidth[]).map((w) => {
                    const cfg = PREVIEW_WIDTHS[w];
                    const active = previewWidth === w;
                    return (
                      <button
                        key={w}
                        type="button"
                        onClick={() => setPreviewWidth(w)}
                        className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                          active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent"
                        )}
                        aria-label={`Preview ${cfg.label} (${cfg.px})`}
                        aria-pressed={active}
                        title={`Preview ${cfg.label} (${cfg.px})`}
                      >
                        <cfg.icon className="h-3.5 w-3.5" />
                      </button>
                    );
                  })}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handlePreview}
                  className="h-8 text-xs"
                  title="Muat ulang konten storefront (admin tetap terbuka)"
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
              {/* Sidebar — grouped tabs. On mobile (<md) it collapses to
                  an icon-only rail; labels stay in the a11y tree via
                  sr-only so icon-only buttons keep their accessible
                  name (E-audit). */}
              <nav
                className="w-16 md:w-48 shrink-0 border-r border-border bg-secondary/30 overflow-y-auto scrollbar-grocery"
                aria-label="Navigasi admin"
              >
                <div className="p-2">
                  {visibleGroups.map((group, gi) => (
                    <div
                      key={group.label}
                      className={
                        gi > 0
                          ? "mt-2 border-t border-border/60 pt-2 md:mt-0 md:border-0 md:pt-3"
                          : undefined
                      }
                    >
                      <p
                        aria-hidden="true"
                        className="hidden md:block px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                      >
                        {group.label}
                      </p>
                      <ul className="space-y-1">
                        {group.tabs.map((tab) => (
                          <li key={tab.id}>
                            <button
                              onClick={() => setActiveTab(tab.id)}
                              className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium transition-colors ${
                                activeTab === tab.id
                                  ? "bg-primary text-primary-foreground"
                                  : "text-foreground hover:bg-accent"
                              }`}
                              aria-current={activeTab === tab.id ? "page" : undefined}
                              title={tab.label}
                            >
                              <tab.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                              <span className="sr-only md:not-sr-only">{tab.label}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </nav>

              {/* Content area — target of the skip link above.
                  Width is constrained by the preview frame toggle
                  (mobile/tablet/full). When constrained, content is
                  centered with a subtle backdrop to show the boundary. */}
              <div
                id="admin-main-content"
                className={cn(
                  "flex-1 overflow-y-auto scrollbar-grocery p-4 md:p-6 transition-all",
                  previewWidth !== "full" && "bg-secondary/20"
                )}
                tabIndex={-1}
              >
                <div className={cn("mx-auto", PREVIEW_WIDTHS[previewWidth].maxWidth)}>
                  {previewWidth !== "full" && (
                    <p className="mb-3 text-center text-xs font-medium text-muted-foreground">
                      📱 Preview {PREVIEW_WIDTHS[previewWidth].label} — {PREVIEW_WIDTHS[previewWidth].px}
                    </p>
                  )}
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
                  {activeTab === "welcome-banner" && <WelcomeBannerEditor />}
                  {activeTab === "google-auth" && <GoogleAuthEditor />}
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
// PreviewFab — floating button shown when admin is in Preview Mode.
// ============================================================
// Phase 2 of the preview-minimize feature. When admin clicks "🔄 Preview",
// AdminOverlayInner returns <PreviewFab /> instead of the full overlay.
// The storefront underneath is fully visible (overlay is hidden), and
// this FAB floats at the bottom-right as the only visible "admin still
// active" affordance.
//
// Click the FAB → onRestore() → AdminOverlayInner re-renders the full
// overlay with all state preserved (authed, activeTab, form drafts).
//
// Keyboard: Esc restores the overlay (mirrors the dialog Esc pattern).
//
// z-index: 150 (above bottom nav z-40, below sub-modals z-200).
// Mobile: bottom-20 (above the 64px bottom nav + safe area).
// Desktop: bottom-6.
// ============================================================

interface PreviewFabProps {
  onRestore: () => void;
}

function PreviewFab({ onRestore }: PreviewFabProps) {
  // Esc key restores the overlay (matches dialog Esc-to-close convention).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onRestore();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onRestore]);

  return (
    <motion.button
      type="button"
      onClick={onRestore}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="fixed bottom-20 md:bottom-6 right-4 z-[150] flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-4 py-3 shadow-lg shadow-primary/40 hover:scale-105 active:scale-95 transition-transform"
      aria-label="Kembali ke admin editor"
      title="Klik untuk kembali edit (Esc juga bisa)"
    >
      <Pencil className="h-4 w-4" />
      <span className="text-sm font-semibold">Admin</span>
      {/* Pulse indicator — subtle "preview mode active" signal */}
      <span className="h-2 w-2 rounded-full bg-emerald-300 animate-pulse" aria-hidden="true" />
    </motion.button>
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
  // Show/hide password toggle — helps user verify what they typed,
  // especially on mobile where autocorrect + masked dots make errors
  // common (user report: "password admin salah" → often a typo).
  const [showPassword, setShowPassword] = useState(false);

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
            <p className="text-xs text-muted-foreground">
              Kosongkan email untuk login pakai password admin lama.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="admin-password" className="text-xs font-medium">
              Password Admin
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="admin-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError("");
                }}
                placeholder="Masukkan password..."
                disabled={loading}
                autoFocus={!email}
                aria-invalid={!!error}
                className="pl-9 pr-10"
                autoComplete="current-password"
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

        <p className="mt-4 text-center text-xs text-muted-foreground">
          💡 Hint: Tekan <kbd className="rounded bg-secondary px-1">Ctrl+Shift+A</kbd> untuk buka admin
        </p>
      </motion.div>
    </div>
  );
}
