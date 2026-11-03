"use client";

import { useState, useEffect } from "react";
import { Clock, Loader2, Calendar } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// ============================================================
// DeliverySlotPicker — slot selection UI for checkout.
// ============================================================
// Fetches bookable slots from /api/delivery/slots. If empty
// (scheduling disabled), renders nothing (checkout falls back
// to default estimate). Customer picks a slot → calls onSelect
// with { slotId, displayLabel }.
// ============================================================

export interface SlotInfo {
  id: string;
  date: string;
  startHour: number;
  endHour: number;
  label: string;
  maxOrders: number;
  currentOrders: number;
  closed: boolean;
  available: boolean;
  displayLabel: string;
  dateLabel: string;
  timeLabel: string;
}

interface DeliverySlotPickerProps {
  selectedSlotId: string | null;
  onSelect: (slot: { slotId: string; displayLabel: string } | null) => void;
}

export function DeliverySlotPicker({ selectedSlotId, onSelect }: DeliverySlotPickerProps) {
  const [slots, setSlots] = useState<SlotInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/delivery/slots")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.success && Array.isArray(data.slots)) {
          setSlots(data.slots);
          setEnabled(data.slots.length > 0);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Render nothing if scheduling disabled (no slots)
  if (!loading && !enabled) return null;

  // Group slots by dateLabel for display
  const grouped = slots.reduce((acc, slot) => {
    if (!acc[slot.dateLabel]) acc[slot.dateLabel] = [];
    acc[slot.dateLabel].push(slot);
    return acc;
  }, {} as Record<string, SlotInfo[]>);

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
        <Calendar className="h-3.5 w-3.5 text-primary" />
        Pilih Slot Pengiriman
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Memuat slot...
        </div>
      ) : (
        <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-grocery pr-1">
          {Object.entries(grouped).map(([dateLabel, dateSlots]) => (
            <div key={dateLabel}>
              <p className="text-[10px] font-medium text-muted-foreground mb-1 sticky top-0 bg-card/80 backdrop-blur-sm py-0.5">
                {dateLabel}
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {dateSlots.map((slot) => {
                  const selected = selectedSlotId === slot.id;
                  const full = !slot.available;
                  return (
                    <button
                      key={slot.id}
                      type="button"
                      disabled={full}
                      onClick={() => {
                        onSelect(selected ? null : { slotId: slot.id, displayLabel: slot.displayLabel });
                      }}
                      className={cn(
                        "relative rounded-lg border p-2 text-center transition-all",
                        selected
                          ? "border-primary bg-primary/10 ring-1 ring-primary"
                          : full
                          ? "border-border/40 bg-muted/30 opacity-50 cursor-not-allowed"
                          : "border-border hover:border-primary/50 hover:bg-accent/50"
                      )}
                      aria-pressed={selected}
                    >
                      <p className="text-[11px] font-bold leading-tight">{slot.label}</p>
                      <p className="text-[9px] text-muted-foreground leading-tight mt-0.5">
                        {slot.timeLabel}
                      </p>
                      {full && (
                        <p className="text-[8px] text-destructive font-medium mt-0.5">Penuh</p>
                      )}
                      {!full && slot.maxOrders > 0 && (
                        <p className="text-[8px] text-muted-foreground mt-0.5">
                          {slot.maxOrders - slot.currentOrders} slot
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedSlotId && (
        <p className="text-[10px] text-primary flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Slot terpilih: {slots.find((s) => s.id === selectedSlotId)?.displayLabel}
        </p>
      )}
    </div>
  );
}
