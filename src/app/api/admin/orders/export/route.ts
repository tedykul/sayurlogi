import { NextRequest, NextResponse } from "next/server";
import { listOrders, type OrderStatus } from "@/lib/orders";
import { verifyAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/audit";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// ============================================================
// GET /api/admin/orders/export — download orders as CSV.
// ============================================================
// Query params (same filters as the order list):
//   status — filter by order status (optional)
//   search — search name/phone/email/trackingId (optional)
//   payment_status — e.g. pending_verification (optional,
//     applied post-fetch like the list endpoint)
// Exports ALL matching orders (not paginated), max 5000 rows
// safety cap. CSV includes BOM so Excel opens it cleanly with
// UTF-8 chars (Indonesian names, notes, etc).
// ============================================================

const EXPORT_LIMIT = 5000;

/** CSV-escape a field: wrap in quotes if it contains comma, quote, newline. */
function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

const CSV_HEADERS = [
  "Tracking ID",
  "Tanggal",
  "Nama",
  "Telepon",
  "Email",
  "Kota",
  "Metode",
  "Pembayaran",
  "Status",
  "Status Pembayaran",
  "Jumlah Item",
  "Subtotal",
  "Ongkir",
  "Diskon",
  "Total",
  "Kupon",
  "Slot",
  "Catatan",
];

export async function GET(req: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json(
      { success: false, message: "Unauthorized." },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") as OrderStatus | null;
    const search = searchParams.get("search") || undefined;
    const paymentStatus = searchParams.get("payment_status");

    const result = await listOrders({
      limit: EXPORT_LIMIT,
      offset: 0,
      status: status || undefined,
      search,
    });

    let orders = result.orders;

    // Optional payment-status filter — same post-fetch pattern as
    // the list endpoint (Payment-Order has no Prisma relation).
    if (paymentStatus) {
      const orderIds = orders.map((o) => o.id);
      const payments =
        orderIds.length > 0
          ? await db.payment.findMany({
              where: { orderId: { in: orderIds }, status: paymentStatus },
              select: { orderId: true },
            })
          : [];
      const matchIds = new Set(payments.map((p) => p.orderId));
      orders = orders.filter((o) => matchIds.has(o.id));
    }

    // Fetch payment status for the CSV column (single query).
    const exportIds = orders.map((o) => o.id);
    const paymentRecords =
      exportIds.length > 0
        ? await db.payment.findMany({
            where: { orderId: { in: exportIds } },
            select: { orderId: true, status: true },
          })
        : [];
    const paymentStatusMap = new Map(
      paymentRecords.map((p) => [p.orderId, p.status])
    );

    // BOM + header row
    const rows: string[] = ["\uFEFF" + CSV_HEADERS.join(",")];

    for (const o of orders) {
      rows.push(
        [
          o.trackingId,
          new Date(o.createdAt).toLocaleString("id-ID", {
            timeZone: "Asia/Jakarta",
          }),
          o.customerName,
          o.customerPhone,
          o.customerEmail || "",
          o.customerCity || "",
          o.deliveryMethod,
          o.paymentMethod,
          o.status,
          paymentStatusMap.get(o.id) || "-",
          String(o.items.reduce((n, i) => n + i.quantity, 0)),
          String(o.subtotal),
          String(o.shipping),
          String(o.discount),
          String(o.total),
          o.couponCode || "",
          o.deliverySlotLabel || "",
          (o.customerNotes || "").replace(/\r?\n/g, " "),
        ]
          .map(csvEscape)
          .join(",")
      );
    }

    await logAdminAction({
      action: "export",
      target: `orders:${orders.length}`,
      detail: `Export CSV ${orders.length} pesanan (status=${status || "semua"}, payment_status=${paymentStatus || "-"}, search=${search || "-"})`,
    });

    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(rows.join("\r\n"), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="sayurlogi-orders-${date}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[orders/export] Failed:", err);
    return NextResponse.json(
      { success: false, message: "Gagal export pesanan." },
      { status: 500 }
    );
  }
}
