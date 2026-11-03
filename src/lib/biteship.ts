import { db } from "@/lib/db";
import { decrypt, setConfigValue } from "@/lib/integration-config";

// ============================================================
// Biteship — shipping aggregator API client.
// ============================================================
// One API → access 10+ couriers (GoSend, GrabExpress, JNE, J&T,
// SiCepat, AnterAja, Paxel, etc). Customer sees real-time rates
// + picks courier at checkout.
//
// Settings stored in IntegrationConfig table:
//   biteship_api_key   — API key (encrypted)
//   biteship_api_url   — API base URL (default: https://api.biteship.com)
//
// Flow:
//   1. Checkout: customer picks area + courier → POST /api/delivery/biteship/rates
//   2. Server calls Biteship API /v1/rates/couriers → returns list of couriers + prices
//   3. Customer selects courier → shipping fee added to total
//   4. After checkout: POST /api/delivery/biteship/orders → Biteship auto-books courier
// ============================================================

const KEYS = {
  API_KEY: "biteship_api_key",
  API_URL: "biteship_api_url",
} as const;

const DEFAULT_API_URL = "https://api.biteship.com";

export interface BiteshipSettings {
  apiKey: string;
  apiUrl: string;
  configured: boolean;
}

// ============================================================
// getBiteshipSettings — read from DB (decrypt API key).
// ============================================================

export async function getBiteshipSettings(): Promise<BiteshipSettings> {
  try {
    const rows = await db.integrationConfig.findMany({
      where: { key: { in: Object.values(KEYS) } },
    });

    const map: Record<string, string> = {};
    rows.forEach((r) => {
      if (r.key === KEYS.API_KEY && r.isSecret) {
        try {
          map[r.key] = decrypt(r.value);
        } catch {
          map[r.key] = r.value;
        }
      } else {
        map[r.key] = r.value;
      }
    });

    const apiKey = map[KEYS.API_KEY] || "";
    const apiUrl = map[KEYS.API_URL] || DEFAULT_API_URL;

    return {
      apiKey,
      apiUrl,
      configured: Boolean(apiKey),
    };
  } catch {
    return { apiKey: "", apiUrl: DEFAULT_API_URL, configured: false };
  }
}

// ============================================================
// saveBiteshipSettings — save to DB (encrypt API key).
// ============================================================

export async function saveBiteshipSettings(opts: {
  apiKey?: string;
  apiUrl?: string;
}): Promise<void> {
  if (opts.apiKey !== undefined) {
    await setConfigValue(KEYS.API_KEY, opts.apiKey, true); // encrypted
  }
  if (opts.apiUrl !== undefined) {
    await setConfigValue(KEYS.API_URL, opts.apiUrl);
  }
}

// ============================================================
// getRates — fetch courier rates from Biteship.
// ============================================================
// Biteship API: POST /v1/rates/couriers
// Body: { origin, destination, items, courier }
// Returns: { rates: [{ courier, service, price, etd }] }
// ============================================================

export interface BiteshipRateRequest {
  /// Origin address (store address)
  originAddress: string;
  /// Destination address (customer address)
  destinationAddress: string;
  /// Items in cart (for weight calculation)
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    weight?: number; // in grams
  }>;
}

export interface BiteshipRate {
  courier: string;
  courierService: string;
  courierServiceName: string;
  price: number;
  etd: string;
  /// Combined label for display: "GoSend - Same Day (~1 jam)"
  label: string;
}

export async function getRates(req: BiteshipRateRequest): Promise<{
  rates: BiteshipRate[];
  error?: string;
}> {
  const settings = await getBiteshipSettings();
  if (!settings.configured) {
    return { rates: [], error: "Biteship belum dikonfigurasi" };
  }

  try {
    // Biteship expects origin/destination as objects with area_id or address
    // For simplicity, we use address text + let Biteship geocode
    const body = {
      origin: {
        address: req.originAddress,
      },
      destination: {
        address: req.destinationAddress,
      },
      couriers: "", // empty = all couriers
      items: req.items.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        price: i.price,
        weight: i.weight || 500, // default 500g if not specified
      })),
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(`${settings.apiUrl}/v1/rates/couriers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: settings.apiKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text();
      console.error("[biteship] rates API error:", res.status, errText);
      return { rates: [], error: `Biteship API error: ${res.status}` };
    }

    const data = await res.json();
    if (!data.success || !data.pricing) {
      return { rates: [], error: data.message || "Tidak ada tarif tersedia" };
    }

    // Map Biteship response to our format
    const rates: BiteshipRate[] = (data.pricing || []).map((p: any) => ({
      courier: p.courier?.code || "",
      courierService: p.courier?.service || "",
      courierServiceName: p.courier?.service_name || "",
      price: p.price || 0,
      etd: p.courier?.etd || "",
      label: `${p.courier?.name || p.courier?.code || "Kurir"} - ${p.courier?.service_name || p.courier?.service || ""} ${p.courier?.etd ? `(${p.courier.etd})` : ""}`,
    }));

    return { rates };
  } catch (err: any) {
    console.error("[biteship] getRates error:", err.message);
    return { rates: [], error: "Koneksi gagal" };
  }
}

// ============================================================
// createOrder — book courier via Biteship after checkout.
// ============================================================
// Biteship API: POST /v1/orders
// ============================================================

export async function createOrder(opts: {
  orderId: string;
  trackingId: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  items: Array<{ name: string; quantity: number; price: number; weight?: number }>;
  courier: string;
  courierService: string;
  originAddress: string;
}): Promise<{ success: boolean; biteshipOrderId?: string; trackingId?: string; error?: string }> {
  const settings = await getBiteshipSettings();
  if (!settings.configured) {
    return { success: false, error: "Biteship belum dikonfigurasi" };
  }

  try {
    const body = {
      shipper_contact_name: "SayurLogi",
      shipper_contact_phone: "08001234567",
      shipper_contact_email: "admin@sayurlogi.id",
      shipper_address: opts.originAddress,
      recipient_contact_name: opts.customerName,
      recipient_contact_phone: opts.customerPhone,
      recipient_address: opts.customerAddress,
      courier: opts.courier,
      courier_service: opts.courierService,
      delivery_type: "now",
      order_note: `Order ${opts.trackingId}`,
      items: opts.items.map((i) => ({
        name: i.name,
        qty: i.quantity,
        price: i.price,
        weight: i.weight || 500,
      })),
      metadata: {
        order_id: opts.orderId,
        tracking_id: opts.trackingId,
      },
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(`${settings.apiUrl}/v1/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: settings.apiKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text();
      console.error("[biteship] createOrder error:", res.status, errText);
      return { success: false, error: `Biteship API error: ${res.status}` };
    }

    const data = await res.json();
    if (!data.success) {
      return { success: false, error: data.message || "Gagal membuat order" };
    }

    return {
      success: true,
      biteshipOrderId: data.id || data.order_id,
      trackingId: data.tracking_id,
    };
  } catch (err: any) {
    console.error("[biteship] createOrder error:", err.message);
    return { success: false, error: "Koneksi gagal" };
  }
}
