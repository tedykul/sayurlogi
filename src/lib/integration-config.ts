import { db } from "@/lib/db";
import crypto from "crypto";

// ============================================================
// Integration Config — DB-backed settings with env fallback.
// ============================================================
// Stores ERPNext connection settings in DB so they can be
// edited via admin UI without restarting the server.
//
// Priority: DB > env vars > empty
// Secrets (isSecret=true) are encrypted with AES-256-CBC.
// Encryption key: INTEGRATION_ENCRYPTION_KEY env var
//   (fallback: derived from NEXTAUTH_SECRET for dev convenience)
//
// In-memory cache: loaded once, refreshed on save.
// ============================================================

const ENCRYPTION_KEY =
  process.env.INTEGRATION_ENCRYPTION_KEY ||
  process.env.NEXTAUTH_SECRET ||
  "dev-encryption-key-change-in-production-32b";

// Pad/truncate key to 32 bytes for AES-256
function getKey(): Buffer {
  return crypto.createHash("sha256").update(ENCRYPTION_KEY).digest();
}

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", getKey(), iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

export function decrypt(encryptedText: string): string {
  try {
    const [ivHex, encrypted] = encryptedText.split(":");
    if (!ivHex || !encrypted) return encryptedText; // not encrypted (plain text fallback)
    const iv = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", getKey(), iv);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    return encryptedText; // return as-is if decryption fails
  }
}

export interface ErpConfig {
  url: string;
  apiKey: string;
  apiSecret: string;
  site: string;
  warehouse: string;
  company: string;
}

// Default config keys
export const ERP_KEYS = {
  URL: "erpnext_url",
  API_KEY: "erpnext_api_key",
  API_SECRET: "erpnext_api_secret",
  SITE: "erpnext_site",
  WAREHOUSE: "erpnext_warehouse",
  COMPANY: "erpnext_company",
} as const;

// ============================================================
// Midtrans config keys — payment gateway integration.
// ============================================================
// environment: "sandbox" | "production"
//   sandbox    → use Snap sandbox URL (app.sandbox.midtrans.com)
//   production → use Snap production URL (app.midtrans.com)
// serverKey  → from Midtrans dashboard (per env). SECRET.
// clientKey  → from Midtrans dashboard (per env). Public (used
//              by Snap.js on the frontend).
// enabled    → "true" | "false". Master toggle. When false,
//              checkout falls back to mock payment flow.
// ============================================================

export const MIDTRANS_KEYS = {
  ENVIRONMENT: "midtrans_environment",
  SERVER_KEY: "midtrans_server_key",
  CLIENT_KEY: "midtrans_client_key",
  ENABLED: "midtrans_enabled",
} as const;

// ============================================================
// WhatsApp gateway config keys — order notifications.
// ============================================================
// provider: "fonnte" | "wablas" | "mock"
//   fonnte → https://api.fonnte.com/send-message
//   wablas → https://console.wablas.com/api/send-message
//   mock   → log to console (dev, no real send)
// apiKey  → provider API token. SECRET.
// sender  → sender phone (Wablas) or token (Fonnte). Provider-specific.
// enabled → master toggle. When false, no WA sent (saves credits).
// ============================================================

export const WA_KEYS = {
  PROVIDER: "wa_provider",
  API_KEY: "wa_api_key",
  SENDER: "wa_sender",
  ENABLED: "wa_enabled",
} as const;

const SECRET_KEYS = new Set([
  ERP_KEYS.API_SECRET,
  MIDTRANS_KEYS.SERVER_KEY,
  WA_KEYS.API_KEY,
]);

// In-memory cache
let cachedConfig: ErpConfig | null = null;
let cacheLoaded = false;

/**
 * Get ERPNext config from DB (with env fallback).
 * Uses in-memory cache for sync access after first load.
 * Call refreshConfig() after saving new config.
 */
export function getErpConfig(): ErpConfig {
  if (cacheLoaded && cachedConfig) {
    return cachedConfig;
  }
  // Return env-based config as fallback (sync, for first call before cache loads)
  return {
    url: process.env.ERPNEXT_URL || "",
    apiKey: process.env.ERPNEXT_API_KEY || "",
    apiSecret: process.env.ERPNEXT_API_SECRET || "",
    site: process.env.ERPNEXT_SITE || "",
    warehouse: process.env.ERPNEXT_WAREHOUSE || "Stores - S",
    company: process.env.ERPNEXT_COMPANY || "SayurLogi",
  };
}

/**
 * Load config from DB into cache (async, call on startup or after save).
 * Falls back to env vars if DB is empty.
 */
export async function loadErpConfig(): Promise<ErpConfig> {
  try {
    const rows = await db.integrationConfig.findMany();
    const configMap: Record<string, string> = {};
    rows.forEach((row) => {
      configMap[row.key] = row.isSecret ? decrypt(row.value) : row.value;
    });

    cachedConfig = {
      url: configMap[ERP_KEYS.URL] || process.env.ERPNEXT_URL || "",
      apiKey: configMap[ERP_KEYS.API_KEY] || process.env.ERPNEXT_API_KEY || "",
      apiSecret: configMap[ERP_KEYS.API_SECRET] || process.env.ERPNEXT_API_SECRET || "",
      site: configMap[ERP_KEYS.SITE] || process.env.ERPNEXT_SITE || "",
      warehouse: configMap[ERP_KEYS.WAREHOUSE] || process.env.ERPNEXT_WAREHOUSE || "Stores - S",
      company: configMap[ERP_KEYS.COMPANY] || process.env.ERPNEXT_COMPANY || "SayurLogi",
    };
    cacheLoaded = true;
    return cachedConfig;
  } catch (err) {
    console.warn("[integration-config] Failed to load from DB, using env:", err);
    // Fallback to env
    cachedConfig = {
      url: process.env.ERPNEXT_URL || "",
      apiKey: process.env.ERPNEXT_API_KEY || "",
      apiSecret: process.env.ERPNEXT_API_SECRET || "",
      site: process.env.ERPNEXT_SITE || "",
      warehouse: process.env.ERPNEXT_WAREHOUSE || "Stores - S",
      company: process.env.ERPNEXT_COMPANY || "SayurLogi",
    };
    cacheLoaded = true;
    return cachedConfig;
  }
}

/**
 * Refresh cache (call after saving new config).
 */
export async function refreshConfig(): Promise<ErpConfig> {
  cacheLoaded = false;
  return loadErpConfig();
}

/**
 * Save a config value to DB.
 * If isSecret, encrypts the value before saving.
 */
export async function setConfigValue(key: string, value: string, isSecret = false): Promise<void> {
  const storedValue = isSecret ? encrypt(value) : value;
  await db.integrationConfig.upsert({
    where: { key },
    create: { key, value: storedValue, isSecret },
    update: { value: storedValue, isSecret },
  });
}

/**
 * Get all config values for display (masks secrets).
 */
export async function getAllConfigForDisplay(): Promise<Record<string, { value: string; isSecret: boolean }>> {
  const rows = await db.integrationConfig.findMany();
  const result: Record<string, { value: string; isSecret: boolean }> = {};
  rows.forEach((row) => {
    result[row.key] = {
      value: row.isSecret ? decrypt(row.value) : row.value,
      isSecret: row.isSecret,
    };
  });
  return result;
}

/**
 * Check if ERPNext is configured (has URL + API key + API secret).
 */
export function isConfigured(): boolean {
  const c = getErpConfig();
  return Boolean(c.url && c.apiKey && c.apiSecret);
}

// ============================================================
// Midtrans config — read from DB on demand (no in-memory cache,
// payment config changes are infrequent + we want fresh values).
// ============================================================

export interface MidtransConfig {
  environment: "sandbox" | "production";
  serverKey: string;
  clientKey: string;
  enabled: boolean;
}

export async function getMidtransConfig(): Promise<MidtransConfig> {
  const rows = await db.integrationConfig.findMany({
    where: { key: { startsWith: "midtrans_" } },
  });
  const map: Record<string, string> = {};
  rows.forEach((r) => {
    map[r.key] = r.isSecret ? decrypt(r.value) : r.value;
  });
  const environment = (map[MIDTRANS_KEYS.ENVIRONMENT] === "production" ? "production" : "sandbox") as
    | "sandbox"
    | "production";
  return {
    environment,
    serverKey: map[MIDTRANS_KEYS.SERVER_KEY] || "",
    clientKey: map[MIDTRANS_KEYS.CLIENT_KEY] || "",
    enabled: map[MIDTRANS_KEYS.ENABLED] === "true",
  };
}

/** Snap base URL based on environment. */
export function midtransSnapBaseUrl(env: "sandbox" | "production"): string {
  return env === "production"
    ? "https://app.midtrans.com/snap/v1/transactions"
    : "https://app.sandbox.midtrans.com/snap/v1/transactions";
}

/** Is Midtrans enabled AND configured (has serverKey)? */
export async function isMidtransEnabled(): Promise<boolean> {
  const c = await getMidtransConfig();
  return c.enabled && Boolean(c.serverKey);
}

// ============================================================
// WhatsApp gateway config
// ============================================================

export interface WaConfig {
  provider: "fonnte" | "wablas" | "mock";
  apiKey: string;
  sender: string;
  enabled: boolean;
}

export async function getWaConfig(): Promise<WaConfig> {
  const rows = await db.integrationConfig.findMany({
    where: { key: { startsWith: "wa_" } },
  });
  const map: Record<string, string> = {};
  rows.forEach((r) => {
    map[r.key] = r.isSecret ? decrypt(r.value) : r.value;
  });
  const providerRaw = map[WA_KEYS.PROVIDER] || "mock";
  const provider = (
    providerRaw === "fonnte" || providerRaw === "wablas" ? providerRaw : "mock"
  ) as "fonnte" | "wablas" | "mock";
  return {
    provider,
    apiKey: map[WA_KEYS.API_KEY] || "",
    sender: map[WA_KEYS.SENDER] || "",
    enabled: map[WA_KEYS.ENABLED] === "true",
  };
}

/** Is WA enabled AND configured (has apiKey + provider != mock)? */
export async function isWaEnabled(): Promise<boolean> {
  const c = await getWaConfig();
  return c.enabled && c.provider !== "mock" && Boolean(c.apiKey);
}
