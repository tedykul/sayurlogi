import { Suspense } from "react";
import { HomeClient } from "./home-client";

// ============================================================
// Server component — wraps HomeClient in Suspense because
// HomeClient uses useSearchParams() (requires Suspense boundary
// in Next.js 16 App Router for static rendering).
// ============================================================

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Memuat...</div>
        </div>
      }
    >
      <HomeClient />
    </Suspense>
  );
}
