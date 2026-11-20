import { NextResponse, type NextRequest } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { isErpnextConfigured, erpUrl, fetchWithTimeout } from "@/lib/erpnext";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// ============================================================
// POST /api/admin/erpnext/customer-dedup
// ============================================================
// Find duplicate customers in ERPNext (by email or phone) + merge
// them into the oldest one. Admin-only.
//
// Body options:
//   { "mode": "scan" }  — find duplicates (dry run, no changes)
//   { "mode": "merge", "keepOldest": true }  — merge duplicates
//
// "Merge" = for each duplicate group:
//   1. Pick the oldest customer as "primary"
//   2. Disable (not delete) the newer duplicates
//   3. Update our DB erpCustomerId to point to primary
//
// Why disable not delete? ERPNext doesn't allow hard delete via API
// if there are linked transactions (Sales Orders). Disable is safer.
// ============================================================

export async function POST(req: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  if (!isErpnextConfigured()) {
    return NextResponse.json(
      { success: false, message: "ERPNext tidak dikonfigurasi." },
      { status: 400 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const mode = body.mode || "scan";

    // Step 1: Fetch all customers from ERPNext
    const listUrl = erpUrl("/api/resource/Customer", {
      fields: JSON.stringify(["name", "customer_name", "email_id", "mobile_no", "creation"]),
      limit_page_length: 500,
    });
    const listRes = await fetchWithTimeout(listUrl, {}, 30000);
    if (!listRes.ok) {
      return NextResponse.json(
        { success: false, message: `Gagal fetch customers: ${listRes.status}` },
        { status: 500 }
      );
    }
    const listJson = await listRes.json();
    const allCustomers: Array<{
      name: string;
      customer_name: string;
      email_id: string;
      mobile_no: string;
      creation: string;
    }> = listJson.data || [];

    // Step 2: Group by email_id (find duplicates)
    const byEmail = new Map<string, typeof allCustomers>();
    for (const c of allCustomers) {
      if (c.email_id) {
        const key = c.email_id.toLowerCase().trim();
        if (!byEmail.has(key)) byEmail.set(key, []);
        byEmail.get(key)!.push(c);
      }
    }

    // Also group by mobile_no (some duplicates might have same phone but different email)
    const byPhone = new Map<string, typeof allCustomers>();
    for (const c of allCustomers) {
      if (c.mobile_no) {
        const key = c.mobile_no.trim();
        if (!byPhone.has(key)) byPhone.set(key, []);
        byPhone.get(key)!.push(c);
      }
    }

    // Find groups with >1 customer (duplicates)
    const emailDupes: Array<{ email: string; customers: typeof allCustomers }> = [];
    for (const [email, customers] of byEmail) {
      if (customers.length > 1) emailDupes.push({ email, customers });
    }
    const phoneDupes: Array<{ phone: string; customers: typeof allCustomers }> = [];
    for (const [phone, customers] of byPhone) {
      if (customers.length > 1) phoneDupes.push({ phone, customers });
    }

    if (mode === "scan") {
      return NextResponse.json({
        success: true,
        scan: {
          totalErpCustomers: allCustomers.length,
          emailDuplicateGroups: emailDupes.length,
          phoneDuplicateGroups: phoneDupes.length,
          duplicates: {
            byEmail: emailDupes.map((g) => ({
              email: g.email,
              count: g.customers.length,
              customers: g.customers.map((c) => ({
                erpId: c.name,
                name: c.customer_name,
                phone: c.mobile_no,
                created: c.creation,
              })),
            })),
            byPhone: phoneDupes.map((g) => ({
              phone: g.phone,
              count: g.customers.length,
              customers: g.customers.map((c) => ({
                erpId: c.name,
                name: c.customer_name,
                email: c.email_id,
                created: c.creation,
              })),
            })),
          },
          recommendation:
            emailDupes.length > 0 || phoneDupes.length > 0
              ? `Ditemukan ${emailDupes.length + phoneDupes.length} grup duplicate. Jalankan mode "merge" untuk cleanup.`
              : "Tidak ada customer duplicate di ERPNext.",
        },
      });
    }

    if (mode === "merge") {
      const mergeResults: Array<{
        group: string;
        primary: string;
        disabled: string[];
        dbUpdated: number;
      }> = [];

      // Process email duplicates
      for (const group of emailDupes) {
        // Sort by creation date (oldest first)
        const sorted = [...group.customers].sort(
          (a, b) => new Date(a.creation).getTime() - new Date(b.creation).getTime()
        );
        const primary = sorted[0];
        const duplicates = sorted.slice(1);

        // Disable duplicates (set disabled = 1)
        const disabledIds: string[] = [];
        for (const dup of duplicates) {
          try {
            const updateUrl = erpUrl(`/api/resource/Customer/${dup.name}`);
            const updateRes = await fetchWithTimeout(
              updateUrl,
              { method: "PUT", body: JSON.stringify({ disabled: 1 }) },
              15000
            );
            if (updateRes.ok) {
              disabledIds.push(dup.name);
            }
          } catch (err: any) {
            console.warn(`[dedup] Failed to disable ${dup.name}:`, err.message);
          }
        }

        // Update our DB: set erpCustomerId to primary for customers
        // that were linked to the duplicates
        let dbUpdated = 0;
        for (const dup of duplicates) {
          const updated = await db.customer.updateMany({
            where: { erpCustomerId: dup.name },
            data: { erpCustomerId: primary.name },
          });
          dbUpdated += updated.count;
        }

        mergeResults.push({
          group: `email: ${group.email}`,
          primary: primary.name,
          disabled: disabledIds,
          dbUpdated,
        });
      }

      return NextResponse.json({
        success: true,
        merge: {
          groupsProcessed: mergeResults.length,
          results: mergeResults,
          totalDisabled: mergeResults.reduce((s, r) => s + r.disabled.length, 0),
          totalDbUpdated: mergeResults.reduce((s, r) => s + r.dbUpdated, 0),
        },
      });
    }

    return NextResponse.json(
      { success: false, message: "Mode tidak valid. Pakai: scan | merge" },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message || "Dedup error." },
      { status: 500 }
    );
  }
}
