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
const GIS_LOAD_TIMEOUT_MS = 15000;

function loadGisScript(): Promise<void> {
  if (gisLoaded) return Promise.resolve();
  if (gisLoadPromise) return gisLoadPromise;

  const attempt = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GIS_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    const timer = window.setTimeout(() => {
      script.remove();
      reject(new Error("Timeout memuat Google Identity Services (15s)."));
    }, GIS_LOAD_TIMEOUT_MS);
    script.onload = () => {
      window.clearTimeout(timer);
      gisLoaded = true;
      resolve();
    };
    script.onerror = () => {
      window.clearTimeout(timer);
      script.remove();
      reject(new Error("Gagal memuat Google Identity Services."));
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
  const [retryNonce, setRetryNonce] = useState(0);
  const buttonRef = useRef<HTMLDivElement>(null);

  // Load GIS script on mount (retryNonce bumps force a retry)
  useEffect(() => {
    let cancelled = false;
    setGisError(false);
    loadGisScript()
      .then(() => {
        if (cancelled) return;
        setGisReady(true);
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn("[GoogleSignInButton] GIS load failed:", err);
        setGisError(true);
      });
    return () => {
      cancelled = true;
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
      <div
        role="button"
        tabIndex={0}
        onClick={() => setRetryNonce((n) => n + 1)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setRetryNonce((n) => n + 1);
        }}
        className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-border bg-muted/30 text-sm text-muted-foreground transition-colors hover:bg-muted/60"
      >
        <AlertCircle className="h-4 w-4 shrink-0" />
        Gagal memuat Google. Ketuk untuk coba lagi.
      </div>
    );
  }

  if (!gisReady) {
    return (
      <div className="flex h-11 items-center justify-center gap-2 rounded-full border border-border bg-muted/30 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Memuat Google...
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
