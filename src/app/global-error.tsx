"use client";

// ============================================================
// global-error.tsx — Catches errors in root layout.
// ============================================================
// This is needed because error.tsx does NOT catch errors in
// the root layout itself. global-error.tsx replaces the entire
// HTML document, so it needs its own <html> + <body> tags.
// ============================================================

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="id">
      <body
        style={{
          margin: 0,
          padding: 0,
          fontFamily: "system-ui, -apple-system, sans-serif",
          background: "#f8fafc",
          color: "#1e293b",
        }}
      >
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
        >
          <div style={{ maxWidth: "400px", textAlign: "center" }}>
            <div
              style={{
                width: "64px",
                height: "64px",
                margin: "0 auto 16px",
                borderRadius: "50%",
                background: "#fee2e2",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "32px",
              }}
            >
              ⚠️
            </div>
            <h2 style={{ fontSize: "20px", fontWeight: "bold", margin: "0 0 8px" }}>
              Aplikasi bermasalah
            </h2>
            <p style={{ fontSize: "14px", color: "#64748b", margin: "0 0 24px" }}>
              Maaf, terjadi kesalahan teknis. Tim kami sudah diberi notifikasi.
              Silakan coba muat ulang halaman.
            </p>
            <button
              onClick={reset}
              style={{
                background: "#16a34a",
                color: "white",
                border: "none",
                padding: "10px 24px",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              Muat Ulang
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
