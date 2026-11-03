import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import {
  createSession,
  getSessionByToken,
  destroySessionByToken,
  readCustomerSessionToken,
  setCustomerSessionCookieOnResponse,
  clearCustomerSessionCookieOnResponse,
} from "@/lib/session";
import { ensureCustomer } from "@/lib/erpnext";
import { NextResponse } from "next/server";

// ============================================================
// Customer auth — storefront customer accounts.
// ============================================================
// Separate from admin auth (src/lib/admin-auth.ts) because:
//   - Different cookie name (customer_session vs admin_session)
//   - Different model (Customer vs User)
//   - Different permissions (no admin access)
//   - Sync to ERPNext Customer master on register
//
// A customer can be logged in as customer AND admin at the same
// time (separate cookies) — useful for store operators who test
// both sides.
// ============================================================

const BCRYPT_ROUNDS = 10;

export interface CustomerPublic {
  id: string;
  email: string;
  name: string;
  phone: string;
  defaultAddress: string | null;
  defaultCity: string | null;
  defaultNotes: string | null;
  erpCustomerId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerAuthResult {
  customerId: string;
  email: string;
  name: string;
  method: "customer";
}

// ============================================================
// Register — create Customer + sync to ERPNext + start session.
// ============================================================
// Validates: email + phone unique, password >= 6 chars, name +
// phone required. On success:
//   1. bcrypt-hash password
//   2. Create Customer row
//   3. Sync to ERPNext Customer (best-effort, non-blocking)
//   4. Create Session (method='customer')
//   5. Set httpOnly cookie on response
// Returns { customer, token, expiresAt } or throws with message.
// ============================================================

export async function registerCustomer(opts: {
  name: string;
  email: string;
  phone: string;
  password: string;
  defaultAddress?: string;
  defaultCity?: string;
}): Promise<{ customer: CustomerPublic; token: string; expiresAt: Date }> {
  const name = opts.name.trim();
  const email = opts.email.trim().toLowerCase();
  const phone = opts.phone.trim();
  const password = opts.password;

  if (!name) throw new Error("Nama wajib diisi.");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Email tidak valid.");
  }
  if (!phone || phone.length < 8) {
    throw new Error("Nomor telepon tidak valid.");
  }
  if (!password || password.length < 6) {
    throw new Error("Password minimal 6 karakter.");
  }

  // Uniqueness check (Prisma will also enforce, but we want a
  // friendly error before hitting the DB constraint).
  const existingByEmail = await db.customer.findUnique({ where: { email } });
  if (existingByEmail) throw new Error("Email sudah terdaftar. Silakan login.");
  const existingByPhone = await db.customer.findUnique({ where: { phone } });
  if (existingByPhone) throw new Error("Nomor telepon sudah terdaftar.");

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const customer = await db.customer.create({
    data: {
      email,
      name,
      phone,
      passwordHash,
      defaultAddress: opts.defaultAddress?.trim() || null,
      defaultCity: opts.defaultCity?.trim() || null,
    },
  });

  // Sync to ERPNext (best-effort, non-blocking). Store the ERPNext
  // Customer.name (e.g. "CUST-001") on the Customer row for later
  // checkout use. If ERPNext not configured (mock mode), skip.
  ensureCustomer({
    customerName: name,
    email,
    phone,
    address: opts.defaultAddress || "",
    city: opts.defaultCity || "",
  })
    .then((erpId) => {
      if (erpId) {
        db.customer
          .update({ where: { id: customer.id }, data: { erpCustomerId: erpId } })
          .catch(() => {});
      }
    })
    .catch((err) => {
      console.warn("[customer-auth] ERPNext sync failed (non-blocking):", err.message);
    });

  // Start session
  const { token, expiresAt } = await createSession({
    customerId: customer.id,
    email: customer.email,
    role: "customer",
    method: "customer",
  });

  return {
    customer: toPublic(customer),
    token,
    expiresAt,
  };
}

// ============================================================
// Login — verify credentials + start session.
// ============================================================

export async function loginCustomer(opts: {
  email: string;
  password: string;
}): Promise<{ customer: CustomerPublic; token: string; expiresAt: Date }> {
  const email = opts.email.trim().toLowerCase();
  const password = opts.password;

  if (!email || !password) throw new Error("Email dan password wajib diisi.");

  const customer = await db.customer.findUnique({ where: { email } });
  if (!customer || !customer.active) {
    throw new Error("Email atau password salah.");
  }

  const valid = await bcrypt.compare(password, customer.passwordHash);
  if (!valid) {
    throw new Error("Email atau password salah.");
  }

  // Refresh lastLoginAt (best-effort)
  db.customer
    .update({ where: { id: customer.id }, data: { lastLoginAt: new Date() } })
    .catch(() => {});

  const { token, expiresAt } = await createSession({
    customerId: customer.id,
    email: customer.email,
    role: "customer",
    method: "customer",
  });

  return {
    customer: toPublic(customer),
    token,
    expiresAt,
  };
}

// ============================================================
// verifyCustomerAuth — read cookie → Session → Customer.
// ============================================================
// Returns the CustomerPublic if authenticated, null otherwise.
// Used by customer-facing API routes (order history, profile, etc.)
// ============================================================

export async function verifyCustomerAuth(): Promise<CustomerAuthResult | null> {
  const token = await readCustomerSessionToken();
  if (!token) return null;

  const session = await getSessionByToken(token);
  if (!session || session.method !== "customer" || !session.customerId) {
    return null;
  }

  const customer = await db.customer.findUnique({
    where: { id: session.customerId },
    select: { id: true, email: true, name: true, active: true },
  });
  if (!customer || !customer.active) {
    // Customer deleted/disabled — session invalid. Best-effort delete.
    await db.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  return {
    customerId: customer.id,
    email: customer.email,
    name: customer.name,
    method: "customer",
  };
}

// ============================================================
// Get full customer profile (for /api/customer/me).
// ============================================================

export async function getCurrentCustomer(): Promise<CustomerPublic | null> {
  const auth = await verifyCustomerAuth();
  if (!auth) return null;
  const customer = await db.customer.findUnique({ where: { id: auth.customerId } });
  return customer ? toPublic(customer) : null;
}

// ============================================================
// Logout — destroy session + clear cookie.
// ============================================================

export async function logoutCustomer(): Promise<void> {
  const token = await readCustomerSessionToken();
  if (token) {
    await destroySessionByToken(token);
  }
}

// ============================================================
// Update profile — default address, name, phone.
// ============================================================

export async function updateCustomerProfile(
  customerId: string,
  opts: {
    name?: string;
    phone?: string;
    defaultAddress?: string | null;
    defaultCity?: string | null;
    defaultNotes?: string | null;
  }
): Promise<CustomerPublic> {
  const data: Record<string, unknown> = {};
  if (typeof opts.name === "string" && opts.name.trim()) data.name = opts.name.trim();
  if (typeof opts.phone === "string" && opts.phone.trim().length >= 8) {
    // Check phone uniqueness (excluding self)
    const existing = await db.customer.findFirst({
      where: { phone: opts.phone.trim(), NOT: { id: customerId } },
    });
    if (existing) throw new Error("Nomor telepon sudah dipakai akun lain.");
    data.phone = opts.phone.trim();
  }
  if (opts.defaultAddress === null || typeof opts.defaultAddress === "string") {
    data.defaultAddress = opts.defaultAddress?.trim() || null;
  }
  if (opts.defaultCity === null || typeof opts.defaultCity === "string") {
    data.defaultCity = opts.defaultCity?.trim() || null;
  }
  if (opts.defaultNotes === null || typeof opts.defaultNotes === "string") {
    data.defaultNotes = opts.defaultNotes?.trim() || null;
  }

  const updated = await db.customer.update({ where: { id: customerId }, data });
  return toPublic(updated);
}

// ============================================================
// Helpers
// ============================================================

function toPublic(row: {
  id: string;
  email: string;
  name: string;
  phone: string;
  defaultAddress: string | null;
  defaultCity: string | null;
  defaultNotes: string | null;
  erpCustomerId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): CustomerPublic {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    phone: row.phone,
    defaultAddress: row.defaultAddress,
    defaultCity: row.defaultCity,
    defaultNotes: row.defaultNotes,
    erpCustomerId: row.erpCustomerId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ============================================================
// Response helpers — attach/clear customer cookie on NextResponse
// ============================================================

export function attachCustomerSession(
  res: NextResponse,
  token: string,
  expiresAt: Date
): void {
  setCustomerSessionCookieOnResponse(res, token, expiresAt);
}

export function clearCustomerSession(res: NextResponse): void {
  clearCustomerSessionCookieOnResponse(res);
}
