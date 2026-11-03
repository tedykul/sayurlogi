// ============================================================
// Admin client helpers — dual auth: session cookie + Bearer token.
// ============================================================
// The login route sets an httpOnly `admin_session` cookie AND
// returns the session token in the JSON body. We store the token
// in sessionStorage (NOT the password — the session token, which
// is opaque + expires). adminFetch sends BOTH:
//   - cookie (auto, same-origin)
//   - Authorization: Bearer <session-token>
//
// verifyAuth on the server checks cookie first, then Bearer (as a
// session token lookup), then Bearer (as ADMIN_PASSWORD legacy).
// This dual path is robust against:
//   - Service workers intercepting requests (cookie stripped)
//   - Safari ITP / third-party cookie blocks
//   - Proxy/gateway cookie-stripping
//
// The token in sessionStorage is the SESSION token (single-use,
// 7-day expiry, revocable via logout). It is NOT the password.
// ============================================================

const TOKEN_KEY = "admin-session-token";
const USER_KEY = "admin-user";
const AUTHED_KEY = "admin-authed";

// ============================================================
// Types
// ============================================================

export type AdminRole = "super_admin" | "admin" | "staff" | "viewer";

export interface AdminUser {
  id: string | null;
  email: string;
  name: string | null;
  role: AdminRole;
  isActive?: boolean;
  lastLoginAt?: string | null;
  createdAt?: string;
}

// ============================================================
// Session token storage (sessionStorage). The token is the
// opaque session token from the login API, NOT the password.
// ============================================================

/** Store the session token (from login response). */
export function setAdminToken(token: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (token) {
      sessionStorage.setItem(TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // ignore
  }
}

/** Read the stored session token (or null). */
export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/** Clear the session token. */
export function clearAdminToken(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

// ============================================================
// UI-only storage (user object + authed flag for fast render).
// NOT credentials — the session token (above) is the credential.
// ============================================================

export function setAdminUser(user: AdminUser | null): void {
  if (typeof window === "undefined") return;
  try {
    if (user) {
      sessionStorage.setItem(USER_KEY, JSON.stringify(user));
      sessionStorage.setItem(AUTHED_KEY, "1");
    } else {
      sessionStorage.removeItem(USER_KEY);
      sessionStorage.removeItem(AUTHED_KEY);
    }
  } catch {
    // ignore
  }
}

export function getAdminUser(): AdminUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AdminUser;
  } catch {
    return null;
  }
}

export function getAdminAuthedFlag(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(AUTHED_KEY) === "1";
  } catch {
    return false;
  }
}

export function setCurrentUserId(id: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (id) sessionStorage.setItem("admin-user-id", id);
    else sessionStorage.removeItem("admin-user-id");
  } catch {
    // ignore
  }
}

export function getCurrentUserId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem("admin-user-id");
  } catch {
    return null;
  }
}

// ============================================================
// Login / logout / session check
// ============================================================

/**
 * Login with email + password. The server sets the httpOnly
 * cookie AND returns a session token. We store the token for
 * the Bearer fallback path. Returns the AdminUser on success.
 */
export async function loginAdminNextAuth(
  email: string,
  password: string
): Promise<{ success: boolean; message: string; user?: AdminUser }> {
  try {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email || undefined, password }),
      credentials: "include",
    });
    const data = await res.json();
    if (data.success) {
      // Store the SESSION token (not the password). This is the
      // opaque token from createSession() — safe to store in
      // sessionStorage because it expires + is revocable.
      if (data.token) setAdminToken(data.token);
      const user = data.user as AdminUser | undefined;
      if (user) {
        setAdminUser(user);
        if (user.id) setCurrentUserId(user.id);
      }
      return { success: true, message: data.message || "Login berhasil", user };
    }
    return { success: false, message: data.message || "Login gagal" };
  } catch {
    return { success: false, message: "Koneksi gagal." };
  }
}

export async function loginAdminLegacy(
  password: string
): Promise<{ success: boolean; message: string; user?: AdminUser }> {
  return loginAdminNextAuth("", password);
}

export async function loginAdmin(
  password: string
): Promise<{ success: boolean; message: string }> {
  const res = await loginAdminLegacy(password);
  return { success: res.success, message: res.message };
}

/**
 * Logout — destroy server session + clear cookie + clear local
 * token + clear UI cache.
 */
export async function logoutAdmin(): Promise<void> {
  const token = getAdminToken();
  try {
    await fetch("/api/admin/logout", {
      method: "POST",
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch {
    // ignore — client-side clear is what matters for UX
  }
  clearAdminToken();
  setAdminUser(null);
  setCurrentUserId(null);
}

/**
 * Check auth status via GET /api/admin/login. Sends cookie AND
 * Bearer token (whichever is available). Returns the AdminUser
 * if authenticated, null otherwise.
 */
export async function checkAuthStatus(): Promise<AdminUser | null> {
  const token = getAdminToken();
  try {
    const res = await fetch("/api/admin/login", {
      method: "GET",
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      setAdminUser(null);
      return null;
    }
    const data = await res.json();
    if (!data.authed || !data.user) {
      setAdminUser(null);
      return null;
    }
    const user = data.user as AdminUser;
    setAdminUser(user);
    if (user.id) setCurrentUserId(user.id);
    return user;
  } catch {
    return null;
  }
}

// ============================================================
// Fetch wrapper — sends cookie + Bearer token (dual auth).
// ============================================================

export async function adminFetch<T = unknown>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAdminToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };
  // Send Bearer token as fallback in case cookie isn't delivered
  // (service worker, ITP, proxy). verifyAuth checks both paths.
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    const err = new Error(data.message || "Request failed") as Error & {
      status?: number;
    };
    err.status = res.status;
    throw err;
  }
  return data as T;
}
