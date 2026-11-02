import type { Product } from "@/types";

// ============================================================
// Mock data — enriched fallback when ERPNext is not configured.
// ============================================================
// Used by lib/erpnext.ts when ERPNEXT_URL is empty / unreachable,
// AND by lib/erpnext-sync.ts to seed the local DB on first sync
// (so the storefront shows real-looking products even without an
// ERPNext instance).
//
// These mirror the SayurLogi demo catalog (sayur + buah) with
// ERPNext-compatible fields (itemCode, stock_uom→unit, etc.).
// ============================================================

export interface Category {
  id: string;
  name: string;
  emoji: string;
  gradient: string;
  description: string;
}

export const MOCK_CATEGORIES: Category[] = [
  { id: "Sayuran", name: "Sayuran", emoji: "🥬", gradient: "from-green-400 to-emerald-600", description: "Sayuran segar dari kebun" },
  { id: "Buah", name: "Buah", emoji: "🍎", gradient: "from-rose-400 to-red-600", description: "Buah-buahan manis pilihan" },
];

// Mock products with enriched fields (emoji, oldPrice for sale display).
// itemCode is set so the sync can upsert them by itemCode too.
export const MOCK_PRODUCTS: Product[] = [
  mockProduct("SAY-001", "Bayam Hijau Segar", "1 ikat, dipetik pagi", 8000, null, "Sayuran", "ikat", "🥬", 50),
  mockProduct("SAY-002", "Tomat Merah", "500 gram, ranum", 12000, 15000, "Sayuran", "500g", "🍅", 40),
  mockProduct("SAY-003", "Wortel Lokal", "500 gram, manis", 10000, null, "Sayuran", "500g", "🥕", 35),
  mockProduct("BUAH-001", "Apel Fuji", "1 kg, import", 45000, 52000, "Buah", "kg", "🍎", 25),
  mockProduct("BUAH-002", "Pisang Cavendish", "1 sisir", 28000, null, "Buah", "sisir", "🍌", 30),
  mockProduct("BUAH-003", "Jeruk Manis", "1 kg, juicy", 32000, null, "Buah", "kg", "🍊", 28),
  mockProduct("SAY-004", "Bawang Merah", "500 gram", 18000, null, "Sayuran", "500g", "🧅", 45),
  mockProduct("SAY-005", "Cabai Merah Keriting", "250 gram, pedas", 22000, 28000, "Sayuran", "250g", "🌶️", 20),
  mockProduct("BUAH-004", "Mangga Harum Manis", "1 kg", 38000, null, "Buah", "kg", "🥭", 22),
  mockProduct("SAY-006", "Brokoli Hijau", "1 bunga", 15000, null, "Sayuran", "bunga", "🥦", 18),
  mockProduct("BUAH-005", "Anggur Red Globe", "500 gram", 55000, 62000, "Buah", "500g", "🍇", 15),
  mockProduct("SAY-007", "Jamur Tiram", "250 gram", 13000, null, "Sayuran", "250g", "🍄", 30),
];

function mockProduct(
  itemCode: string,
  name: string,
  description: string,
  price: number,
  oldPrice: number | null,
  category: string,
  unit: string,
  emoji: string,
  stock: number
): Product {
  const now = new Date().toISOString();
  return {
    id: `mock-${itemCode}`,
    itemCode,
    name,
    description,
    price,
    oldPrice,
    category,
    unit,
    image: null,
    emoji,
    stock,
    published: true,
    erpSyncedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

/** Format IDR currency (shared with storefront). */
export function formatIDR(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}
