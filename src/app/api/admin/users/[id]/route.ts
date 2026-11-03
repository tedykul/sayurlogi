import { NextRequest, NextResponse } from "next/server";
import {
  getUserById,
  updateUser,
  deleteUser,
  type AdminRole,
} from "@/lib/users-db";
import { requirePermission, isAuthResult } from "@/lib/permissions";
import { logAdminAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/admin/users/[id]
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("users:read");
  if (!isAuthResult(auth)) return auth;

  try {
    const { id } = await params;
    const user = await getUserById(id);
    if (!user) {
      return NextResponse.json(
        { success: false, message: "User tidak ditemukan." },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, user });
  } catch (err: any) {
    console.error("[api/admin/users/[id]] GET error:", err);
    return NextResponse.json(
      { success: false, message: "Server error." },
      { status: 500 }
    );
  }
}

// PUT /api/admin/users/[id]
// Self-protection: user can update themselves but cannot toggle own
// isActive=false or change own role (those changes are silently
// ignored when editing self).
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("users:write");
  if (!isAuthResult(auth)) return auth;

  try {
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as {
      name?: unknown;
      password?: unknown;
      role?: unknown;
      isActive?: unknown;
    };
    const isSelf = auth.userId === id;

    const patch: {
      name?: string;
      password?: string;
      role?: AdminRole;
      isActive?: boolean;
    } = {};
    if (typeof body.name === "string") patch.name = body.name;
    if (typeof body.password === "string" && body.password) patch.password = body.password;
    if (typeof body.role === "string" && !isSelf) patch.role = body.role as AdminRole;
    if (typeof body.isActive === "boolean" && !isSelf) patch.isActive = body.isActive;

    try {
      const user = await updateUser(id, patch);
      if (!user) {
        return NextResponse.json(
          { success: false, message: "User tidak ditemukan." },
          { status: 404 }
        );
      }
      await logAdminAction({
        action: "update",
        target: `user:${id}`,
        success: true,
        userId: auth.userId,
        userEmail: auth.email,
        detail: isSelf ? "self-edit" : undefined,
      });
      return NextResponse.json({ success: true, user });
    } catch (err: any) {
      return NextResponse.json(
        { success: false, message: err.message || "Gagal update user." },
        { status: 400 }
      );
    }
  } catch (err: any) {
    console.error("[api/admin/users/[id]] PUT error:", err);
    return NextResponse.json(
      { success: false, message: "Server error." },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/users/[id]
// Self-protection: cannot delete own account.
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("users:delete");
  if (!isAuthResult(auth)) return auth;

  try {
    const { id } = await params;
    if (auth.userId === id) {
      return NextResponse.json(
        { success: false, message: "Tidak bisa menghapus akun sendiri." },
        { status: 422 }
      );
    }
    const ok = await deleteUser(id);
    if (!ok) {
      return NextResponse.json(
        { success: false, message: "User tidak ditemukan." },
        { status: 404 }
      );
    }
    await logAdminAction({
      action: "delete",
      target: `user:${id}`,
      success: true,
      userId: auth.userId,
      userEmail: auth.email,
    });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[api/admin/users/[id]] DELETE error:", err);
    return NextResponse.json(
      { success: false, message: "Server error." },
      { status: 500 }
    );
  }
}
