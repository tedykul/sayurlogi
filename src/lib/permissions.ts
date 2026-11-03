import { verifyAuth, type AuthResult } from "@/lib/admin-auth";
import { NextResponse } from "next/server";

// ============================================================
// Permissions — role-based authorization for admin actions.
// ============================================================
// Roles:
//   super_admin — full access (manage users + everything)
//   admin       — content + products + orders
//   staff       — read-only (view orders, view products)
//   viewer      — alias for staff (read-only)
//
// PERMISSIONS map: which roles can perform which action.
//   "*" means any authenticated user.
// ============================================================

export type Permission =
  | "content:update"
  | "products:read"
  | "products:write"
  | "products:delete"
  | "products:sync"
  | "orders:read"
  | "orders:write"
  | "users:read"
  | "users:write"
  | "users:delete"
  | "audit:read"
  | "categories:write"
  | "faqs:write"
  | "testimonials:write"
  | "favicon:upload"
  | "about:upload";

export const PERMISSIONS: Record<Permission, AdminRole[]> = {
  "content:update": ["super_admin", "admin"],
  "products:read": ["super_admin", "admin", "staff", "viewer"],
  "products:write": ["super_admin", "admin"],
  "products:delete": ["super_admin", "admin"],
  "products:sync": ["super_admin", "admin"],
  "orders:read": ["super_admin", "admin", "staff", "viewer"],
  "orders:write": ["super_admin", "admin"],
  "users:read": ["super_admin", "admin"],
  "users:write": ["super_admin", "admin"],
  "users:delete": ["super_admin", "admin"],
  "audit:read": ["super_admin", "admin"],
  "categories:write": ["super_admin", "admin"],
  "faqs:write": ["super_admin", "admin"],
  "testimonials:write": ["super_admin", "admin"],
  "favicon:upload": ["super_admin", "admin"],
  "about:upload": ["super_admin", "admin"],
};

type AdminRole = "super_admin" | "admin" | "staff" | "viewer";

function normalizeRole(role: string): AdminRole {
  if (
    role === "super_admin" ||
    role === "admin" ||
    role === "staff" ||
    role === "viewer"
  ) {
    return role;
  }
  // Unknown role — treat as viewer (most restrictive non-rejected).
  return "viewer";
}

/** Check whether an authenticated user has a permission. */
export function hasPermission(
  auth: Pick<AuthResult, "role">,
  permission: Permission
): boolean {
  const allowed = PERMISSIONS[permission];
  if (!allowed) return false;
  return allowed.includes(normalizeRole(auth.role));
}

/**
 * Require a permission. Returns the AuthResult if allowed, otherwise
 * a 403 NextResponse. Caller should check `('status' in result)`.
 */
export async function requirePermission(
  permission: Permission
): Promise<AuthResult | NextResponse> {
  const auth = await verifyAuth();
  if (!auth) {
    return NextResponse.json(
      { success: false, message: "Unauthorized." },
      { status: 401 }
    );
  }
  if (!hasPermission(auth, permission)) {
    return NextResponse.json(
      { success: false, message: "Forbidden — permission denied." },
      { status: 403 }
    );
  }
  return auth;
}

/**
 * Require an authenticated admin (any role). Use this when the action
 * is allowed for all authenticated users (e.g., read endpoints).
 */
export async function requireAdmin(): Promise<AuthResult | NextResponse> {
  const auth = await verifyAuth();
  if (!auth) {
    return NextResponse.json(
      { success: false, message: "Unauthorized." },
      { status: 401 }
    );
  }
  return auth;
}

/** Type guard: is this result an AuthResult (vs. a 401/403 NextResponse)? */
export function isAuthResult(
  result: AuthResult | NextResponse
): result is AuthResult {
  return (
    typeof result === "object" &&
    result !== null &&
    "userId" in result &&
    "role" in result
  );
}
