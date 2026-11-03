import { db } from "@/lib/db";
import crypto from "crypto";

// ============================================================
// Integration Config — DB-backed settings with env fallback.
// ============================================================
// Stores ERPNext connection settings in DB so they can be edited
// via admin UI (admin overlay → "Integrasi ERPNext" tab) without
// restarting the server.
//
// Priority: DB > env vars > empty
// Secrets (isSecret=true) are encrypted with AES-256-CBC.
// Encryption key: INTEGRATION_ENCRYPTION_KEY env var
//   (fallback: ADMIN_TOKEN-derived, for dev convenience)
//
// In-memory cache: loaded once on first read, refreshed on save.
// ============================================================

const ENCRYPTION_KEY =
  process.env.INTEGRATION_ENCRYPTION_KEY ||
  process.env.ADMIN_TOKEN ||
  "dev-encryption-key-change-in-production-32b";

// Derive a 32-byte key (AES-256) from whatever we have.
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
    if (!ivHex || !encrypted) return encryptedText; // not encrypted (plain fallback)
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

// ERPNext config keys stored in IntegrationConfig table.
export const ERP_KEYS = {
  URL: "erpnext_url",
  API_KEY: "erpnext_api_key",
  API_SECRET: "erpnext_api_secret",
  SITE: "erpnext_site",
  WAREHOUSE: "erpnext_warehouse",
  COMPANY: "erpnext_company",
} as const;

const SECRET_KEYS = new Set([ERP_KEYS.API_SECRET]);

// In-memory cache (sync access after first load).
let cachedConfig: ErpConfig | null = null;
let cacheLoaded = false;

/**
 * Get ERPNext config (sync). Returns cached value if loaded,
 * otherwise env-based fallback until DB load completes.
 */
export function getErpConfig(): ErpConfig {
  if (cacheLoaded && cachedConfig) {
    return cachedConfig;
  }
  // Env fallback for first call before DB cache loads.
  return envConfig();
}

function envConfig(): ErpConfig {
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
 * Load config from DB into cache (async). Call on startup or after save.
 * Falls back to env vars if DB is empty or unreadable.
 */
export async function loadErpConfig(): Promise<ErpConfig> {
  try {
    const rows = await db.integrationConfig.findMany();
    const map: Record<string, string> = {};
    rows.forEach((row) => {
      map[row.key] = row.isSecret ? decrypt(row.value) : row.value;
    });

    cachedConfig = {
      url: map[ERP_KEYS.URL] || process.env.ERPNEXT_URL || "",
      apiKey: map[ERP_KEYS.API_KEY] || process.env.ERPNEXT_API_KEY || "",
      apiSecret: map[ERP_KEYS.API_SECRET] || process.env.ERPNEXT_API_SECRET || "",
      site: map[ERP_KEYS.SITE] || process.env.ERPNEXT_SITE || "",
      warehouse: map[ERP_KEYS.WAREHOUSE] || process.env.ERPNEXT_WAREHOUSE || "Stores - S",
      company: map[ERP_KEYS.COMPANY] || process.env.ERPNEXT_COMPANY || "SayurLogi",
    };
    cacheLoaded = true;
    return cachedConfig;
  } catch (err) {
    console.warn("[integration-config] DB load failed, using env:", err);
    cachedConfig = envConfig();
    cacheLoaded = true;
    return cachedConfig;
  }
}

/** Refresh cache (call after saving new config). */
export async function refreshConfig(): Promise<ErpConfig> {
  cacheLoaded = false;
  return loadErpConfig();
}

/** Save a config value to DB (encrypts if isSecret). */
export async function setConfigValue(
  key: string,
  value: string,
  isSecret = false
): Promise<void> {
  const storedValue = isSecret ? encrypt(value) : value;
  await db.integrationConfig.upsert({
    where: { key },
    create: { key, value: storedValue, isSecret },
    update: { value: storedValue, isSecret },
  });
}

/**
 * Get all config values for admin display (secrets decrypted so
 * admin can edit them; masked only if requested by caller).
 */
export async function getAllConfigForDisplay(): Promise<
  Record<string, { value: string; isSecret: boolean }>
> {
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

/** Check if ERPNext is configured (has URL + API key + API secret). */
export function isConfigured(): boolean {
  const c = getErpConfig();
  return Boolean(c.url && c.apiKey && c.apiSecret);
}

// Kick off async load on module import (non-blocking). First few
// requests may use env fallback until DB load completes (~ms).
loadErpConfig().catch(() => {});
