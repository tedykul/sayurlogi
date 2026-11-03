import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { getAuditLogs } from "@/lib/audit";

export const dynamic = "force-dynamic";

// GET /api/admin/audit — list audit log entries (requires auth)
// Query params:
//   - limit: number (default 50, max 200)
//   - offset: number (default 0)
//   - action: filter by action type
//   - success: filter by success status ("true" | "false")
//   - hours: filter entries from last N hours
export async function GET(req: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json(
      { success: false, message: "Unauthorized." },
      { status: 401 }
    );
  }
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const action = searchParams.get("action") || undefined;
    const successParam = searchParams.get("success");
    const successOnly =
      successParam === "true" ? true :
      successParam === "false" ? false : undefined;
    const hoursParam = searchParams.get("hours");
    const since = hoursParam ? new Date(Date.now() - parseInt(hoursParam, 10) * 60 * 60 * 1000) : undefined;

    const result = await getAuditLogs({
      limit: isNaN(limit) ? 50 : limit,
      offset: isNaN(offset) ? 0 : offset,
      action,
      successOnly,
      since,
    });

    return NextResponse.json({
      success: true,
      entries: result.entries,
      total: result.total,
      limit: isNaN(limit) ? 50 : limit,
      offset: isNaN(offset) ? 0 : offset,
    });
  } catch (err: any) {
    console.error("[api/admin/audit] GET error:", err);
    return NextResponse.json(
      { success: false, message: "Server error." },
      { status: 500 }
    );
  }
}
