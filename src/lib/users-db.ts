import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

// ============================================================
// Users DB — list, create, update, delete + stats.
// ============================================================
// All password handling is via bcrypt (10 rounds). Passwords are
// never returned to the client — listUsers/getUserById omit
// passwordHash from the response shape.
// ============================================================

export type AdminRole = "super_admin" | "admin" | "staff" | "viewer";

const VALID_ROLES: AdminRole[] = ["super_admin", "admin", "staff", "viewer"];

export function isValidRole(role: string): role is AdminRole {
  return (VALID_ROLES as string[]).includes(role);
}

export function isValidPassword(password: string): boolean {
  return typeof password === "string" && password.length >= 6;
}

export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

export interface AdminUserRow {
  id: string;
  email: string;
  name: string | null;
  role: string;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}

function toRow(row: {
  id: string;
  email: string;
  name: string | null;
  role: string;
  active: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}): AdminUserRow {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    isActive: row.active,
    lastLoginAt: row.lastLoginAt,
    createdAt: row.createdAt,
  };
}

/** List all admin users (newest first). */
export async function listUsers(): Promise<AdminUserRow[]> {
  const rows = await db.user.findMany({
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toRow);
}

/** Get a single user by id. */
export async function getUserById(id: string): Promise<AdminUserRow | null> {
  const row = await db.user.findUnique({ where: { id } });
  return row ? toRow(row) : null;
}

export interface CreateUserInput {
  email: string;
  name?: string;
  password: string;
  role?: AdminRole;
  isActive?: boolean;
}

/** Create a new admin user. Throws if email already exists. */
export async function createUser(input: CreateUserInput): Promise<AdminUserRow> {
  const email = normalizeEmail(input.email);
  if (!email) throw new Error("Email diperlukan");
  if (!isValidPassword(input.password))
    throw new Error("Password minimal 6 karakter");
  const role = input.role && isValidRole(input.role) ? input.role : "staff";
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) throw new Error("Email sudah terdaftar");
  const passwordHash = await bcrypt.hash(input.password, 10);
  const row = await db.user.create({
    data: {
      email,
      name: input.name?.trim() || null,
      passwordHash,
      role,
      active: input.isActive !== false,
    },
  });
  return toRow(row);
}

export interface UpdateUserInput {
  name?: string;
  password?: string;
  role?: AdminRole;
  isActive?: boolean;
}

/** Update a user. Password is only changed if provided. */
export async function updateUser(
  id: string,
  patch: UpdateUserInput
): Promise<AdminUserRow | null> {
  const existing = await db.user.findUnique({ where: { id } });
  if (!existing) return null;
  const data: Record<string, unknown> = {};
  if (patch.name !== undefined) data.name = patch.name.trim() || null;
  if (patch.password !== undefined) {
    if (!isValidPassword(patch.password))
      throw new Error("Password minimal 6 karakter");
    data.passwordHash = await bcrypt.hash(patch.password, 10);
  }
  if (patch.role !== undefined && isValidRole(patch.role)) data.role = patch.role;
  if (patch.isActive !== undefined) data.active = patch.isActive;
  const row = await db.user.update({ where: { id }, data });
  return toRow(row);
}

/** Delete a user by id. */
export async function deleteUser(id: string): Promise<boolean> {
  try {
    await db.user.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}

export interface UserStats {
  total: number;
  active: number;
  nonActive: number;
  adminCount: number;
}

/** Quick aggregate counts for the admin user dashboard. */
export async function getUserStats(): Promise<UserStats> {
  const [total, active, adminCount] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { active: true } }),
    db.user.count({
      where: { role: { in: ["super_admin", "admin"] } },
    }),
  ]);
  return {
    total,
    active,
    nonActive: total - active,
    adminCount,
  };
}
