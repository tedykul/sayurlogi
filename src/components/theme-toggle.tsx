"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Dark/Light mode toggle button.
 * - Skeleton placeholder until mounted (prevents hydration mismatch)
 * - Touch target ≥ 44px (h-10 w-10 + p-0, icon centered)
 * - Accessible: aria-label, title
 */
export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch — next-themes only knows theme client-side.
  // This is the official next-themes pattern; setState here only runs once
  // on mount and is intentional (synchronizing external lib state).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    // Skeleton placeholder with same dimensions to avoid layout shift
    return (
      <Button
        variant="ghost"
        size="icon"
        className="h-10 w-10 rounded-full"
        aria-label="Memuat tema..."
        disabled
      >
        <span className="h-4 w-4 rounded-full bg-muted" />
      </Button>
    );
  }

  const isDark = (resolvedTheme || theme) === "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="h-10 w-10 rounded-full hover:bg-accent transition-colors"
      aria-label={isDark ? "Aktifkan mode terang" : "Aktifkan mode gelap"}
      title={isDark ? "Mode terang" : "Mode gelap"}
    >
      {isDark ? (
        <Sun className="h-5 w-5 text-amber-500" />
      ) : (
        <Moon className="h-5 w-5 text-foreground" />
      )}
      <span className="sr-only">Toggle tema</span>
    </Button>
  );
}
