"use client";

// ============================================================
// error.tsx — Global error boundary (Next.js App Router).
// ============================================================
// Catches unhandled runtime errors in any route segment.
// Shows user-friendly message + retry button.
// Logs error to console for admin debugging.
// ============================================================

import { useEffect } from "react";
import { AlertCircle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to console (admin can check server logs)
    console.error("[app-error]", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold">Terjadi kesalahan</h2>
          <p className="text-sm text-muted-foreground">
            Maaf, halaman ini mengalami gangguan. Coba muat ulang atau kembali ke beranda.
          </p>
        </div>
        <div className="flex gap-2 justify-center">
          <Button onClick={reset} variant="default" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Coba lagi
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href="/">
              <Home className="h-4 w-4 mr-2" />
              Beranda
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
