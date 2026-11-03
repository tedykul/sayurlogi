import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/audit";
import {
  readSessionToken,
  destroySessionByToken,
  clearSessionCookieOnResponse,
} from "@/lib/session";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

// ============================================================
// POST /api/admin/logout
// ============================================================
// Destroys the server-side Session row (by cookie OR Bearer
// token) and clears the admin_session cookie. Best-effort
// audit log.
// ============================================================

export async function POST() {
  const auth = await verifyAuth();

  // Find the token to destroy — check cookie first, then Bearer.
  let token = await readSessionToken();
  if (!token) {
    const headersList = await headers();
    const authHeader = headersList.get("authorization") || "";
    if (authHeader.startsWith("Bearer ")) {
      const bearer = authHeader.slice(7).trim();
      // Only treat as session token if it looks like one (64-hex).
      // Short strings (ADMIN_PASSWORD) don't need session destroy.
      if (bearer.length >= 32 && /^[a-f0-9]+$/i.test(bearer)) {
        token = bearer;
      }
    }
  }

  if (auth) {
    await logAdminAction({
      action: "logout",
      target: `logout:${auth.email}`,
      success: true,
      userId: auth.userId || undefined,
      userEmail: auth.email,
    });
  }

  if (token) {
    await destroySessionByToken(token);
  }

  const res = NextResponse.json({ success: true });
  clearSessionCookieOnResponse(res);
  return res;
}
