import { getErpConfig, isConfigured, loadErpConfig } from "./integration-config";
import { MOCK_PRODUCTS, MOCK_CATEGORIES } from "./mock-data";
import type { Product } from "@/types";

// ============================================================
// ERPNext Client — talks to Frappe REST API.
// ============================================================
// Config priority: DB (IntegrationConfig table) > env vars > empty.
// Admin edits config via admin overlay → "Integrasi ERPNext" tab.
// No restart needed — refreshConfig() reloads the in-memory cache.
//
// All calls have a 5s timeout (15s for checkout flow) so the UI
// never hangs if ERPNext is offline. On failure we fall back to
// mock data so the storefront keeps working.
// ============================================================

// Load config from DB on module init (async, non-blocking).
loadErpConfig().catch(() => {});

/** Whether ERPNext is configured (DB or env). */
export function isErpnextConfigured(): boolean {
  return isConfigured();
}

/** Auth header: token <key>:<secret> (Frappe standard). */
function authHeader(): string {
  const c = getErpConfig();
  return `token ${c.apiKey}:${c.apiSecret}`;
}

/** Build absolute URL for ERPNext endpoint. */
function erpUrl(
  path: string,
  params?: Record<string, string | number | undefined>
): string {
  const c = getErpConfig();
  const url = new URL(`${c.url.replace(/\/$/, "")}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

function getWarehouse(): string {
  return getErpConfig().warehouse;
}

/** Fetch with timeout so the UI never hangs if ERPNext is offline. */
async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = 5000
) {
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
    const products = category
      ? MOCK_PRODUCTS.filter((p) => p.category === category)
      : MOCK_PRODUCTS;
    return { products, source: "mock" };
  }

  try {
    // ERPNext Item list filters: is_sales_item=1, disabled=0, optional item_group.
    const filters: string[][] = [["is_sales_item", "=", 1], ["disabled", "=", 0]];
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

    const products: Product[] = await Promise.all(
      items.map(async (it) => {
        let price = it.standard_rate ?? 0;
        if (!price || price <= 0) {
          price = (await fetchItemPrice(it.item_code || it.name)) ?? 0;
        }
        const stock = await fetchItemStock(it.name);
        return {
          id: it.name,
          itemCode: it.item_code || it.name,
          name: it.item_name || it.name,
          description: it.description || "",
          price: Math.round(price),
          oldPrice: null,
          category: it.item_group || "Lainnya",
          unit: it.stock_uom || "pcs",
          image: it.image || null,
          emoji: "🛒",
          stock,
          published: true,
          erpSyncedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      })
    );

    return { products, source: "erpnext" };
  } catch (err) {
    console.error("[ERPNext] fetchProducts failed, falling back to mock:", err);
    const products = category
      ? MOCK_PRODUCTS.filter((p) => p.category === category)
      : MOCK_PRODUCTS;
    return { products, source: "mock" };
  }
}

/** Get selling rate from Item Price (Selling, any price list). */
async function fetchItemPrice(itemCode: string): Promise<number | null> {
  try {
    const url = erpUrl("/api/resource/Item Price", {
      filters: JSON.stringify([
        ["item_code", "=", itemCode],
        ["selling", "=", 1],
      ]),
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

/** Get actual qty from stock bin (first warehouse found). */
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
  categories: typeof MOCK_CATEGORIES;
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

    const emojiPool = ["🥬", "🍎", "🌿", "🧺", "🥕", "🌽", "🍇", "🥦"];
    const gradientPool = [
      "from-green-400 to-emerald-600",
      "from-rose-400 to-red-600",
      "from-lime-400 to-green-600",
      "from-amber-400 to-orange-600",
      "from-cyan-400 to-blue-600",
      "from-violet-400 to-purple-600",
    ];
    const categories = groups.map((g, i) => ({
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

export interface CreateSalesOrderPayload {
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
}

export interface CreateSalesOrderResult {
  success: boolean;
  salesOrderName?: string;
  deliveryNoteName?: string;
  message: string;
  mock?: boolean;
}

export async function createSalesOrder(
  payload: CreateSalesOrderPayload
): Promise<CreateSalesOrderResult> {
  if (!isErpnextConfigured()) {
    // Mock — generate a fake SO name so checkout still succeeds.
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

    // Step 2: Ensure Address exists + link to Customer (non-blocking).
    const addressId = await ensureAddress(payload, customerId).catch((err) => {
      console.warn("[ERPNext] ensureAddress failed, continuing without address link:", err);
      return null;
    });

    // Step 3: Build Sales Order payload.
    const today = new Date().toISOString().split("T")[0];
    const soPayload: Record<string, unknown> = {
      customer: customerId,
      transaction_date: today,
      delivery_date: today,
      // Link address ONLY if we got a valid Address ID.
      ...(addressId ? { customer_address: addressId } : {}),
      items: payload.items.map((it) => ({
        item_code: it.itemCode,
        qty: it.qty,
        rate: it.rate,
      })),
      ...(payload.notes ? { additional_notes: payload.notes } : {}),
    };

    // Apply coupon discount at SO level (ERPNext supports
    // discount_amount on Grand Total). Only when > 0.
    if (payload.discount && payload.discount > 0) {
      soPayload.apply_discount_on = "Grand Total";
      soPayload.discount_amount = payload.discount;
    }

    // Step 4: Create Sales Order via Frappe REST API (longer timeout).
    const url = erpUrl("/api/resource/Sales Order");
    const res = await fetchWithTimeout(
      url,
      { method: "POST", body: JSON.stringify(soPayload) },
      15000
    );

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`ERPNext ${res.status}: ${errText}`);
    }
    const json = await res.json();
    const soName = json.data?.name;

    // Step 5: Submit Sales Order (Draft → Submitted).
    await submitDoc(json.data);

    // Step 6: Create + Submit Delivery Note (reduces stock in ERPNext).
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

async function submitDoc(doc: Record<string, unknown>): Promise<void> {
  const url = erpUrl("/api/method/frappe.client.submit");
  const res = await fetchWithTimeout(
    url,
    { method: "POST", body: JSON.stringify({ doc }) },
    15000
  );
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Submit failed (${res.status}): ${errText.substring(0, 200)}`);
  }
}

// ============================================================
// Helper: Create + Submit Delivery Note from Sales Order.
// ============================================================
// Creates a Delivery Note by copying items from the Sales Order,
// then submits it. Submitting the DN reduces stock in ERPNext.
//
// Returns the Delivery Note name or null if creation fails (we
// don't block checkout if DN fails — admin can create DN manually
// from SO in ERPNext UI).
// ============================================================

async function createAndSubmitDeliveryNote(
  soName: string,
  soDoc: Record<string, unknown>
): Promise<string | null> {
  try {
    const today = new Date().toISOString().split("T")[0];
    const items = ((soDoc.items as Array<Record<string, unknown>>) || []).map(
      (it) => ({
        item_code: it.item_code,
        qty: it.qty,
        rate: it.rate,
        against_sales_order: soName,
        so_detail: it.name,
        warehouse: getWarehouse(),
      })
    );

    const dnPayload: Record<string, unknown> = {
      customer: soDoc.customer,
      posting_date: today,
      set_posting_time: 0,
      ...(soDoc.customer_address
        ? { customer_address: soDoc.customer_address }
        : {}),
      items,
    };

    const createUrl = erpUrl("/api/resource/Delivery Note");
    const createRes = await fetchWithTimeout(
      createUrl,
      { method: "POST", body: JSON.stringify(dnPayload) },
      15000
    );

    if (!createRes.ok) {
      const errText = await createRes.text();
      console.warn(
        `[ERPNext] DN creation failed (${createRes.status}): ${errText.substring(0, 200)}`
      );
      return null;
    }

    const createJson = await createRes.json();
    const dnName = createJson.data?.name;

    if (!dnName) {
      console.warn("[ERPNext] DN creation returned no name");
      return null;
    }

    // Submit DN → stock reduced.
    await submitDoc(createJson.data);
    return dnName;
  } catch (err: any) {
    // Non-blocking — checkout already succeeded (SO created + submitted).
    console.warn("[ERPNext] Delivery Note creation failed (non-blocking):", err.message);
    return null;
  }
}

// ============================================================
// Helper: Ensure Address exists + link to Customer.
// ============================================================
// Creates a proper Address document in ERPNext master data, then
// links it to the Customer. Returns Address ID usable in Sales
// Order customer_address.
// ============================================================

async function ensureAddress(
  payload: { customerName: string; address: string; city: string },
  customerId: string
): Promise<string | null> {
  if (!payload.address) return null;

  try {
    const addressTitle = `${payload.customerName}-Shipping`.substring(0, 100);
    const addressPayload = {
      address_title: addressTitle,
      address_type: "Shipping",
      address_line1: payload.address,
      city: payload.city || "Unknown",
      country: "Indonesia",
      is_primary_address: 1,
      links: [{ link_doctype: "Customer", link_name: customerId }],
    };

    const url = erpUrl("/api/resource/Address");
    const res = await fetchWithTimeout(
      url,
      { method: "POST", body: JSON.stringify(addressPayload) },
      15000
    );

    if (!res.ok) {
      const errText = await res.text();
      console.warn(
        `[ERPNext] Address creation failed (${res.status}): ${errText.substring(0, 200)}`
      );
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

/** Find customer by email; if not found, create new Customer in ERPNext. */
export async function ensureCustomer(payload: {
  customerName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
}): Promise<string> {
  // Try to find existing customer by email.
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

  // Create new Customer.
  const custUrl = erpUrl("/api/resource/Customer");
  const custPayload = {
    customer_name: payload.customerName,
    customer_type: "Individual",
    customer_group: "Individual",
    territory: "Indonesia",
    ...(payload.email ? { email_id: payload.email } : {}),
    ...(payload.phone ? { mobile_no: payload.phone } : {}),
  };
  const res = await fetchWithTimeout(
    custUrl,
    { method: "POST", body: JSON.stringify(custPayload) },
    15000
  );
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gagal membuat customer: ${errText}`);
  }
  const json = await res.json();
  return json.data?.name;
}
