import { db } from "@/lib/db";

// ============================================================
// Delivery Zones — internal shipping areas with flat rates.
// ============================================================
// Admin defines zones (e.g. BTP, Telkomas, Makassar Pusat).
// Each zone has a flat fee + optional free-shipping minimum.
//
// Checkout uses this to calculate shipping:
//   - Internal zone: fee (or 0 if subtotal >= freeShippingMin)
//   - Gojek: 0 (customer pays courier directly)
//   - Pickup: 0
// ============================================================

export interface DeliveryZoneInfo {
  id: string;
  name: string;
  fee: number;
  freeShippingMin: number;
  order: number;
}

// ============================================================
// getActiveZones — for public checkout dropdown.
// ============================================================

export async function getActiveZones(): Promise<DeliveryZoneInfo[]> {
  const zones = await db.deliveryZone.findMany({
    where: { active: true },
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });
  return zones.map((z) => ({
    id: z.id,
    name: z.name,
    fee: z.fee,
    freeShippingMin: z.freeShippingMin,
    order: z.order,
  }));
}

// ============================================================
// getAllZones — for admin management (includes inactive).
// ============================================================

export async function getAllZones(): Promise<DeliveryZoneInfo[]> {
  const zones = await db.deliveryZone.findMany({
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });
  return zones.map((z) => ({
    id: z.id,
    name: z.name,
    fee: z.fee,
    freeShippingMin: z.freeShippingMin,
    order: z.order,
  }));
}

// ============================================================
// calculateShipping — compute shipping based on method + zone.
// ============================================================
// Returns the shipping fee in IDR.
//   - "pickup": always 0
//   - "gojek": always 0 (customer pays courier directly)
//   - "delivery" + zoneId: zone.fee, or 0 if subtotal >=
//     zone.freeShippingMin
//   - "delivery" without zoneId: fallback to default fee
//     (backward compat with existing flat-rate logic)
// ============================================================

export async function calculateShipping(opts: {
  method: "delivery" | "pickup" | "gojek";
  zoneId?: string | null;
  subtotal: number;
  defaultFee?: number;
}): Promise<number> {
  // Pickup and Gojek are always free in-system
  if (opts.method === "pickup" || opts.method === "gojek") {
    return 0;
  }

  // Internal delivery with zone
  if (opts.method === "delivery" && opts.zoneId) {
    const zone = await db.deliveryZone.findUnique({
      where: { id: opts.zoneId },
      select: { fee: true, freeShippingMin: true, active: true },
    });
    if (zone && zone.active) {
      // Free shipping if subtotal meets minimum
      if (zone.freeShippingMin > 0 && opts.subtotal >= zone.freeShippingMin) {
        return 0;
      }
      return zone.fee;
    }
  }

  // Fallback: default flat fee (backward compat)
  return opts.defaultFee ?? 9000;
}
