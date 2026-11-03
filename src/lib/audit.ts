import { headers } from "next/headers";
import { db } from "@/lib/db";

// ============================================================
// Audit log helper — record admin actions to AdminAuditLog table.
// ============================================================
// Sprint 6 (Skenario C): logs IP + userAgent + action + target.
// No user tracking (password gate is shared). When upgraded to
// NextAuth (Plan B), add userId parameter from session.
//
// All logging is fire-and-forget (non-blocking) — audit failures
// must not break the actual admin operation.
// ============================================================

export type AuditAction =
  | "login_success"
  | "logout"
  | "login_failed"
  | "login_rate_limited"
  | "create"
  | "update"
  | "delete"
  | "publish_toggle"
  | "reorder"
  | "unauthorized_attempt";

interface LogOptions {
  action: AuditAction;
  target: string;
  success?: boolean;
  detail?: string;
  /** Optional user id (NextAuth). Stored on AdminAuditLog.userId. */
  userId?: string;
  /** Optional user email (NextAuth). Stored on AdminAuditLog.userEmail. */
  userEmail?: string;
}

/**
 * Extract client IP from request headers.
 * Handles X-Forwarded-For (proxy/load balancer) and falls back to
 * x-real-ip or connection remote address.
 */
export async function getClientIp(): Promise<string | null> {
  const headersList = await headers();
  const forwarded = headersList.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = headersList.get("x-real-ip");
  if (realIp) return realIp.trim();
  return null;
}

/**
 * Get User-Agent string from request headers.
 */
export async function getUserAgent(): Promise<string | null> {
  const headersList = await headers();
  return headersList.get("user-agent");
}

/**
 * Log an admin action to the audit table.
 * Fire-and-forget — errors are logged but not thrown.
 *
 * @example
 * await logAdminAction({ action: "create", target: "faq:abc123" });
 */
export async function logAdminAction({
  action,
  target,
  success = true,
  detail,
  userId,
  userEmail,
}: LogOptions): Promise<void> {
  try {
    const [ip, userAgent] = await Promise.all([getClientIp(), getUserAgent()]);
    await db.adminAuditLog.create({
      data: {
        action,
        target,
        ip,
        userAgent: userAgent?.substring(0, 500), // cap length
        success,
        detail: detail?.substring(0, 500),
        userId: userId || null,
        userEmail: userEmail || null,
      },
    });
  } catch (err) {
    // Audit log failure must not break the actual operation.
    // Log to console for monitoring, but continue.
    console.error("[audit] Failed to log action:", err);
  }
}

/**
 * Get audit log entries with optional filtering.
 * Used by /api/admin/audit GET endpoint.
 */
export async function getAuditLogs(options: {
  limit?: number;
  offset?: number;
  action?: string;
  successOnly?: boolean;
  since?: Date;
} = {}): Promise<{ entries: AuditLogEntry[]; total: number }> {
  const { limit = 50, offset = 0, action, successOnly, since } = options;

  const where: Record<string, unknown> = {};
  if (action) where.action = action;
  if (successOnly !== undefined) where.success = successOnly;
  if (since) where.createdAt = { gte: since };

  const [entries, total] = await Promise.all([
    db.adminAuditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 200), // cap at 200 for safety
      skip: offset,
    }),
    db.adminAuditLog.count({ where }),
  ]);

  return { entries: entries as unknown as AuditLogEntry[], total };
}

export interface AuditLogEntry {
  id: string;
  action: string;
  target: string;
  ip: string | null;
  userAgent: string | null;
  success: boolean;
  detail: string | null;
  createdAt: Date;
}
