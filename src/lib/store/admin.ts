"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

// ============================================================
// Admin store — token + overlay open state (persisted).
// ============================================================
// Token stored in localStorage so admin doesn't re-enter every
// session. Token sent as `x-admin-token` header on all admin
// API calls. Clear on logout.
// ============================================================

interface AdminState {
  token: string | null;
  isOpen: boolean;
  setToken: (token: string) => void;
  logout: () => void;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

export const useAdminStore = create<AdminState>()(
  persist(
    (set) => ({
      token: null,
      isOpen: false,
      setToken: (token) => set({ token }),
      logout: () => set({ token: null, isOpen: false }),
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      toggle: () => set((s) => ({ isOpen: !s.isOpen })),
    }),
    { name: "sayurlogi-admin" }
  )
);
