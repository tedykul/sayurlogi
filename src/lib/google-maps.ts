import { db } from "@/lib/db";
import { decrypt } from "@/lib/integration-config";

// ============================================================
// Google Maps — server-side geocoding + distance calculation.
// ============================================================
// All Google Maps API calls happen server-side (no client-side
// JS). API key is stored encrypted in IntegrationConfig table.
// ============================================================

const KEYS = {
  API_KEY: "google_maps_api_key",
  STORE_LAT: "store_latitude",
  STORE_LNG: "store_longitude",
  BASE_FARE: "gojek_base_fare",
  PER_KM: "gojek_per_km_rate",
} as const;

export interface MapsSettings {
  apiKey: string;
  storeLat: number;
  storeLng: number;
  baseFare: number;
  perKmRate: number;
  configured: boolean;
}

// ============================================================
// getMapsSettings — read from DB (decrypt API key).
// ============================================================
// Safe: returns defaults if DB query fails or settings missing.
// Never throws — always returns a valid MapsSettings object.
// ============================================================

export async function getMapsSettings(): Promise<MapsSettings> {
  try {
    const rows = await db.integrationConfig.findMany({
      where: { key: { in: Object.values(KEYS) } },
    });

    const map: Record<string, string> = {};
    rows.forEach((r) => {
      if (r.key === KEYS.API_KEY && r.isSecret) {
        // Decrypt the API key
        try {
          map[r.key] = decrypt(r.value);
        } catch {
          map[r.key] = r.value; // fallback: use raw value
        }
      } else {
        map[r.key] = r.value;
      }
    });

    const apiKey = map[KEYS.API_KEY] || "";
    const storeLat = parseFloat(map[KEYS.STORE_LAT] || "");
    const storeLng = parseFloat(map[KEYS.STORE_LNG] || "");
    const baseFare = parseInt(map[KEYS.BASE_FARE] || "8000", 10);
    const perKmRate = parseInt(map[KEYS.PER_KM] || "2000", 10);

    return {
      apiKey,
      storeLat: isNaN(storeLat) ? 0 : storeLat,
      storeLng: isNaN(storeLng) ? 0 : storeLng,
      baseFare: isNaN(baseFare) ? 8000 : baseFare,
      perKmRate: isNaN(perKmRate) ? 2000 : perKmRate,
      configured: Boolean(apiKey && !isNaN(storeLat) && !isNaN(storeLng)),
    };
  } catch (err) {
    // Return defaults if DB query fails
    return {
      apiKey: "",
      storeLat: 0,
      storeLng: 0,
      baseFare: 8000,
      perKmRate: 2000,
      configured: false,
    };
  }
}

// ============================================================
// saveMapsSettings — save to DB (encrypt API key).
// ============================================================

export async function saveMapsSettings(opts: {
  apiKey?: string;
  storeLat?: number;
  storeLng?: number;
  baseFare?: number;
  perKmRate?: number;
}): Promise<void> {
  const { setConfigValue } = await import("@/lib/integration-config");

  if (opts.apiKey !== undefined) {
    await setConfigValue(KEYS.API_KEY, opts.apiKey, true);
  }
  if (opts.storeLat !== undefined) {
    await setConfigValue(KEYS.STORE_LAT, String(opts.storeLat));
  }
  if (opts.storeLng !== undefined) {
    await setConfigValue(KEYS.STORE_LNG, String(opts.storeLng));
  }
  if (opts.baseFare !== undefined) {
    await setConfigValue(KEYS.BASE_FARE, String(opts.baseFare));
  }
  if (opts.perKmRate !== undefined) {
    await setConfigValue(KEYS.PER_KM, String(opts.perKmRate));
  }
}

// ============================================================
// geocodeAddress — Google Geocoding API (address → lat/lng).
// ============================================================

export async function geocodeAddress(address: string, apiKey: string): Promise<{
  lat: number;
  lng: number;
  error?: string;
}> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&components=country:ID&key=${apiKey}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      return { lat: 0, lng: 0, error: `HTTP ${res.status}` };
    }

    const data = await res.json();
    // Return Google's actual status + error_message for debugging
    if (data.status !== "OK") {
      const detail = data.error_message || data.status;
      return { lat: 0, lng: 0, error: detail };
    }
    if (!data.results?.[0]?.geometry?.location) {
      return { lat: 0, lng: 0, error: "No results from Google" };
    }

    return {
      lat: data.results[0].geometry.location.lat,
      lng: data.results[0].geometry.location.lng,
    };
  } catch (err: any) {
    return { lat: 0, lng: 0, error: err.message };
  }
}

// ============================================================
// calculateDistance — Google Distance Matrix API.
// ============================================================

export async function calculateDistance(destLat: number, destLng: number): Promise<{
  distanceKm: number;
  durationMin: number;
  error?: string;
}> {
  const settings = await getMapsSettings();
  if (!settings.configured) {
    return { distanceKm: 0, durationMin: 0, error: "Google Maps belum dikonfigurasi" };
  }

  const origins = `${settings.storeLat},${settings.storeLng}`;
  const destinations = `${destLat},${destLng}`;
  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origins}&destinations=${destinations}&key=${settings.apiKey}&units=metric&mode=driving`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      return { distanceKm: 0, durationMin: 0, error: `Distance Matrix API error: ${res.status}` };
    }

    const data = await res.json();
    if (data.status !== "OK" || !data.rows?.[0]?.elements?.[0]) {
      return { distanceKm: 0, durationMin: 0, error: "Rute tidak ditemukan" };
    }

    const element = data.rows[0].elements[0];
    if (element.status !== "OK") {
      return { distanceKm: 0, durationMin: 0, error: "Tidak dapat mencapai lokasi" };
    }

    const distanceKm = element.distance?.value ? element.distance.value / 1000 : 0;
    const durationMin = element.duration?.value ? Math.round(element.duration.value / 60) : 0;

    return { distanceKm: Math.round(distanceKm * 10) / 10, durationMin };
  } catch (err: any) {
    return { distanceKm: 0, durationMin: 0, error: "Koneksi gagal" };
  }
}

// ============================================================
// calculateGojekShipping — geocode (if address) + distance + fee.
// ============================================================

export async function calculateGojekShipping(destLat: number, destLng: number): Promise<{
  fee: number;
  distanceKm: number;
  durationMin: number;
  error?: string;
}> {
  const settings = await getMapsSettings();
  if (!settings.configured) {
    return { fee: 0, distanceKm: 0, durationMin: 0, error: "Google Maps belum dikonfigurasi" };
  }

  const { distanceKm, durationMin, error } = await calculateDistance(destLat, destLng);
  if (error) {
    return { fee: 0, distanceKm: 0, durationMin: 0, error };
  }

  const fee = settings.baseFare + Math.ceil(distanceKm) * settings.perKmRate;
  return { fee, distanceKm, durationMin };
}
