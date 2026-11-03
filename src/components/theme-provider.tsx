"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ThemeProviderProps } from "next-themes";

/**
 * Wraps the app with next-themes provider.
 * - attribute="class" → toggles `.dark` on <html>
 * - defaultTheme="system" → respects OS preference
 * - enableSystem → auto-detect prefers-color-scheme
 * - disableTransitionOnChange → prevents flash on toggle
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
