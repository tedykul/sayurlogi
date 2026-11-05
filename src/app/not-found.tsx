"use client";

// ============================================================
// not-found.tsx — Custom 404 page.
// ============================================================

import { SearchX, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <SearchX className="h-8 w-8 text-muted-foreground" />
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">404 — Halaman tidak ditemukan</h2>
          <p className="text-sm text-muted-foreground">
            Maaf, halaman yang Anda cari tidak tersedia atau sudah dipindahkan.
          </p>
        </div>
        <Button asChild variant="default" size="sm">
          <a href="/">
            <Home className="h-4 w-4 mr-2" />
            Kembali ke Beranda
          </a>
        </Button>
      </div>
    </div>
  );
}
