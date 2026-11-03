import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// ============================================================
// Session — opaque-token server sessions for admin auth.
// ============================================================
// Replaces the legacy "Bearer password" scheme. The login route
// mints a random 32-byte hex token, stores a Session row, and
// sets it as an httpOnly cookie (admin_session). verifyAuth()
// reads the cookie → looks up the Session → returns the linked
// User's real id/email/role.
//
// Cookie: httpOnly + sameSite=lax + path=/ + 7-day maxAge.
// Never expires the cookie later than the Session row's
// expiresAt — the row is the source of truth.
// ============================================================

export const SESSION_COOKIE = "admin_session";
export const CUSTOMER_SESSION_COOKIE = "customer_session";
const SESSION_TTL_DAYS = 7;
const TOKEN_BYTES = 32;

export interface SessionCreateResult {
  token: string;
  expiresAt: Date;
}

export interface SessionPayload {
  id: string;
  token: string;
  userId: string | null;
  customerId: string | null;
  email: string | null;
  role: string;
  method: string;
  expiresAt: Date;
}

// ============================================================
// Create — mint a new session token + row.
// ============================================================
// userId may be null for the legacy password-gate mode
// (anonymous admin). email + role are snapshotted for display
// and audit when userId is null. customerId is set for
// storefront customer sessions (method='customer').
// ============================================================

export async function createSession(opts: {
  userId?: string | null;
  customerId?: string | null;
  email?: string | null;
  role?: string;
  method?: "nextauth" | "password_gate" | "customer";
}): Promise<SessionCreateResult> {
  const token = randomBytes(TOKEN_BYTES).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await db.session.create({
    data: {
      token,
      userId: opts.userId ?? null,
      customerId: opts.customerId ?? null,
      email: opts.email ?? null,
      role: opts.role ?? "viewer",
      method: opts.method ?? "nextauth",
      expiresAt,
    },
  });

  return { token, expiresAt };
}

// ============================================================
// Read — find a non-expired session by its token.
// ============================================================
// Returns the Session row (without the user relation) or null.
// Expired rows are deleted lazily on read to keep the table
// tidy. Callers only need id/userId/email/role/method/expiresAt.
// ============================================================

export async function getSessionByToken(token: string): Promise<SessionPayload | null> {
  const row = await db.session.findUnique({
    where: { token },
    select: {
      id: true,
      token: true,
      userId: true,
      customerId: true,
      email: true,
      role: true,
      method: true,
      expiresAt: true,
    },
  });
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) {
    // Expired — clean up. Best-effort, ignore errors.
    await db.session.delete({ where: { id: row.id } }).catch(() => {});
    return null;
  }
  return row;
}

// ============================================================
// Destroy — delete a session row by token (logout).
// ============================================================

export async function destroySessionByToken(token: string): Promise<void> {
  await db.session.deleteMany({ where: { token } }).catch(() => {});
}

// ============================================================
// Cookie helpers — read the token from the incoming request
// cookies, and build Set-Cookie options for the response.
// ============================================================

export async function readSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

// ============================================================
// Customer cookie helpers — separate cookie name so a customer
// can be logged in as customer AND admin at the same time
// (useful for testing/operating both sides).
// ============================================================

export async function readCustomerSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(CUSTOMER_SESSION_COOKIE)?.value ?? null;
}

export function sessionCookieSet(token: string, expiresAt: Date) {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    sameSite: "lax" as const,
    expires: expiresAt,
    maxAge: Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000)),
  };
}

export function sessionCookieClear() {
  return {
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    sameSite: "lax" as const,
    maxAge: 0,
  };
}

// ============================================================
// Customer cookie builders (mirror admin helpers, different name)
// ============================================================

export function customerSessionCookieSet(token: string, expiresAt: Date) {
  return {
    name: CUSTOMER_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    sameSite: "lax" as const,
    expires: expiresAt,
    maxAge: Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000)),
  };
}

export function customerSessionCookieClear() {
  return {
    name: CUSTOMER_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    sameSite: "lax" as const,
    maxAge: 0,
  };
}

// ============================================================
// Convenience — attach a Set-Cookie header to a NextResponse.
// ============================================================

export function setSessionCookieOnResponse(
  res: NextResponse,
  token: string,
  expiresAt: Date
): void {
  res.cookies.set(sessionCookieSet(token, expiresAt));
}

export function clearSessionCookieOnResponse(res: NextResponse): void {
  res.cookies.set(sessionCookieClear());
}

export function setCustomerSessionCookieOnResponse(
  res: NextResponse,
  token: string,
  expiresAt: Date
): void {
  res.cookies.set(customerSessionCookieSet(token, expiresAt));
}

export function clearCustomerSessionCookieOnResponse(res: NextResponse): void {
  res.cookies.set(customerSessionCookieClear());
}
