// ============================================================
// Admin auth — simple token-based gate for admin API routes.
// ============================================================
// Reads ADMIN_TOKEN from env (default: "admin-demo-token").
// Client must send `x-admin-token: <token>` header.
//
// This is intentionally minimal — for local demo. In production,
// replace with NextAuth session check (see SayurLogi's
// lib/admin-auth.ts for the upgrade path).
// ============================================================

import { headers } from "next/headers";

export function getAdminToken(): string {
  return process.env.ADMIN_TOKEN || "admin-demo-token";
}

export async function verifyAdmin(): Promise<boolean> {
  const h = await headers();
  const token = h.get("x-admin-token");
  if (!token) return false;
  return token === getAdminToken();
}

export function unauthorizedResponse() {
  return Response.json(
    { success: false, message: "Unauthorized. Set x-admin-token header." },
    { status: 401 }
  );
}
