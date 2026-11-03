// ============================================================
// API helpers — typed fetch wrappers with admin token injection.
// ============================================================

import { useAdminStore } from "@/lib/store/admin";

/** Fetch wrapper that auto-injects x-admin-token header. */
export async function adminFetch<T>(
  url: string,
  init: RequestInit = {}
): Promise<T> {
  const token = useAdminStore.getState().token;
  const headers = new Headers(init.headers);
  if (token) headers.set("x-admin-token", token);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(url, { ...init, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { message?: string }).message || `HTTP ${res.status}`);
  }
  return data as T;
}

/** Plain fetch for public endpoints (no auth). */
export async function publicFetch<T>(
  url: string,
  init: RequestInit = {}
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(url, { ...init, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { message?: string }).message || `HTTP ${res.status}`);
  }
  return data as T;
}
