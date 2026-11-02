"use client";

import { useEffect } from "react";
import { useAdminStore } from "@/lib/store/admin";
import { AdminLogin } from "./admin-login";
import { AdminDashboard } from "./admin-dashboard";

// ============================================================
// AdminOverlay — conditional render based on auth state.
// ============================================================
// - No token → show AdminLogin dialog
// - Has token → show AdminDashboard (in a sheet)
// Keyboard shortcut: Ctrl+Shift+A toggles the overlay.
// ============================================================

export function AdminOverlay() {
  const { token, isOpen, close } = useAdminStore();

  // Listen for Ctrl+Shift+A keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === "A" || e.key === "a")) {
        e.preventDefault();
        useAdminStore.getState().toggle();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      {!token && isOpen && <AdminLogin open={isOpen} onclose={close} />}
      {token && isOpen && <AdminDashboard onClose={close} />}
    </>
  );
}
