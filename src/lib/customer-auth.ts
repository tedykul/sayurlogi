import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
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

  const valid = await bcrypt.compare(password, customer.passwordHash || "");
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
// Google login — verify Google ID token + create/get customer.
// ============================================================
// Flow (Opsi B — Custom Google OAuth):
//   1. Frontend: Google Identity Services (GIS) renders the Google
//      button. User clicks → Google returns an ID token (JWT).
//   2. Frontend: sends ID token to POST /api/customer/google-login.
//   3. Backend (this function): verify ID token via google-auth-
//      library. Extract email, name, Google sub (unique ID).
//   4. Find existing Customer by googleId OR email. If not found,
//      create new Customer (passwordHash null — Google-only user).
//   5. Create customer_session + set httpOnly cookie (same as
//      email/password login).
//
// Phone handling: Google doesn't provide phone number. New Google
// users get a placeholder phone ("0000000") that must be updated
// via profile page before checkout. Existing customers who link
// Google keep their original phone.
// ============================================================

export async function loginWithGoogle(opts: {
  idToken: string;
  clientId: string;
}): Promise<{ customer: CustomerPublic; token: string; expiresAt: Date; isNewUser: boolean }> {
  const { idToken, clientId } = opts;

  if (!idToken) throw new Error("Google ID token wajib diisi.");
  if (!clientId) throw new Error("Google Client ID belum dikonfigurasi admin.");

  // Verify the ID token using Google's official library.
  // This checks signature, expiry, audience (must match clientId),
  // and issuer (accounts.google.com / https://accounts.google.com).
  const client = new OAuth2Client(clientId);
  let ticket;
  try {
    ticket = await client.verifyIdToken({
      idToken,
      audience: clientId,
    });
  } catch (err: any) {
    console.error("[customer-auth] Google token verification failed:", err.message);
    throw new Error("Token Google tidak valid atau sudah kedaluwarsa.");
  }

  const payload = ticket.getPayload();
  if (!payload) {
    throw new Error("Token Google tidak berisi data.");
  }

  const googleId = payload["sub"];
  const email = (payload["email"] || "").toLowerCase().trim();
  const name = payload["name"] || email.split("@")[0] || "Google User";

  if (!googleId || !email) {
    throw new Error("Token Google tidak berisi email/ID.");
  }

  // Check if email is verified by Google — we only accept verified
  // emails to prevent account hijacking via unverified Google emails.
  if (payload["email_verified"] !== true) {
    throw new Error("Email Google belum terverifikasi. Verifikasi email Anda di Google dulu.");
  }

  // Find existing customer by googleId OR email.
  // - If found by googleId → returning Google user.
  // - If found by email (but no googleId) → link Google account
  //   to existing email/password account.
  // - If not found → create new Customer (Google-only, no password).
  let customer = await db.customer.findFirst({
    where: {
      OR: [{ googleId }, { email }],
    },
  });

  let isNewUser = false;

  if (!customer) {
    // Create new Customer. Phone is required by schema (unique), so
    // we use a placeholder. User must update it via profile page.
    // Format: "GOOGLE-{googleId truncated}" ensures uniqueness.
    const placeholderPhone = `GOOGLE-${googleId.slice(0, 16)}`;

    customer = await db.customer.create({
      data: {
        email,
        name,
        phone: placeholderPhone,
        passwordHash: null, // Google-only user
        googleId,
        active: true,
      },
    });
    isNewUser = true;

    // Sync to ERPNext (best-effort — same as registerCustomer).
    ensureCustomer({
      customerName: name,
      email,
      phone: placeholderPhone,
      address: "",
      city: "",
    }).catch(() => {});
  } else if (!customer.googleId) {
    // Existing email/password customer — link their Google account.
    customer = await db.customer.update({
      where: { id: customer.id },
      data: { googleId },
    });
  }

  if (!customer.active) {
    throw new Error("Akun Anda dinonaktifkan. Hubungi admin.");
  }

  // Refresh lastLoginAt (best-effort)
  db.customer
    .update({ where: { id: customer.id }, data: { lastLoginAt: new Date() } })
    .catch(() => {});

  // Create customer_session (same as email/password login).
  const { token, expiresAt } = await createSession({
    customerId: customer.id,
    email: customer.email,
    role: "customer",
    method: "google",
  });

  return {
    customer: toPublic(customer),
    token,
    expiresAt,
    isNewUser,
  };
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
