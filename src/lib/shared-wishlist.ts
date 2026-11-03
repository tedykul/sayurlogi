import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";

// ============================================================
// SharedWishlist — create + read shareable wishlist snapshots.
// ============================================================
// A shared wishlist is a read-only snapshot of items the sender
// had in their wishlist at share time. Recipients open
//   /?wishlist=<token>
// and see the items in a dialog with "add all to cart" / "save
// to my wishlist" actions.
//
// Token: 10-char base32 (uppercase, no ambiguous chars like
// 0/O/1/I). Unique. Generated with retry on collision.
//
// Expiry: 30 days by default. viewCount incremented on each
// open so the sender (if they keep the link) can see traction.
// ============================================================

const TOKEN_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L
const TOKEN_LENGTH = 10;
const DEFAULT_TTL_DAYS = 30;
const MAX_ITEMS = 50;

export interface SharedWishlistItem {
  id: string;
  name: string;
  price: number;
  emoji: string;
  image: string | null;
  unit: string;
  itemCode: string;
  category: string;
}

export interface SharedWishlistSnapshot {
  id: string;
  token: string;
  title: string;
  items: SharedWishlistItem[];
  viewCount: number;
  createdAt: string;
  expiresAt: string | null;
}

// ============================================================
// generateToken — 10-char base32, collision-safe with retry.
// ============================================================

function generateToken(): string {
  const bytes = randomBytes(TOKEN_LENGTH);
  let out = "";
  for (let i = 0; i < TOKEN_LENGTH; i++) {
    out += TOKEN_ALPHABET[bytes[i] % TOKEN_ALPHABET.length];
  }
  return out;
}

async function generateUniqueToken(): Promise<string> {
  // Try up to 5 times in the unlikely event of a collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const token = generateToken();
    const existing = await db.sharedWishlist.findUnique({
      where: { token },
      select: { id: true },
    });
    if (!existing) return token;
  }
  throw new Error("Gagal membuat token unik. Coba lagi.");
}

// ============================================================
// createSharedWishlist — snapshot items + mint token.
// ============================================================

export async function createSharedWishlist(opts: {
  items: SharedWishlistItem[];
  title?: string;
  ttlDays?: number;
}): Promise<{ token: string; url: string; expiresAt: Date }> {
  if (!opts.items || opts.items.length === 0) {
    throw new Error("Wishlist kosong — tidak ada yang dibagikan.");
  }
  const items = opts.items.slice(0, MAX_ITEMS);
  const token = await generateUniqueToken();
  const expiresAt = new Date(
    Date.now() + (opts.ttlDays ?? DEFAULT_TTL_DAYS) * 24 * 60 * 60 * 1000
  );

  const row = await db.sharedWishlist.create({
    data: {
      token,
      title: opts.title?.trim() || "Wishlist dari SayurLogi",
      itemsJson: JSON.stringify(items),
      expiresAt,
    },
  });

  return {
    token: row.token,
    url: `/?wishlist=${row.token}`,
    expiresAt,
  };
}

// ============================================================
// getSharedWishlistByToken — read snapshot, increment view count.
// ============================================================
// Returns null if not found or expired. Best-effort view count
// increment (non-blocking) so reads stay fast.
// ============================================================

export async function getSharedWishlistByToken(
  token: string
): Promise<SharedWishlistSnapshot | null> {
  const normalized = token.trim().toUpperCase();
  if (!normalized) return null;

  const row = await db.sharedWishlist.findUnique({
    where: { token: normalized },
  });
  if (!row) return null;

  // Expired — clean up lazily.
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
    await db.sharedWishlist.delete({ where: { id: row.id } }).catch(() => {});
    return null;
  }

  // Best-effort view count increment (non-blocking).
  db.sharedWishlist
    .update({ where: { id: row.id }, data: { viewCount: { increment: 1 } } })
    .catch(() => {});

  let items: SharedWishlistItem[] = [];
  try {
    items = JSON.parse(row.itemsJson) as SharedWishlistItem[];
    if (!Array.isArray(items)) items = [];
  } catch {
    items = [];
  }

  return {
    id: row.id,
    token: row.token,
    title: row.title,
    items,
    viewCount: row.viewCount,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt?.toISOString() ?? null,
  };
}
