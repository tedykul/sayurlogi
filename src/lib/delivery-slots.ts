import { db } from "@/lib/db";

// ============================================================
// Delivery Slots — generate, list, book, release.
// ============================================================
// Default slots: Pagi (09-12), Siang (12-15), Sore (15-18).
// Generated for the next 7 days on-demand. Admin can:
//   - enable/disable scheduling (SiteSetting.deliverySchedulingEnabled)
//   - close specific slots (closed=true)
//   - block specific dates (blockedDates JSON in SiteSetting)
//   - set maxOrders per slot
//
// Same-day cutoff: orders placed before 13:00 WIB can pick
// today's remaining slots. After 13:00, only future days.
// ============================================================

export interface SlotInfo {
  id: string;
  date: string; // YYYY-MM-DD
  startHour: number;
  endHour: number;
  label: string; // "Pagi" | "Siang" | "Sore"
  maxOrders: number;
  currentOrders: number;
  closed: boolean;
  /// Derived: is this slot still bookable?
  available: boolean;
  /// Derived: formatted label "Sen, 3 Nov · 09:00-12:00"
  displayLabel: string;
  /// Derived: short date "Sen, 3 Nov"
  dateLabel: string;
  /// Derived: time window "09:00-12:00"
  timeLabel: string;
}

const DEFAULT_SLOT_TEMPLATES = [
  { startHour: 9, endHour: 12, label: "Pagi" },
  { startHour: 12, endHour: 15, label: "Siang" },
  { startHour: 15, endHour: 18, label: "Sore" },
] as const;

export interface SlotTemplate {
  startHour: number;
  endHour: number;
  label: string;
}

// ============================================================
// getSlotTemplates — read from DB, fallback to default.
// ============================================================
// Stored as JSON in IntegrationConfig (key: delivery_slot_templates).
// If empty or missing → use DEFAULT_SLOT_TEMPLATES (Pagi/Siang/Sore).
// ============================================================

export async function getSlotTemplates(): Promise<SlotTemplate[]> {
  try {
    const row = await db.integrationConfig.findUnique({
      where: { key: "delivery_slot_templates" },
    });
    if (!row) return [...DEFAULT_SLOT_TEMPLATES];
    const parsed = JSON.parse(row.value);
    if (!Array.isArray(parsed) || parsed.length === 0) return [...DEFAULT_SLOT_TEMPLATES];
    return parsed
      .filter((t: any) => typeof t.startHour === "number" && typeof t.endHour === "number" && typeof t.label === "string")
      .sort((a: SlotTemplate, b: SlotTemplate) => a.startHour - b.startHour);
  } catch {
    return [...DEFAULT_SLOT_TEMPLATES];
  }
}

// ============================================================
// setSlotTemplates — save custom templates to DB.
// ============================================================

export async function setSlotTemplates(templates: SlotTemplate[]): Promise<void> {
  const clean = templates
    .filter((t) => t.label.trim() && t.startHour >= 0 && t.startHour <= 23 && t.endHour > t.startHour && t.endHour <= 24)
    .sort((a, b) => a.startHour - b.startHour);
  await db.integrationConfig.upsert({
    where: { key: "delivery_slot_templates" },
    create: { key: "delivery_slot_templates", value: JSON.stringify(clean) },
    update: { value: JSON.stringify(clean) },
  });
}

const SAME_DAY_CUTOFF_HOUR = 13; // 13:00 WIB
const DEFAULT_MAX_ORDERS = 20;
const FORECAST_DAYS = 7;

const DAY_NAMES = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

// ============================================================
// isSchedulingEnabled — read master toggle from SiteSetting.
// ============================================================

export async function isSchedulingEnabled(): Promise<boolean> {
  const setting = await db.siteSetting.findUnique({
    where: { id: "singleton" },
    select: { deliverySchedulingEnabled: true },
  });
  return setting?.deliverySchedulingEnabled ?? false;
}

// ============================================================
// getBlockedDates — admin can block specific dates (libur dll).
// Stored as JSON array in SiteSetting.blockedDates (new field
// would be cleaner, but reuse existing pattern via note field
// is messy — we store in a separate IntegrationConfig key for
// now to avoid another schema migration).
// ============================================================

export async function getBlockedDates(): Promise<string[]> {
  const row = await db.integrationConfig.findUnique({
    where: { key: "delivery_blocked_dates" },
  });
  if (!row) return [];
  try {
    const arr = JSON.parse(row.value);
    return Array.isArray(arr) ? arr.filter((d) => typeof d === "string") : [];
  } catch {
    return [];
  }
}

export async function setBlockedDates(dates: string[]): Promise<void> {
  const clean = dates.filter((d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d));
  await db.integrationConfig.upsert({
    where: { key: "delivery_blocked_dates" },
    create: { key: "delivery_blocked_dates", value: JSON.stringify(clean) },
    update: { value: JSON.stringify(clean) },
  });
}

// ============================================================
// generateAndListSlots — ensure slots exist for next 7 days +
// return them with availability info.
// ============================================================

export async function generateAndListSlots(): Promise<SlotInfo[]> {
  const enabled = await isSchedulingEnabled();
  if (!enabled) return [];

  const blockedDates = new Set(await getBlockedDates());
  const templates = await getSlotTemplates();
  const now = new Date();
  const slots: SlotInfo[] = [];

  // Generate for next 7 days
  for (let dayOffset = 0; dayOffset < FORECAST_DAYS; dayOffset++) {
    const date = new Date(now);
    date.setDate(now.getDate() + dayOffset);
    date.setHours(0, 0, 0, 0);
    const dateStr = date.toISOString().split("T")[0]; // YYYY-MM-DD

    // Skip blocked dates
    if (blockedDates.has(dateStr)) continue;

    // Same-day cutoff: skip today if past 13:00
    if (dayOffset === 0 && now.getHours() >= SAME_DAY_CUTOFF_HOUR) continue;

    for (const tmpl of templates) {
      // Same-day: skip slots that already started
      if (dayOffset === 0 && now.getHours() >= tmpl.startHour) continue;

      // Upsert slot row (create if not exists)
      const slot = await db.deliverySlot.upsert({
        where: { date_startHour: { date: dateStr, startHour: tmpl.startHour } },
        create: {
          date: dateStr,
          startHour: tmpl.startHour,
          endHour: tmpl.endHour,
          label: tmpl.label,
          maxOrders: DEFAULT_MAX_ORDERS,
        },
        update: {}, // no update — keep existing currentOrders/closed
      });

      const available = !slot.closed && (slot.maxOrders === 0 || slot.currentOrders < slot.maxOrders);
      slots.push({
        id: slot.id,
        date: slot.date,
        startHour: slot.startHour,
        endHour: slot.endHour,
        label: slot.label,
        maxOrders: slot.maxOrders,
        currentOrders: slot.currentOrders,
        closed: slot.closed,
        available,
        displayLabel: `${formatDateLabel(date)} · ${formatTimeLabel(tmpl.startHour, tmpl.endHour)}`,
        dateLabel: formatDateLabel(date),
        timeLabel: formatTimeLabel(tmpl.startHour, tmpl.endHour),
      });
    }
  }

  return slots;
}

// ============================================================
// bookSlot — increment currentOrders (atomic, race-safe).
// ============================================================
// Returns the SlotInfo snapshot (for order record) or throws
// if slot not found / full / closed.
// ============================================================

export async function bookSlot(slotId: string): Promise<SlotInfo> {
  const slot = await db.deliverySlot.findUnique({ where: { id: slotId } });
  if (!slot) throw new Error("Slot tidak ditemukan.");
  if (slot.closed) throw new Error("Slot sudah ditutup.");
  if (slot.maxOrders > 0 && slot.currentOrders >= slot.maxOrders) {
    throw new Error("Slot sudah penuh.");
  }

  const updated = await db.deliverySlot.update({
    where: { id: slotId },
    data: { currentOrders: { increment: 1 } },
  });

  const date = new Date(slot.date + "T00:00:00");
  return {
    id: updated.id,
    date: updated.date,
    startHour: updated.startHour,
    endHour: updated.endHour,
    label: updated.label,
    maxOrders: updated.maxOrders,
    currentOrders: updated.currentOrders,
    closed: updated.closed,
    available: !updated.closed && (updated.maxOrders === 0 || updated.currentOrders < updated.maxOrders),
    displayLabel: `${formatDateLabel(date)} · ${formatTimeLabel(updated.startHour, updated.endHour)}`,
    dateLabel: formatDateLabel(date),
    timeLabel: formatTimeLabel(updated.startHour, updated.endHour),
  };
}

// ============================================================
// releaseSlot — decrement currentOrders (on order cancel).
// Best-effort, never throws.
// ============================================================

export async function releaseSlot(slotId: string): Promise<void> {
  try {
    await db.deliverySlot.update({
      where: { id: slotId },
      data: { currentOrders: { decrement: 1 } },
    });
  } catch {
    // best-effort — slot may have been deleted
  }
}

// ============================================================
// Admin: list all slots (for management UI).
// ============================================================

export async function listSlotsForAdmin(opts: { dateFilter?: string } = {}): Promise<SlotInfo[]> {
  const where = opts.dateFilter ? { date: opts.dateFilter } : undefined;
  const rows = await db.deliverySlot.findMany({
    where,
    orderBy: [{ date: "asc" }, { startHour: "asc" }],
    take: 200,
  });
  return rows.map((slot) => {
    const date = new Date(slot.date + "T00:00:00");
    return {
      id: slot.id,
      date: slot.date,
      startHour: slot.startHour,
      endHour: slot.endHour,
      label: slot.label,
      maxOrders: slot.maxOrders,
      currentOrders: slot.currentOrders,
      closed: slot.closed,
      available: !slot.closed && (slot.maxOrders === 0 || slot.currentOrders < slot.maxOrders),
      displayLabel: `${formatDateLabel(date)} · ${formatTimeLabel(slot.startHour, slot.endHour)}`,
      dateLabel: formatDateLabel(date),
      timeLabel: formatTimeLabel(slot.startHour, slot.endHour),
    };
  });
}

// ============================================================
// Admin: close/open slot, set maxOrders.
// ============================================================

export async function setSlotClosed(slotId: string, closed: boolean): Promise<void> {
  await db.deliverySlot.update({ where: { id: slotId }, data: { closed } });
}

export async function setSlotMaxOrders(slotId: string, maxOrders: number): Promise<void> {
  await db.deliverySlot.update({ where: { id: slotId }, data: { maxOrders: Math.max(0, Math.floor(maxOrders)) } });
}

// ============================================================
// Helpers — format date/time labels in Indonesian.
// ============================================================

function formatDateLabel(date: Date): string {
  const dayName = DAY_NAMES[date.getDay()];
  const day = date.getDate();
  const monthName = MONTH_NAMES[date.getMonth()];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  if (date.getTime() === today.getTime()) return `Hari ini, ${day} ${monthName}`;
  if (date.getTime() === tomorrow.getTime()) return `Besok, ${day} ${monthName}`;
  return `${dayName}, ${day} ${monthName}`;
}

function formatTimeLabel(startHour: number, endHour: number): string {
  return `${String(startHour).padStart(2, "0")}:00-${String(endHour).padStart(2, "0")}:00`;
}
