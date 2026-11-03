import type { Product, Category } from "@/types/grocery";
import { MOCK_PRODUCTS, MOCK_PRODUCTS_ENRICHED, MOCK_CATEGORIES } from "./mock-data";
import { getErpConfig, isConfigured, loadErpConfig } from "./integration-config";

// ============================================================
// ERPNext Client — talks to Frappe REST API
// ============================================================
// Config priority: DB (IntegrationConfig table) > env vars > empty
// Admin can edit config via admin panel → "Integrasi ERPNext" tab.
// No need to restart server when changing config.
// ============================================================

// Load config from DB on module init (async, non-blocking)
// Falls back to env vars until DB loads
loadErpConfig().catch(() => {});

/** Whether ERPNext is configured (DB or env) */
export function isErpnextConfigured(): boolean {
  return isConfigured();
}

/** Auth header: token <key>:<secret> (Frappe standard) */
function authHeader(): string {
  const c = getErpConfig();
  return `token ${c.apiKey}:${c.apiSecret}`;
}

/** Build absolute URL for ERPNext endpoint */
function erpUrl(path: string, params?: Record<string, string | number | undefined>): string {
  const c = getErpConfig();
  const url = new URL(`${c.url.replace(/\/$/, "")}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

/** Get warehouse from config (for Delivery Note creation) */
function getWarehouse(): string {
  return getErpConfig().warehouse;
}

/** Get company from config (for Sales Order + Stock Entry creation) */
function getCompany(): string {
  return getErpConfig().company;
}

/**
 * Fetch with timeout (5s) so the UI never hangs if ERPNext is offline.
 */
async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(init.headers || {}),
      },
    });
    return res;
  } finally {
    clearTimeout(t);
  }
}

// ------------------------------------------------------------
// PRODUCTS — read from ERPNext Item doctype
// ------------------------------------------------------------
export async function fetchProducts(category?: string): Promise<{
  products: Product[];
  source: "erpnext" | "mock";
}> {
  if (!isErpnextConfigured()) {
    // Mock mode — return enriched products (with rating, benefits, etc.)
    const products = category
      ? MOCK_PRODUCTS_ENRICHED.filter((p) => p.category === category)
      : MOCK_PRODUCTS_ENRICHED;
    return { products, source: "mock" };
  }

  try {
    // ERPNext Item list with filters:
    // - is_sales_item = 1
    // - disabled = 0
    // - optional item_group filter
    const filters: string[] = [["is_sales_item", "=", 1], ["disabled", "=", 0]];
    if (category) filters.push(["item_group", "=", category]);

    const url = erpUrl("/api/resource/Item", {
      fields: JSON.stringify([
        "name",
        "item_code",
        "item_name",
        "description",
        "item_group",
        "stock_uom",
        "image",
        "standard_rate",
      ]),
      filters: JSON.stringify(filters),
      limit_page_length: 200,
    });

    const res = await fetchWithTimeout(url);
    if (!res.ok) throw new Error(`ERPNext ${res.status}`);
    const json = await res.json();
    const items: any[] = json.data || [];

    // Fetch price for each item. Primary: standard_rate from Item
    // doctype (directly available, no separate API call). Fall back
    // to Item Price doctype if standard_rate is 0 or missing.
    const products: Product[] = await Promise.all(
      items.map(async (it) => {
        let price = it.standard_rate ?? 0;
        if (!price || price <= 0) {
          // Use item_code (not Item.name) for Item Price filter.
          price = (await fetchItemPrice(it.item_code || it.name)) ?? 0;
        }
        const stock = await fetchItemStock(it.name);
        return {
          id: it.name,
          itemCode: it.item_code || it.name,
          name: it.item_name || it.name,
          description: it.description || "",
          category: it.item_group || "Lainnya",
          price: price,
          unit: it.stock_uom || "pcs",
          stock,
          emoji: "🛒",
          image: it.image || undefined,
        };
      })
    );

    return { products, source: "erpnext" };
  } catch (err) {
    console.error("[ERPNext] fetchProducts failed, falling back to mock:", err);
    const products = category
      ? MOCK_PRODUCTS_ENRICHED.filter((p) => p.category === category)
      : MOCK_PRODUCTS_ENRICHED;
    return { products, source: "mock" };
  }
}

/** Get selling rate from Item Price (Selling, any price list). */
async function fetchItemPrice(itemCode: string): Promise<number | null> {
  try {
    // Filter by item_code (not Item.name) — Item Price links to
    // Item via item_code field. Also filter selling=1 to get the
    // selling price (not buying). No price_list filter — we accept
    // the first selling price found (admin should set one standard
    // selling price list in ERPNext).
    const url = erpUrl("/api/resource/Item Price", {
      filters: JSON.stringify([["item_code", "=", itemCode], ["selling", "=", 1]]),
      fields: JSON.stringify(["price_list_rate"]),
      limit_page_length: 1,
    });
    const res = await fetchWithTimeout(url);
    if (!res.ok) return null;
    const json = await res.json();
    return json.data?.[0]?.price_list_rate ?? null;
  } catch {
    return null;
  }
}

/** Get actual qty from stock bin (first warehouse found) */
async function fetchItemStock(itemName: string): Promise<number> {
  try {
    const url = erpUrl("/api/resource/Bin", {
      filters: JSON.stringify([["item_code", "=", itemName]]),
      fields: JSON.stringify(["actual_qty"]),
      limit_page_length: 1,
    });
    const res = await fetchWithTimeout(url);
    if (!res.ok) return 0;
    const json = await res.json();
    return json.data?.[0]?.actual_qty ?? 0;
  } catch {
    return 0;
  }
}

// ------------------------------------------------------------
// CATEGORIES — read from Item Group doctype
// ------------------------------------------------------------
export async function fetchCategories(): Promise<{
  categories: Category[];
  source: "erpnext" | "mock";
}> {
  if (!isErpnextConfigured()) {
    return { categories: MOCK_CATEGORIES, source: "mock" };
  }

  try {
    const url = erpUrl("/api/resource/Item Group", {
      fields: JSON.stringify(["name", "parent_item_group", "is_group"]),
      filters: JSON.stringify([["is_group", "=", 0]]),
      limit_page_length: 100,
    });
    const res = await fetchWithTimeout(url);
    if (!res.ok) throw new Error(`ERPNext ${res.status}`);
    const json = await res.json();
    const groups: any[] = json.data || [];

    // Map to our Category shape — assign a default emoji/gradient
    const emojiPool = ["🥬", "🍎", "🌿", "🧺", "🥕", "🌽", "🍇", "🥦"];
    const gradientPool = [
      "from-green-400 to-emerald-600",
      "from-rose-400 to-red-600",
      "from-lime-400 to-green-600",
      "from-amber-400 to-orange-600",
      "from-cyan-400 to-blue-600",
      "from-violet-400 to-purple-600",
    ];
    const categories: Category[] = groups.map((g, i) => ({
      id: g.name,
      name: g.name,
      emoji: emojiPool[i % emojiPool.length],
      gradient: gradientPool[i % gradientPool.length],
      description: "Kategori produk dari ERPNext",
    }));

    return { categories, source: "erpnext" };
  } catch (err) {
    console.error("[ERPNext] fetchCategories failed, falling back to mock:", err);
    return { categories: MOCK_CATEGORIES, source: "mock" };
  }
}

// ------------------------------------------------------------
// CHECKOUT — create Sales Order in ERPNext
// ------------------------------------------------------------
export async function createSalesOrder(payload: {
  customerName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  notes?: string;
  items: { itemCode: string; qty: number; rate: number }[];
  deliveryMethod: string;
  paymentMethod: string;
  /// Discount applied (IDR, off grand total). 0 = no discount.
  /// Sent to ERPNext as `discount_amount` on the Sales Order
  /// (apply_discount_on = "Grand Total"). Ignored in mock mode.
  discount?: number;
}): Promise<{
  success: boolean;
  salesOrderName?: string;
  deliveryNoteName?: string;
  message: string;
  mock?: boolean;
}> {
  if (!isErpnextConfigured()) {
    // Mock — generate a fake SO name
    const fakeName = `SO-MOCK-${Date.now().toString(36).toUpperCase()}`;
    return {
      success: true,
      salesOrderName: fakeName,
      message: "Pesanan berhasil dibuat (mode mock — ERPNext belum dikonfigurasi).",
      mock: true,
    };
  }

  try {
    // Step 1: Ensure Customer exists (by email). If not, create.
    const customerId = await ensureCustomer(payload);

    // Step 2: Ensure Address exists + link to Customer (Opsi B)
    // Returns Address ID (e.g. "ADDR-001") or null if creation fails
    // (we gracefully skip address linking if it fails, to not block checkout)
    const addressId = await ensureAddress(payload, customerId).catch((err) => {
      console.warn("[ERPNext] ensureAddress failed, continuing without address link:", err);
      return null;
    });

    // Step 3: Build Sales Order payload
    const today = new Date().toISOString().split("T")[0];
    const soPayload: Record<string, unknown> = {
      customer: customerId,
      transaction_date: today,
      delivery_date: today,
      // Link address ONLY if we got a valid Address ID (Opsi B fix)
      // Old code sent raw text (payload.address) → LinkValidationError
      ...(addressId ? { customer_address: addressId } : {}),
      // Items
      items: payload.items.map((it) => ({
        item_code: it.itemCode,
        qty: it.qty,
        rate: it.rate,
      })),
      // Custom fields (optional — requires custom fields in ERPNext Sales Order)
      ...(payload.notes ? { additional_notes: payload.notes } : {}),
    };

    // Apply coupon discount at SO level (ERPNext supports
    // discount_amount on Grand Total). Only when > 0.
    if (payload.discount && payload.discount > 0) {
      soPayload.apply_discount_on = "Grand Total";
      soPayload.discount_amount = payload.discount;
    }

    // Step 4: Create Sales Order via Frappe REST API
    // Use longer timeout (15s) because checkout flow has multiple API calls
    const url = erpUrl("/api/resource/Sales Order");
    const res = await fetchWithTimeout(url, {
      method: "POST",
      body: JSON.stringify(soPayload),
    }, 15000);

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`ERPNext ${res.status}: ${errText}`);
    }
    const json = await res.json();
    const soName = json.data?.name;

    // Step 5: Submit Sales Order (Opsi C — part 1)
    // Changes docstatus from 0 (Draft) to 1 (Submitted)
    await submitDoc(json.data);

    // Step 6: Create + Submit Delivery Note (Opsi C — part 2)
    // This is what actually reduces stock in ERPNext
    const dnName = await createAndSubmitDeliveryNote(soName, json.data);

    return {
      success: true,
      salesOrderName: soName,
      deliveryNoteName: dnName || undefined,
      message: dnName
        ? `Pesanan ${soName} dibuat + stok di-update via Delivery Note ${dnName}.`
        : `Pesanan ${soName} dibuat (DN creation skipped).`,
    };
  } catch (err: any) {
    console.error("[ERPNext] createSalesOrder failed:", err);
    return {
      success: false,
      message: `Gagal membuat pesanan: ${err.message || "unknown error"}`,
    };
  }
}

// ============================================================
// Helper: Submit a Frappe document (Draft → Submitted)
// ============================================================
// Uses frappe.client.submit which accepts the full doc object.
// Changes docstatus from 0 (Draft) to 1 (Submitted).
// ============================================================
async function submitDoc(doc: Record<string, unknown>): Promise<void> {
  const url = erpUrl("/api/method/frappe.client.submit");
  // Submit can be slow (validates + writes to DB) — use 15s timeout
  const res = await fetchWithTimeout(url, {
    method: "POST",
    body: JSON.stringify({ doc }),
  }, 15000);
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Submit failed (${res.status}): ${errText.substring(0, 200)}`);
  }
}

// ============================================================
// Helper: Create + Submit Delivery Note from Sales Order (Opsi C)
// ============================================================
// Creates a Delivery Note by copying items from the Sales Order,
// then submits it. Submitting the DN reduces stock in ERPNext.
//
// Returns the Delivery Note name (e.g. "DN-2026-00001") or null
// if creation fails (we don't block checkout if DN fails — admin
// can create DN manually from SO in ERPNext UI).
// ============================================================
async function createAndSubmitDeliveryNote(
  soName: string,
  soDoc: Record<string, unknown>
): Promise<string | null> {
  try {
    // Build Delivery Note payload from Sales Order
    const today = new Date().toISOString().split("T")[0];
    const items = (soDoc.items as Array<Record<string, unknown>> || []).map((it) => ({
      item_code: it.item_code,
      qty: it.qty,
      rate: it.rate,
      against_sales_order: soName,
      // Link to SO item (so_dn maintains the connection)
      so_detail: it.name,
      warehouse: getWarehouse(), // from config (default: Stores - S)
    }));

    const dnPayload: Record<string, unknown> = {
      customer: soDoc.customer,
      posting_date: today,
      set_posting_time: 0,
      // Link back to Sales Order
      ...(soDoc.customer_address ? { customer_address: soDoc.customer_address } : {}),
      items,
    };

    // Create Delivery Note
    const createUrl = erpUrl("/api/resource/Delivery Note");
    const createRes = await fetchWithTimeout(createUrl, {
      method: "POST",
      body: JSON.stringify(dnPayload),
    }, 15000);

    if (!createRes.ok) {
      const errText = await createRes.text();
      console.warn(`[ERPNext] DN creation failed (${createRes.status}): ${errText.substring(0, 200)}`);
      return null;
    }

    const createJson = await createRes.json();
    const dnName = createJson.data?.name;

    if (!dnName) {
      console.warn("[ERPNext] DN creation returned no name");
      return null;
    }

    // Submit Delivery Note → stock reduced
    await submitDoc(createJson.data);
    return dnName;
  } catch (err: any) {
    // Don't throw — checkout already succeeded (SO created + submitted).
    // Admin can create DN manually from SO in ERPNext UI.
    console.warn("[ERPNext] Delivery Note creation failed (non-blocking):", err.message);
    return null;
  }
}

// ============================================================
// Helper: Ensure Address exists + link to Customer (Opsi B)
// ============================================================
// Creates a proper Address document in ERPNext master data,
// then links it to the Customer. Returns Address ID (e.g.
// "ADDR-001") that can be used in Sales Order customer_address.
//
// Address structure in ERPNext:
//   - address_title: e.g. "John Doe-Office"
//   - address_type: "Shipping" or "Billing"
//   - address_line1: street address
//   - city: city name
//   - country: "Indonesia"
//   - links: [{ link_doctype: "Customer", link_name: customerId }]
// ============================================================
async function ensureAddress(
  payload: { customerName: string; address: string; city: string },
  customerId: string
): Promise<string | null> {
  if (!payload.address) return null;

  try {
    // Create Address document
    const addressTitle = `${payload.customerName}-Shipping`.substring(0, 100);
    const addressPayload = {
      address_title: addressTitle,
      address_type: "Shipping",
      address_line1: payload.address,
      city: payload.city || "Unknown",
      country: "Indonesia",
      is_primary_address: 1,
      // Link to Customer
      links: [
        {
          link_doctype: "Customer",
          link_name: customerId,
        },
      ],
    };

    const url = erpUrl("/api/resource/Address");
    const res = await fetchWithTimeout(url, {
      method: "POST",
      body: JSON.stringify(addressPayload),
    }, 15000);

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[ERPNext] Address creation failed (${res.status}): ${errText.substring(0, 200)}`);
      return null;
    }

    const json = await res.json();
    const addressId = json.data?.name;

    if (!addressId) {
      console.warn("[ERPNext] Address creation returned no name");
      return null;
    }

    return addressId;
  } catch (err: any) {
    console.warn("[ERPNext] ensureAddress error (non-blocking):", err.message);
    return null;
  }
}

/** Find customer by email; if not found, create new Customer in ERPNext */
export async function ensureCustomer(payload: {
  customerName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
}): Promise<string> {
  // Try to find existing customer by email
  try {
    const url = erpUrl("/api/resource/Contact", {
      filters: JSON.stringify([["email_id", "=", payload.email]]),
      fields: JSON.stringify(["name", "links"]),
      limit_page_length: 1,
    });
    const res = await fetchWithTimeout(url, {}, 15000);
    if (res.ok) {
      const json = await res.json();
      const contact = json.data?.[0];
      if (contact?.links?.[0]?.link_name) {
        return contact.links[0].link_name;
      }
    }
  } catch {
    // ignore — will create new
  }

  // Create new Customer
  const custUrl = erpUrl("/api/resource/Customer");
  const custPayload = {
    customer_name: payload.customerName,
    customer_type: "Individual",
    customer_group: "Individual",
    territory: "Indonesia",
    ...(payload.email ? { email_id: payload.email } : {}),
    ...(payload.phone ? { mobile_no: payload.phone } : {}),
  };
  const res = await fetchWithTimeout(custUrl, {
    method: "POST",
    body: JSON.stringify(custPayload),
  }, 15000);
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gagal membuat customer: ${errText}`);
  }
  const json = await res.json();
  return json.data?.name;
}
