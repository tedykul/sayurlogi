import { NextRequest, NextResponse } from "next/server";
import { simulatePayment } from "@/lib/payments";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ paymentId: string }>;
}

// POST /api/payments/[paymentId]/confirm
// Simulates payment confirmation (mock only — in production, this would
// be a Midtrans webhook callback).
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { paymentId } = await params;
    const result = await simulatePayment(paymentId);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (err: any) {
    console.error("[api/payments/[paymentId]/confirm] error:", err);
    return NextResponse.json(
      { success: false, message: "Server error." },
      { status: 500 }
    );
  }
}
