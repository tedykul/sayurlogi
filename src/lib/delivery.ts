import { Clock, Truck, Store } from "lucide-react";

// ============================================================
// Delivery time estimation utility
// ============================================================
// Calculates specific delivery window based on current time + method.
// Business hours: 08:00 - 21:00 WIB (7 days/week).
// Delivery slots: 2-hour windows. Pickup: 30-min ready.
// Cut-off: orders before 19:00 → same-day delivery, after → next day.
// ============================================================

export interface DeliveryEstimate {
  /** Method label: "Antar" or "Ambil Sendiri" */
  methodLabel: string;
  /** ISO date string of earliest delivery */
  earliestDate: Date;
  /** Formatted date string e.g. "Hari ini" / "Besok" / "Senin, 12 Mei" */
  dateLabel: string;
  /** Formatted time window e.g. "15:00 - 17:00 WIB" */
  timeWindow: string;
  /** Duration in hours from now (for sorting / display) */
  durationHours: number;
  /** Whether delivery is same-day */
  sameDay: boolean;
  /** Icon component to display */
  icon: typeof Truck;
}

const BUSINESS_OPEN = 8; // 08:00
const BUSINESS_CLOSE = 21; // 21:00
const SAME_DAY_CUTOFF = 19; // 19:00 — orders after this go next day
const DELIVERY_WINDOW_HOURS = 2; // 2-hour delivery window
const PICKUP_READY_MINUTES = 30; // 30-min pickup ready

/** Format time as "HH:MM" with zero padding */
function formatTime(hour: number, minute: number = 0): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** Get Indonesian day name */
function getDayName(date: Date): string {
  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  return days[date.getDay()];
}

/** Get Indonesian month name */
function getMonthName(date: Date): string {
  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ];
  return months[date.getMonth()];
}

/** Compute date label relative to today */
function getDateLabel(date: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Hari ini";
  if (diffDays === 1) return "Besok";
  return `${getDayName(date)}, ${date.getDate()} ${getMonthName(date)}`;
}

/**
 * Calculate delivery estimate based on method and current time.
 * Pure function — safe to test, no side effects.
 */
export function estimateDelivery(
  method: "delivery" | "pickup",
  now: Date = new Date()
): DeliveryEstimate {
  const currentHour = now.getHours();

  if (method === "pickup") {
    // Pickup: ready in 30 minutes during business hours
    const ready = new Date(now);
    // If outside business hours or after cutoff, schedule next business day 09:00
    if (currentHour < BUSINESS_OPEN || currentHour >= BUSINESS_CLOSE) {
      ready.setDate(ready.getDate() + 1);
      ready.setHours(9, 0, 0, 0);
      // Skip Sunday (closed) — move to Monday
      if (ready.getDay() === 0) ready.setDate(ready.getDate() + 1);
    } else {
      ready.setMinutes(ready.getMinutes() + PICKUP_READY_MINUTES);
    }

    const readyEnd = new Date(ready);
    readyEnd.setMinutes(readyEnd.getMinutes() + 30); // 30-min pickup window

    const durationHours = (ready.getTime() - now.getTime()) / (1000 * 60 * 60);

    return {
      methodLabel: "Ambil Sendiri",
      earliestDate: ready,
      dateLabel: getDateLabel(ready),
      timeWindow: `${formatTime(ready.getHours(), ready.getMinutes())} - ${formatTime(readyEnd.getHours(), readyEnd.getMinutes())} WIB`,
      durationHours: Math.max(0.5, durationHours),
      sameDay: getDateLabel(ready) === "Hari ini",
      icon: Store,
    };
  }

  // Delivery: 2-hour window, same-day if before 19:00
  const earliest = new Date(now);
  let sameDay = currentHour < SAME_DAY_CUTOFF;

  if (sameDay) {
    // Round up to next 2-hour slot starting from current hour + 2
    // e.g., 14:30 → earliest 16:00, window 16:00-18:00
    const startHour = Math.max(currentHour + 2, BUSINESS_OPEN);
    // If start hour exceeds business close, push to next day
    if (startHour + DELIVERY_WINDOW_HOURS > BUSINESS_CLOSE) {
      sameDay = false;
    } else {
      earliest.setHours(startHour, 0, 0, 0);
    }
  }

  if (!sameDay) {
    // Next business day, first slot 09:00-11:00
    earliest.setDate(earliest.getDate() + 1);
    earliest.setHours(9, 0, 0, 0);
    // Skip Sunday
    if (earliest.getDay() === 0) earliest.setDate(earliest.getDate() + 1);
  }

  const latest = new Date(earliest);
  latest.setHours(latest.getHours() + DELIVERY_WINDOW_HOURS);

  const durationHours = (earliest.getTime() - now.getTime()) / (1000 * 60 * 60);

  return {
    methodLabel: "Antar",
    earliestDate: earliest,
    dateLabel: getDateLabel(earliest),
    timeWindow: `${formatTime(earliest.getHours())} - ${formatTime(latest.getHours())} WIB`,
    durationHours: Math.max(2, durationHours),
    sameDay,
    icon: Truck,
  };
}
