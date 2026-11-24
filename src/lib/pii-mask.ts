// ============================================================
// PII masking helpers — minimal disclosure for UX hints.
// ============================================================
// Used by checkout dedup flow: when an email/phone matches an
// existing Customer, we return a masked version so the frontend
// can show "us***@example.com" as a hint WITHOUT exposing the
// full address. This prevents enumeration while still letting
// the legitimate user recognize their own contact.
//
// NOT a security boundary — the real protection is the 409
// response that blocks guest checkout until the user chooses
// "login" or explicitly "continue as guest".
// ============================================================

/** Mask an email for display. Keeps first 2 chars + domain.
 *  Examples:
 *    "john@example.com"     → "jo***@example.com"
 *    "ab@test.id"           → "ab***@test.id"
 *    "x@y.z"                → "x***@y.z" */
export function maskEmail(email: string): string {
  const e = email.trim().toLowerCase();
  const atIdx = e.indexOf("@");
  if (atIdx < 1) return "***";
  const local = e.slice(0, atIdx);
  const domain = e.slice(atIdx + 1);
  // Show at most first 2 chars of local part, mask the rest.
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

/** Mask a phone for display. Keeps first 4 + last 4 digits.
 *  Examples:
 *    "081234567890" → "0812****7890"
 *    "62812345"     → "6281****2345"
 *    "12345"        → "1234***" (too short — mask middle only) */
export function maskPhone(phone: string): string {
  const p = phone.trim().replace(/[\s\-()]/g, "");
  if (p.length <= 4) return p; // too short to mask meaningfully
  if (p.length <= 8) {
    // Keep first 2 + last 2, mask middle
    return `${p.slice(0, 2)}${"*".repeat(p.length - 4)}${p.slice(-2)}`;
  }
  // Standard: first 4 + last 4
  return `${p.slice(0, 4)}${"*".repeat(p.length - 8)}${p.slice(-4)}`;
}

/** Normalize phone for DB lookup. Mirrors registerCustomer's trim
 *  + lowercases email, trims phone. Does NOT convert 08xxx → 628xxx
 *  because Customer.phone is stored as-is (whatever the user typed
 *  at registration). We just trim + check both formats.
 *  Returns {email, phone} trimmed. */
export function normalizeLookupIdentifiers(opts: {
  email?: string;
  phone?: string;
}): { email: string | null; phone: string | null } {
  const email = opts.email?.trim().toLowerCase() || null;
  const phone = opts.phone?.trim() || null;
  return { email, phone };
}

/** Build a phone variant: convert 08xxx ↔ 628xxx for lookup.
 *  Customer might have registered with "08123" but checking out
 *  with "628123" (or vice versa). Returns array of variants to try.
 *  Includes the original trimmed input. */
export function phoneVariants(phone: string): string[] {
  const p = phone.trim();
  if (!p) return [];
  const variants = new Set<string>([p]);
  // 08xxx → 62xxx
  if (p.startsWith("0")) variants.add("62" + p.slice(1));
  // 62xxx → 0xxx
  if (p.startsWith("62")) variants.add("0" + p.slice(2));
  // +62xxx → strip +
  if (p.startsWith("+")) {
    const stripped = p.slice(1);
    variants.add(stripped);
    if (stripped.startsWith("62")) variants.add("0" + stripped.slice(2));
  }
  return Array.from(variants);
}
