"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import type { CustomerPublic } from "@/lib/customer-auth";

// ============================================================
// GoogleSignInButton — renders Google Sign-In button via GIS.
// ============================================================
// Uses Google Identity Services (GIS) to render the official
// Google button. On click, Google returns an ID token (JWT) which
// is sent to /api/customer/google-login for verification.
//
// Props:
//   onSuccess — called when login succeeds (customer profile passed)
//   onError — called when login fails (error message passed)
//
// The component loads GIS script dynamically (only when this
// component mounts) to avoid loading Google scripts on every page.
//
// Behavior:
//   - Shows a styled Google button (Google branding colors).
//   - On click: Google popup → user consents → ID token returned.
//   - ID token sent to API → verified server-side → session created.
//   - On success: onSuccess(customer) called.
//   - On error: toast + onError(message) called.
// ============================================================

interface GoogleSignInButtonProps {
  clientId: string;
  onSuccess: (customer: CustomerPublic) => void;
  onError?: (message: string) => void;
}

// Google Identity Services script URL
const GIS_SCRIPT_URL = "https://accounts.google.com/gsi/client";

// Load GIS script once (cached across all instances)
let gisLoaded = false;
let gisLoadPromise: Promise<void> | null = null;

// Batas waktu memuat script GIS. Jaringan terblokir/buruk bisa
// menggantung request tanpa pernah memicu onerror — tanpa timeout,
// tombol menampilkan spinner selamanya.
const GIS_LOAD_TIMEOUT_MS = 10000;

/**
 * Cek apakah GIS API sudah siap di window.google.accounts.id.
 * Kadang script.onload fires TAPI window.google.accounts.id belum
 * siap (race condition Google). Polling untuk memastikan API benar-benar
 * siap sebelum declare "ready".
 */
function isGisApiReady(): boolean {
  return typeof window !== "undefined" && !!window.google?.accounts?.id;
}

/**
 * Tunggu GIS API siap dengan polling. Resolve begitu window.google.accounts.id
 * tersedia, atau reject kalau timeout. Dipakai sebagai watchdog setelah
 * script.onload fire — supaya kita tidak declare "ready" sebelum API siap.
 */
function waitForGisApi(timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (isGisApiReady()) return resolve();
    const start = Date.now();
    const interval = window.setInterval(() => {
      if (isGisApiReady()) {
        window.clearInterval(interval);
        resolve();
        return;
      }
      if (Date.now() - start > timeoutMs) {
        window.clearInterval(interval);
        reject(new Error("GIS API tidak siap dalam waktu yang wajar."));
      }
    }, 100);
  });
}

function loadGisScript(): Promise<void> {
  if (gisLoaded && isGisApiReady()) return Promise.resolve();
  if (gisLoadPromise) return gisLoadPromise;

  const attempt = new Promise<void>((resolve, reject) => {
    // Kalau GIS sudah pernah dimuat di session lain (misal user
    // buka dialog, tutup, buka lagi), window.google mungkin sudah
    // ada — skip append script baru.
    if (isGisApiReady()) {
      gisLoaded = true;
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = GIS_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    const timer = window.setTimeout(() => {
      script.remove();
      reject(new Error("Timeout memuat Google Identity Services (10s)."));
    }, GIS_LOAD_TIMEOUT_MS);
    script.onload = () => {
      window.clearTimeout(timer);
      // Jangan langsung resolve — tunggu API siap (race condition fix).
      // Google set window.google.accounts.id secara async di beberapa
      // browser; resolve begitu siap, atau watchdog timeout.
      waitForGisApi(3000)
        .then(() => {
          gisLoaded = true;
          resolve();
        })
        .catch(() => {
          // Script loaded TAPI window.google.accounts.id belum ada
          // setelah 3s polling — kemungkinan CSP block atau script
          // corrupt. Treat sebagai gagal.
          script.remove();
          gisLoaded = false;
          reject(new Error("GIS script loaded tapi API tidak terdeteksi (kemungkinan CSP/origin block)."));
        });
    };
    script.onerror = () => {
      window.clearTimeout(timer);
      script.remove();
      reject(new Error("Gagal memuat Google Identity Services (script.onerror)."));
    };
    document.head.appendChild(script);
  });

  // Reset cache saat gagal supaya retry benar-benar mengunduh ulang
  // (tanpa ini, promise rejected/pending ter-cache selamanya).
  gisLoadPromise = attempt.catch((err) => {
    gisLoadPromise = null;
    throw err;
  });
  return gisLoadPromise;
}

export function GoogleSignInButton({ clientId, onSuccess, onError }: GoogleSignInButtonProps) {
  const [loading, setLoading] = useState(false);
  const [gisReady, setGisReady] = useState(false);
  const [gisError, setGisError] = useState(false);
  // slowHint: true kalau loading > 4s — beri tahu user ada masalah
  const [slowHint, setSlowHint] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const buttonRef = useRef<HTMLDivElement>(null);

  // Load GIS script on mount (retryNonce bumps force a retry)
  useEffect(() => {
    let cancelled = false;
    setGisError(false);
    setSlowHint(false);
    // Setelah 4s masih loading → tampilkan hint (jangan tunggu 10s)
    const slowTimer = window.setTimeout(() => {
      if (!cancelled) setSlowHint(true);
    }, 4000);
    loadGisScript()
      .then(() => {
        if (cancelled) return;
        window.clearTimeout(slowTimer);
        setSlowHint(false);
        setGisReady(true);
      })
      .catch((err) => {
        if (cancelled) return;
        window.clearTimeout(slowTimer);
        console.warn("[GoogleSignInButton] GIS load failed:", err);
        setGisError(true);
      });
    return () => {
      cancelled = true;
      window.clearTimeout(slowTimer);
    };
  }, [retryNonce]);

  // Render Google button via GIS when ready
  useEffect(() => {
    if (!gisReady || !buttonRef.current || !window.google?.accounts?.id) return;

    try {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredentialResponse,
      });

      // Render the button inside the ref div
      window.google.accounts.id.renderButton(buttonRef.current, {
        type: "standard",
        shape: "pill",
        size: "large",
        text: "continue_with",
        width: 320,
        locale: "id",
      });
    } catch (err) {
      console.warn("[GoogleSignInButton] render failed:", err);
    }
  }, [gisReady, clientId]);

  const handleCredentialResponse = async (response: { credential: string }) => {
    setLoading(true);
    try {
      const res = await fetch("/api/customer/google-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: response.credential }),
        credentials: "include",
      });
      const data = await res.json();
      if (data.success && data.customer) {
        if (data.isNewUser) {
          toast.success("Akun Google berhasil dibuat! Lengkapi nomor telepon di profil.");
        } else {
          toast.success("Berhasil masuk dengan Google!");
        }
        onSuccess(data.customer);
      } else {
        const msg = data.message || "Login Google gagal";
        toast.error(msg);
        onError?.(msg);
      }
    } catch {
      const msg = "Koneksi gagal. Coba lagi.";
      toast.error(msg);
      onError?.(msg);
    } finally {
      setLoading(false);
    }
  };

  if (gisError) {
    return (
      <button
        type="button"
        onClick={() => setRetryNonce((n) => n + 1)}
        className="flex w-full flex-col items-center gap-1 rounded-xl border border-amber-300/50 bg-amber-50 p-3 text-center text-xs text-amber-700 transition-colors hover:bg-amber-100 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-300"
      >
        <span className="flex items-center gap-1.5 font-medium">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Gagal memuat Google Sign-In
        </span>
        <span className="text-[10px] leading-tight opacity-80">
          Periksa koneksi internet + pastikan origin sudah terdaftar di Google Cloud Console.
        </span>
        <span className="mt-1 text-[10px] font-semibold underline">Ketuk untuk coba lagi</span>
      </button>
    );
  }

  if (!gisReady) {
    return (
      <div className="flex flex-col items-center gap-1 rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Memuat Google...
        </div>
        {slowHint && (
          <p className="text-[10px] leading-tight text-amber-600 dark:text-amber-400">
            Memuat lebih lama dari biasanya. Pastikan koneksi internet stabil.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-full bg-background/80 backdrop-blur-sm">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        </div>
      )}
      {/* Google renders the button inside this div */}
      <div ref={buttonRef} className="flex justify-center" />
    </div>
  );
}

// TypeScript declarations for Google Identity Services
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: "standard" | "icon";
              shape?: "rectangular" | "pill" | "circle" | "square";
              size?: "large" | "medium" | "small";
              text?: "signin_with" | "signup_with" | "continue_with" | "signin";
              width?: number;
              locale?: string;
            }
          ) => void;
        };
      };
    };
  }
}
