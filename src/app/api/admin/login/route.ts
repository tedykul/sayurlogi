import { NextResponse, type NextRequest } from "next/server";
import { verifyPassword, verifyAuth } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import {
  createSession,
  setSessionCookieOnResponse,
} from "@/lib/session";

export const dynamic = "force-dynamic";

interface LoginRequestBody {
  email?: unknown;
  password?: unknown;
}

// ============================================================
// POST /api/admin/login
// ============================================================
// Two modes (kept for backwards compatibility):
//   1. Email + password — verify bcrypt against User table.
//      On success, mint a Session bound to the real User and
//      set the admin_session httpOnly cookie. Returns the
//      authenticated user (id, email, name, role).
//   2. Password only (email empty) — compare against the
//      ADMIN_PASSWORD env var (legacy gate). Mints an anonymous
//      Session (no userId, role "admin").
//
// Both modes return { success, message, user? } and set the
// httpOnly session cookie. The frontend no longer stores the
// password anywhere — the cookie is the credential.
// ============================================================

export async function POST(req: NextRequest) {
  try {
    const rateLimit = await checkRateLimit("admin-login");
    if (rateLimit.blocked) {
      await logAdminAction({
        action: "login_rate_limited",
        target: "login",
        success: false,
        detail: `Blocked until ${rateLimit.resetAt?.toISOString()}`,
      });
      return NextResponse.json(
        {
          success: false,
          message: "Terlalu banyak percobaan. Coba lagi nanti.",
          retryAfter: rateLimit.retryAfterSeconds,
        },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
        }
      );
    }

    const body = (await req.json().catch(() => ({}))) as LoginRequestBody;
    const { email, password } = body;

    if (!password || typeof password !== "string") {
      return NextResponse.json(
        { success: false, message: "Password diperlukan." },
        { status: 400 }
      );
    }

    // --- Mode 1: NextAuth-style (email + password) ---
    if (email && typeof email === "string") {
      const normalizedEmail = email.toLowerCase().trim();
      const user = await db.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (!user || !user.passwordHash || !user.active) {
        await logAdminAction({
          action: "login_failed",
          target: `login:${normalizedEmail}`,
          success: false,
          detail: user ? "Account disabled" : "User not found",
        });
        return NextResponse.json(
          { success: false, message: "Email atau password salah." },
          { status: 401 }
        );
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        await logAdminAction({
          action: "login_failed",
          target: `login:${normalizedEmail}`,
          success: false,
          detail: "Wrong password",
        });
        return NextResponse.json(
          { success: false, message: "Email atau password salah." },
          { status: 401 }
        );
      }

      // Success — mint a session bound to the real user.
      const { token, expiresAt } = await createSession({
        userId: user.id,
        email: user.email,
        role: user.role,
        method: "nextauth",
      });

      // Refresh lastLoginAt (best-effort).
      db.user
        .update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
        .catch(() => {});

      await logAdminAction({
        action: "login_success",
        target: `login:${normalizedEmail}`,
        success: true,
        userId: user.id,
        userEmail: user.email,
      });

      // Return token to client (for Bearer header fallback) AND
      // set httpOnly cookie (primary path). The token stored in
      // sessionStorage is the SESSION token, not the password —
      // so it's safe even if XSS leaks it (single-use, expires).
      const res = NextResponse.json({
        success: true,
        message: "Login berhasil.",
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        token, // session token — client stores + sends as Bearer
      });
      setSessionCookieOnResponse(res, token, expiresAt);
      return res;
    }

    // --- Mode 2: legacy password gate (email empty) ---
    if (verifyPassword(password)) {
      const { token, expiresAt } = await createSession({
        userId: null,
        email: "admin@password-gate",
        role: "admin",
        method: "password_gate",
      });
      await logAdminAction({
        action: "login_success",
        target: "login:password-gate",
        success: true,
      });
      const res = NextResponse.json({
        success: true,
        message: "Login berhasil.",
        token,
      });
      setSessionCookieOnResponse(res, token, expiresAt);
      return res;
    }

    await logAdminAction({
      action: "login_failed",
      target: "login:password-gate",
      success: false,
      detail: "Wrong password",
    });
    return NextResponse.json(
      { success: false, message: "Password salah." },
      { status: 401 }
    );
  } catch {
    return NextResponse.json(
      { success: false, message: "Request tidak valid." },
      { status: 400 }
    );
  }
}

// ============================================================
// GET /api/admin/login — current auth status.
// ============================================================
// Used by the admin overlay on mount to decide whether to show
// the login form or the dashboard, and to populate the user
// display in the header. Returns { authed, method, user? }.
// ============================================================

export async function GET() {
  const result = await verifyAuth();
  if (!result) {
    return NextResponse.json({ authed: false });
  }
  return NextResponse.json({
    authed: true,
    method: result.method,
    user: {
      id: result.userId || null,
      email: result.email,
      name: result.name,
      role: result.role,
    },
  });
}
