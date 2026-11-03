import type { Product, Category } from "@/types/grocery";

// ============================================================
// MOCK DATA — Used as fallback when ERPNext is not reachable
// (e.g., in sandbox where 192.168.1.14:8001 is not accessible)
// When ERPNext IS configured & reachable, API routes will
// return real data instead.
// ============================================================

export const MOCK_CATEGORIES: Category[] = [
  {
    id: "Sayuran",
    name: "Sayuran",
    emoji: "🥬",
    gradient: "from-green-400 to-emerald-600",
    description: "Sayuran segar langsung dari kebun petani lokal",
  },
  {
    id: "Buah",
    name: "Buah",
    emoji: "🍎",
    gradient: "from-rose-400 to-red-600",
    description: "Buah-buahan segar pilihan dengan kualitas premium",
  },
  {
    id: "Herbal",
    name: "Herbal & Rempah",
    emoji: "🌿",
    gradient: "from-lime-400 to-green-600",
    description: "Rempah dan tanaman herbal untuk dapur & kesehatan",
  },
  {
    id: "Paket",
    name: "Paket Hemat",
    emoji: "🧺",
    gradient: "from-amber-400 to-orange-600",
    description: "Paket sayur & buah mingguan dengan harga hemat",
  },
];

export const MOCK_PRODUCTS: Product[] = [
  // ===== SAYURAN =====
  {
    id: "TOMAT-MERAH-001",
    itemCode: "TMT-001",
    name: "Tomat Merah Segar",
    description: "Tomat merah ranum, manis dan segar. Cocok untuk masak atau lalapan.",
    category: "Sayuran",
    price: 18000,
    oldPrice: 22000,
    unit: "kg",
    stock: 45,
    emoji: "🍅",
    organic: false,
    onSale: true,
    tags: ["lokal", "segar"],
  },
  {
    id: "BAYAM-HIJAU-001",
    itemCode: "BYM-001",
    name: "Bayam Hijau Organik",
    description: "Bayam hijau organik tanpa pestisida, dipanen pagi hari.",
    category: "Sayuran",
    price: 8000,
    unit: "ikat",
    stock: 60,
    emoji: "🥬",
    organic: true,
    tags: ["organik", "lokal"],
  },
  {
    id: "WORTEL-001",
    itemCode: "WRT-001",
    name: "Wortel Lokal",
    description: "Wortel lokal manis dan renyah, kaya vitamin A.",
    category: "Sayuran",
    price: 12000,
    unit: "kg",
    stock: 38,
    emoji: "🥕",
    tags: ["lokal", "segar"],
  },
  {
    id: "BROKOLI-001",
    itemCode: "BRK-001",
    name: "Brocoli Segar",
    description: "Brokoli hijau segar, kaya antioksidan dan serat.",
    category: "Sayuran",
    price: 25000,
    oldPrice: 30000,
    unit: "kg",
    stock: 22,
    emoji: "🥦",
    onSale: true,
    tags: ["segar"],
  },
  {
    id: "JAGUNG-001",
    itemCode: "JGG-001",
    name: "Jagung Manis",
    description: "Jagung manis lokal, manis legit dan juicy.",
    category: "Sayuran",
    price: 5000,
    unit: "pcs",
    stock: 80,
    emoji: "🌽",
    tags: ["lokal"],
  },
  {
    id: "CABAI-MERAAH-001",
    itemCode: "CBL-001",
    name: "Cabai Merah Keriting",
    description: "Cabai merah keriting pedas, segar dari kebun.",
    category: "Sayuran",
    price: 35000,
    unit: "kg",
    stock: 15,
    emoji: "🌶️",
    tags: ["lokal", "segar"],
  },
  {
    id: "TIMUN-001",
    itemCode: "TMN-001",
    name: "Timun Segar",
    description: "Timun segar renyah, cocok untuk lalapan atau salad.",
    category: "Sayuran",
    price: 10000,
    unit: "kg",
    stock: 50,
    emoji: "🥒",
    tags: ["lokal"],
  },
  {
    id: "TERONG-001",
    itemCode: "TRG-001",
    name: "Terong Ungu",
    description: "Terong ungu lokal, lembut dan cocok untuk gulai.",
    category: "Sayuran",
    price: 14000,
    unit: "kg",
    stock: 30,
    emoji: "🍆",
    tags: ["lokal"],
  },

  // ===== BUAH =====
  {
    id: "APEL-001",
    itemCode: "APL-001",
    name: "Apel Fuji",
    description: "Apel Fuji impor, manis dan crunchy. Ukuran besar.",
    category: "Buah",
    price: 45000,
    oldPrice: 55000,
    unit: "kg",
    stock: 28,
    emoji: "🍎",
    onSale: true,
    tags: ["impor"],
  },
  {
    id: "PISANG-001",
    itemCode: "PSG-001",
    name: "Pisang Cavendish",
    description: "Pisang Cavendish lokal, manis dan matang sempurna.",
    category: "Buah",
    price: 20000,
    unit: "kg",
    stock: 42,
    emoji: "🍌",
    tags: ["lokal"],
  },
  {
    id: "JERUK-001",
    itemCode: "JRK-001",
    name: "Jeruk Manis",
    description: "Jeruk manis lokal, juicy dan kaya vitamin C.",
    category: "Buah",
    price: 28000,
    unit: "kg",
    stock: 35,
    emoji: "🍊",
    tags: ["lokal"],
  },
  {
    id: "ANGGUR-001",
    itemCode: "AGR-001",
    name: "Anggur Merah",
    description: "Anggur merah impor, manis dan tanpa biji.",
    category: "Buah",
    price: 65000,
    oldPrice: 75000,
    unit: "kg",
    stock: 18,
    emoji: "🍇",
    onSale: true,
    tags: ["impor"],
  },
  {
    id: "SEMANGKA-001",
    itemCode: "SMK-001",
    name: "Semangka Merah",
    description: "Semangka merah lokal, manis dan segar. Satu buah utuh.",
    category: "Buah",
    price: 30000,
    unit: "pcs",
    stock: 25,
    emoji: "🍉",
    tags: ["lokal"],
  },
  {
    id: "MANGGA-001",
    itemCode: "MNG-001",
    name: "Mangga Harum Manis",
    description: "Mangga harum manis lokal, manis legit dan harum.",
    category: "Buah",
    price: 32000,
    unit: "kg",
    stock: 20,
    emoji: "🥭",
    tags: ["lokal"],
  },
  {
    id: "STROBERI-001",
    itemCode: "STB-001",
    name: "Stroberi Segar",
    description: "Stroberi segar dari dataran tinggi, manis asam menyegarkan.",
    category: "Buah",
    price: 40000,
    unit: "kg",
    stock: 16,
    emoji: "🍓",
    organic: true,
    tags: ["lokal", "organik"],
  },
  {
    id: "NANAS-001",
    itemCode: "NNS-001",
    name: "Nanas Madu",
    description: "Nanas madu lokal, manis dan harum. Satu buah utuh.",
    category: "Buah",
    price: 22000,
    unit: "pcs",
    stock: 24,
    emoji: "🍍",
    tags: ["lokal"],
  },

  // ===== HERBAL & REMPAH =====
  {
    id: "DAUN-KETUMBAR-001",
    itemCode: "DKT-001",
    name: "Daun Ketumbar",
    description: "Daun ketumbar segar, aroma harum untuk masakan.",
    category: "Herbal",
    price: 5000,
    unit: "ikat",
    stock: 40,
    emoji: "🌿",
    tags: ["segar"],
  },
  {
    id: "SERAI-001",
    itemCode: "SRI-001",
    name: "Serai Segar",
    description: "Serai segar untuk bumbu masak dan teh herbal.",
    category: "Herbal",
    price: 4000,
    unit: "ikat",
    stock: 55,
    emoji: "🌾",
    tags: ["lokal"],
  },
  {
    id: "JAHE-001",
    itemCode: "JHE-001",
    name: "Jahe Merah",
    description: "Jahe merah organik, pedas hangat untuk kesehatan.",
    category: "Herbal",
    price: 28000,
    unit: "kg",
    stock: 20,
    emoji: "🫚",
    organic: true,
    tags: ["organik", "lokal"],
  },
  {
    id: "KUNYIT-001",
    itemCode: "KNT-001",
    name: "Kunyit Segar",
    description: "Kunyit segar, anti-inflamasi alami untuk jamu.",
    category: "Herbal",
    price: 20000,
    unit: "kg",
    stock: 25,
    emoji: "🟡",
    tags: ["lokal"],
  },

  // ===== PAKET HEMAT =====
  {
    id: "PAKET-SAYUR-MINGGUAN-001",
    itemCode: "PKT-001",
    name: "Paket Sayur Mingguan",
    description: "Paket 7 jenis sayur segar untuk konsumsi seminggu. Hemat 20%!",
    category: "Paket",
    price: 85000,
    oldPrice: 105000,
    unit: "paket",
    stock: 12,
    emoji: "🧺",
    onSale: true,
    tags: ["hemat"],
  },
  {
    id: "PAKET-BUAH-SEMANGKA-001",
    itemCode: "PKT-002",
    name: "Paket Buah Keluarga",
    description: "Paket 5 jenis buah untuk keluarga. Variasi sehat setiap hari.",
    category: "Paket",
    price: 120000,
    oldPrice: 140000,
    unit: "paket",
    stock: 10,
    emoji: "🛍️",
    onSale: true,
    tags: ["hemat"],
  },
  {
    id: "PAKET-JUICE-001",
    itemCode: "PKT-003",
    name: "Paket Juice Cleanse",
    description: "Paket sayur & buah untuk 3 hari juice cleanse. Detox alami.",
    category: "Paket",
    price: 150000,
    unit: "paket",
    stock: 8,
    emoji: "🥤",
    organic: true,
    tags: ["organik", "hemat"],
  },
];

// ============================================================
// Enrichment — derive optional fields (rating, reviewCount,
// longDescription, benefits, storageTip, origin) for the detail
// modal. Keeps base product records short while letting the modal
// show rich, contextual content. Pure function; safe to extend.
// ============================================================

const BENEFITS_BY_CATEGORY: Record<string, string[]> = {
  Sayuran: [
    "Kaya serat untuk pencernaan sehat",
    "Sumber vitamin & mineral alami",
    "Rendah kalori, cocok untuk diet",
    "Antioksidan tinggi melawan radikal bebas",
  ],
  Buah: [
    "Boost imunitas dengan vitamin C",
    "Sumber energi alami dari fruktosa",
    "Menyehatkan kulit dari dalam",
    "Serat tinggi untuk kenyang lebih lama",
  ],
  Herbal: [
    "Bahan alami untuk jamu tradisional",
    "Anti-inflamasi alami",
    "Membantu menjaga kesehatan tubuh",
    "Aroma harum untuk masakan",
  ],
  Paket: [
    "Hemat hingga 20% dibanding beli satuan",
    "Variasi produk untuk seminggu",
    "Pilihan nutrisi lengkap & seimbang",
    "Praktis — tinggal masak tanpa pilih satu-satu",
  ],
};

const STORAGE_TIP_BY_CATEGORY: Record<string, string> = {
  Sayuran: "Simpan di kulkas bagian sayur (suhu 4-8°C). Cuci sebelum dikonsumsi, jangan sebelum disimpan agar tidak cepat layu.",
  Buah: "Simpan di tempat sejuk dan kering. Buah yang sudah matang bisa masuk kulkas untuk perpanjang umur 3-5 hari.",
  Herbal: "Bungkus dengan kertas tissue, masuk ke kantong plastik berlubang, simpan di kulkas. Tahan hingga 5-7 hari.",
  Paket: "Pisahkan sayur dan buah saat penyimpanan. Sayur ke kulkas, buah ke tempat sejuk agar tidak cepat masak.",
};

const ORIGIN_BY_TAG: Record<string, string> = {
  lokal: "Petani lokal Indonesia",
  impor: "Impor premium",
  organik: "Kebun organik bersertifikat",
};

/** Derive rating between 4.2 - 4.9 based on itemCode hash (deterministic) */
function deriveRating(itemCode: string): number {
  let hash = 0;
  for (let i = 0; i < itemCode.length; i++) {
    hash = (hash * 31 + itemCode.charCodeAt(i)) >>> 0;
  }
  return 4.2 + (hash % 8) / 10; // 4.2 - 4.9
}

/** Derive review count between 24 - 480 deterministically */
function deriveReviewCount(itemCode: string): number {
  let hash = 0;
  for (let i = 0; i < itemCode.length; i++) {
    hash = (hash * 17 + itemCode.charCodeAt(i)) >>> 0;
  }
  return 24 + (hash % 457); // 24 - 480
}

/** Mapping of product IDs to AI-generated product photos. */
const PRODUCT_IMAGES: Record<string, string> = {
  "TOMAT-MERAH-001": "/products/tomat.png",
  "BAYAM-HIJAU-001": "/products/bayam.png",
  "WORTEL-001": "/products/wortel.png",
  "BROKOLI-001": "/products/brokoli.png",
  "APEL-001": "/products/apel.png",
  "ANGGUR-001": "/products/anggur.png",
};

/** Enrich each product with derived optional fields (mutates copy, not source). */
const ENRICHED_PRODUCTS: Product[] = MOCK_PRODUCTS.map((p) => {
  const tags = p.tags || [];
  const originTag = tags.find((t) => ORIGIN_BY_TAG[t]);
  return {
    ...p,
    rating: p.rating ?? deriveRating(p.itemCode),
    reviewCount: p.reviewCount ?? deriveReviewCount(p.itemCode),
    longDescription:
      p.longDescription ??
      `${p.description} Dipanen dan dikurasi langsung oleh tim SayurLogi untuk memastikan kualitas terbaik sampai di meja makan keluarga Anda.`,
    benefits: p.benefits ?? BENEFITS_BY_CATEGORY[p.category] ?? [],
    storageTip: p.storageTip ?? STORAGE_TIP_BY_CATEGORY[p.category] ?? "Simpan di tempat sejuk dan kering.",
    origin: p.origin ?? (originTag ? ORIGIN_BY_TAG[originTag] : "Petani mitra SayurLogi"),
    image: p.image ?? PRODUCT_IMAGES[p.id] ?? undefined,
  };
});

// Override the export so consumers (page.tsx via API) get enriched data.
// MOCK_PRODUCTS is kept raw for backward compatibility (tests, etc.).
export { ENRICHED_PRODUCTS as MOCK_PRODUCTS_ENRICHED };

/** Helper to format IDR currency */
export function formatIDR(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
