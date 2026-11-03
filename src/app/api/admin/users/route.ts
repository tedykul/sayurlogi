import { NextRequest, NextResponse } from "next/server";
import {
  listUsers,
  createUser,
  getUserStats,
  type AdminRole,
} from "@/lib/users-db";
import { requirePermission, isAuthResult } from "@/lib/permissions";
import { logAdminAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

// GET /api/admin/users — list users + stats (super_admin only)
export async function GET() {
  const auth = await requirePermission("users:read");
  if (!isAuthResult(auth)) return auth;

  try {
    const [users, stats] = await Promise.all([listUsers(), getUserStats()]);
    return NextResponse.json({ success: true, users, stats });
  } catch (err: any) {
    console.error("[api/admin/users] GET error:", err);
    return NextResponse.json(
      { success: false, message: "Server error." },
      { status: 500 }
    );
  }
}

// POST /api/admin/users — create user (super_admin only)
export async function POST(req: NextRequest) {
  const auth = await requirePermission("users:write");
  if (!isAuthResult(auth)) return auth;

  try {
    const body = (await req.json().catch(() => ({}))) as {
      email?: unknown;
      name?: unknown;
      password?: unknown;
      role?: unknown;
      isActive?: unknown;
    };
    if (!body.email || typeof body.email !== "string") {
      return NextResponse.json(
        { success: false, message: "Email diperlukan." },
        { status: 422 }
      );
    }
    if (!body.password || typeof body.password !== "string") {
      return NextResponse.json(
        { success: false, message: "Password diperlukan." },
        { status: 422 }
      );
    }
    const role =
      typeof body.role === "string" ? (body.role as AdminRole) : "staff";
    const isActive =
      typeof body.isActive === "boolean" ? body.isActive : true;

    try {
      const user = await createUser({
        email: body.email,
        name: typeof body.name === "string" ? body.name : undefined,
        password: body.password,
        role,
        isActive,
      });
      await logAdminAction({
        action: "create",
        target: `user:${user.id}`,
        success: true,
        userId: auth.userId,
        userEmail: auth.email,
        detail: `email=${user.email} role=${user.role}`,
      });
      return NextResponse.json({ success: true, user }, { status: 201 });
    } catch (err: any) {
      return NextResponse.json(
        { success: false, message: err.message || "Gagal membuat user." },
        { status: 400 }
      );
    }
  } catch (err: any) {
    console.error("[api/admin/users] POST error:", err);
    return NextResponse.json(
      { success: false, message: "Server error." },
      { status: 500 }
    );
  }
}
