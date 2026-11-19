import { NextResponse, type NextRequest } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { isErpnextConfigured, ensureCustomer } from "@/lib/erpnext";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// ============================================================
// POST /api/admin/erpnext/customer-sync-diagnostic
// ============================================================
// Diagnostic tool for customer sync issues. Admin-only.
//
// Body options:
//   { "mode": "summary" }  (default) — show sync stats
//   { "mode": "test", "email": "user@example.com" } — test sync single customer
//   { "mode": "retry-failed" } — retry sync for customers where
//     erpCustomerId is null (sync failed before)
//
// Returns diagnostic info: configured status, customer counts, sync
// success rate, sample error messages.
// ============================================================

export async function POST(req: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const mode = body.mode || "summary";

    // Common diagnostic info
    const configured = isErpnextConfigured();

    if (mode === "summary") {
      // Count customers by sync status
      const total = await db.customer.count();
      const linked = await db.customer.count({ where: { NOT: { erpCustomerId: null } } });
      const unlinked = total - linked;
      // Recent registrations (last 7 days)
      const recentCount = await db.customer.count({
        where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      });
      const recentLinked = await db.customer.count({
        where: {
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          NOT: { erpCustomerId: null },
        },
      });

      return NextResponse.json({
        success: true,
        diagnostic: {
          erpnextConfigured: configured,
          customerStats: {
            total,
            linkedToErp: linked,
            unlinked: unlinked,
            linkRate: total > 0 ? `${Math.round((linked / total) * 100)}%` : "0%",
            recent7d: { total: recentCount, linked: recentLinked },
          },
          recommendation: !configured
            ? "ERPNext tidak terkonfigurasi. Set ERPNEXT_URL + API_KEY + API_SECRET di admin > Integrasi."
            : unlinked > 0
              ? `${unlinked} customer belum sync. Jalankan mode "retry-failed" untuk sync ulang.`
              : "Semua customer sudah sync ke ERPNext.",
        },
      });
    }

    if (mode === "test" && body.email) {
      // Test sync single customer
      const customer = await db.customer.findUnique({
        where: { email: String(body.email).toLowerCase().trim() },
      });
      if (!customer) {
        return NextResponse.json(
          { success: false, message: `Customer dengan email ${body.email} tidak ditemukan di DB.` },
          { status: 404 }
        );
      }

      const beforeErpId = customer.erpCustomerId;
      let testResult: { ok: boolean; erpId?: string; error?: string; durationMs: number };

      const start = Date.now();
      try {
        const erpId = await ensureCustomer({
          customerName: customer.name,
          email: customer.email,
          phone: customer.phone,
          address: customer.defaultAddress || "",
          city: customer.defaultCity || "",
          erpCustomerId: customer.erpCustomerId,
        });
        testResult = { ok: true, erpId, durationMs: Date.now() - start };

        // Save link if newly synced
        if (erpId && !beforeErpId) {
          await db.customer.update({
            where: { id: customer.id },
            data: { erpCustomerId: erpId },
          });
        }
      } catch (err: any) {
        testResult = { ok: false, error: err.message, durationMs: Date.now() - start };
      }

      return NextResponse.json({
        success: true,
        test: {
          customerEmail: customer.email,
          beforeSync: { erpCustomerId: beforeErpId },
          afterSync: testResult,
        },
      });
    }

    if (mode === "retry-failed") {
      // Find unlinked customers + retry sync (best-effort, sequential)
      const unlinked = await db.customer.findMany({
        where: { OR: [{ erpCustomerId: null }, { erpCustomerId: "" }] },
        take: 10, // limit to 10 per request to avoid timeout
        orderBy: { createdAt: "desc" },
      });

      const results: Array<{ email: string; ok: boolean; erpId?: string; error?: string }> = [];
      for (const c of unlinked) {
        try {
          const erpId = await ensureCustomer({
            customerName: c.name,
            email: c.email,
            phone: c.phone,
            address: c.defaultAddress || "",
            city: c.defaultCity || "",
          });
          if (erpId) {
            await db.customer.update({ where: { id: c.id }, data: { erpCustomerId: erpId } });
            results.push({ email: c.email, ok: true, erpId });
          } else {
            results.push({ email: c.email, ok: false, error: "ensureCustomer returned empty (ERPNext not configured?)" });
          }
        } catch (err: any) {
          results.push({ email: c.email, ok: false, error: err.message });
        }
      }

      const successCount = results.filter((r) => r.ok).length;
      return NextResponse.json({
        success: true,
        retry: {
          attempted: results.length,
          succeeded: successCount,
          failed: results.length - successCount,
          details: results,
        },
      });
    }

    return NextResponse.json(
      { success: false, message: "Mode tidak valid. Pakai: summary | test | retry-failed" },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message || "Diagnostic error." },
      { status: 500 }
    );
  }
}
