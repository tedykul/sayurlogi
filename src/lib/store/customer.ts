import { create } from "zustand";
import type { CustomerPublic } from "@/lib/customer-auth";

// ============================================================
// Customer Store — in-memory customer state (NOT persisted).
// ============================================================
// The httpOnly cookie (customer_session) is the source of truth.
// This store just holds the fetched customer profile so the UI
// can render without a round-trip on every page. On mount, call
// fetchCustomer() which hits GET /api/customer/me — the cookie
// is sent automatically.
//
// authDialogOpen: controls the login/register dialog visibility.
// Opened by the "Masuk" button in the header.
// ============================================================

interface CustomerState {
  customer: CustomerPublic | null;
  loading: boolean;
  authDialogOpen: boolean;
  fetchCustomer: () => Promise<void>;
  setCustomer: (c: CustomerPublic | null) => void;
  openAuthDialog: () => void;
  closeAuthDialog: () => void;
  logout: () => Promise<void>;
}

export const useCustomerStore = create<CustomerState>()((set) => ({
  customer: null,
  loading: true,
  authDialogOpen: false,

  fetchCustomer: async () => {
    try {
      const res = await fetch("/api/customer/me", { credentials: "include" });
      if (!res.ok) {
        set({ customer: null, loading: false });
        return;
      }
      const data = await res.json();
      set({ customer: data.authed ? data.customer : null, loading: false });
    } catch {
      set({ customer: null, loading: false });
    }
  },

  setCustomer: (c) => set({ customer: c }),

  openAuthDialog: () => set({ authDialogOpen: true }),
  closeAuthDialog: () => set({ authDialogOpen: false }),

  logout: async () => {
    try {
      await fetch("/api/customer/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // ignore — client state clear is what matters
    }
    set({ customer: null });
  },
}));
