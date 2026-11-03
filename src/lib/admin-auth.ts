import { headers } from "next/headers";
import { db } from "@/lib/db";
import {
  readSessionToken,
  getSessionByToken,
} from "@/lib/session";

// ============================================================
// Admin auth — dual auth: session cookie + Bearer session token.
// ============================================================
// Two parallel paths, both backed by the Session table:
//
// 1. Cookie path (preferred): browser auto-sends admin_session
//    httpOnly cookie. verifyAuth reads it → Session row → User.
//
// 2. Bearer token path (fallback / robust): client explicitly
//    sends Authorization: Bearer <session-token>. verifyAuth
//    reads it → Session row → User. This path survives cases
//    where the cookie isn't sent (e.g. service worker intercept,
//    cross-origin, Safari ITP, certain proxy setups).
//
// Both paths look up the SAME Session table, so a token from
// login is valid in either form. Login route sets the cookie
// AND returns the token to the client for storage in
// sessionStorage (NOT the password — the session token).
//
// Legacy password-gate (Bearer = ADMIN_PASSWORD env) is kept
// for dev curl/scripts only. Production should disable it.
// ============================================================

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

if (process.env.NODE_ENV === "production" && ADMIN_PASSWORD) {
  console.warn(
    "[admin-auth] WARNING: ADMIN_PASSWORD is set in production. " +
      "The legacy bearer-token password-gate is ACTIVE. " +
      "Set ADMIN_PASSWORD='' in .env to disable it and use Mode 1 " +
      "(email + password via User table) only."
  );
}

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export interface AuthResult {
  userId: string;
  email: string;
  name?: string | null;
  role: string;
  method: "session" | "password_gate";
}

// ============================================================
// resolveSession → AuthResult — shared logic for cookie + bearer.
// ============================================================
// Given a valid SessionPayload, look up the linked User (if any)
// and return the AuthResult. Anonymous password-gate sessions
// (userId null) use the snapshotted email + role from the row.
// ============================================================

async function resolveSession(session: {
  id: string;
  userId: string | null;
  email: string | null;
  role: string;
  method: string;
}): Promise<AuthResult | null> {
  // Real user session (Mode 1)
  if (session.userId) {
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { id: true, email: true, name: true, role: true, active: true },
    });
    if (user && user.active) {
      return {
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        method: "session",
      };
    }
    // User deleted/disabled — session invalid. Best-effort delete.
    await db.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  // Anonymous password-gate session (legacy mode)
  return {
    userId: "",
    email: session.email || "admin@password-gate",
    name: null,
    role: session.role,
    method: "password_gate",
  };
}

// ============================================================
// verifyAuth — the single entry point for "is this request
// authenticated, and as whom?"
// ============================================================
// Check order:
//   1. Cookie admin_session → Session → User
//   2. Bearer <session-token> → Session → User  (robust fallback)
//   3. Bearer <ADMIN_PASSWORD env>  (legacy dev/scripts only)
//   4. null
// ============================================================

export async function verifyAuth(): Promise<AuthResult | null> {
  // 1. Cookie path (preferred).
  const cookieToken = await readSessionToken();
  if (cookieToken) {
    const session = await getSessionByToken(cookieToken);
    if (session) {
      const result = await resolveSession(session);
      if (result) return result;
    }
  }

  // 2. Bearer session-token path (robust fallback). The token
  //    stored in sessionStorage by admin-client is the SAME
  //    session token that's in the cookie. This handles cases
  //    where the cookie isn't sent (service worker, ITP, etc).
  const headersList = await headers();
  const authHeader = headersList.get("authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    const bearer = authHeader.slice(7).trim();

    // 2a. Try treating bearer as a session token (primary fallback).
    //     Session tokens are 64-char hex. ADMIN_PASSWORD is typically
    //    short ("admin123"). Quick length check avoids a DB hit for
    //    the common dev case.
    if (bearer.length >= 32 && /^[a-f0-9]+$/i.test(bearer)) {
      const session = await getSessionByToken(bearer);
      if (session) {
        const result = await resolveSession(session);
        if (result) return result;
      }
    }

    // 2b. Legacy: bearer = ADMIN_PASSWORD env (dev/scripts only).
    if (ADMIN_PASSWORD && safeCompare(bearer, ADMIN_PASSWORD)) {
      return {
        userId: "",
        email: "admin@password-gate",
        name: null,
        role: "admin",
        method: "password_gate",
      };
    }
  }

  return null;
}

export async function verifyAdmin(): Promise<boolean> {
  const result = await verifyAuth();
  return result !== null;
}

// ============================================================
// verifyPassword — used by the login route's password-gate
// mode (email empty). Compares against the ADMIN_PASSWORD env.
// ============================================================

export function verifyPassword(password: string): boolean {
  if (!ADMIN_PASSWORD) {
    console.error("[admin-auth] ADMIN_PASSWORD env var not set");
    return false;
  }
  return safeCompare(password, ADMIN_PASSWORD);
}
