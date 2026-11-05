"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2, Calendar, Clock, Truck, Power, X, Check, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { motion, AnimatePresence } from "framer-motion";
import { adminFetch } from "@/lib/admin-client";
import { toast } from "sonner";
import {
  AdminSectionHeading,
  AdminCard,
  AdminEmptyState,
} from "../admin-ui";
import { cn } from "@/lib/utils";
import { DeliveryZoneEditor } from "./delivery-zone-editor";
import { MapsSettingsEditor } from "./maps-settings-editor";
import { BiteshipSettingsEditor } from "./biteship-settings-editor";
import { SlotTemplateEditor } from "./slot-template-editor";

// ============================================================
// DeliveryEditor — admin manages delivery scheduling.
// ============================================================
// - Toggle enable/disable globally
// - Block specific dates (libur, Minggu)
// - View all slots (next 7 days) + close/open + set maxOrders
// ============================================================

interface SlotInfo {
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

export function DeliveryEditor() {
  const [enabled, setEnabled] = useState(false);
  const [blockedDates, setBlockedDates] = useState<string[]>([]);
  const [newBlockedDate, setNewBlockedDate] = useState("");
  const [slots, setSlots] = useState<SlotInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingToggle, setSavingToggle] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsRes, slotsRes] = await Promise.all([
        adminFetch<{ success: boolean; enabled: boolean; blockedDates: string[] }>(
          "/api/admin/delivery/settings"
        ),
        adminFetch<{ success: boolean; slots: SlotInfo[]; enabled: boolean }>(
          "/api/admin/delivery/slots"
        ),
      ]);
      setEnabled(settingsRes.enabled);
      setBlockedDates(settingsRes.blockedDates || []);
      setSlots(slotsRes.slots || []);
    } catch (err: any) {
      toast.error(err.message || "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleToggle = async (newEnabled: boolean) => {
    setSavingToggle(true);
    try {
      await adminFetch("/api/admin/delivery/settings", {
        method: "PUT",
        body: JSON.stringify({ enabled: newEnabled }),
      });
      setEnabled(newEnabled);
      toast.success(newEnabled ? "Scheduling diaktifkan" : "Scheduling dinonaktifkan");
      // Refresh slots (if enabled, slots will be generated)
      fetchAll();
    } catch (err: any) {
      toast.error(err.message || "Gagal toggle");
    } finally {
      setSavingToggle(false);
    }
  };

  const handleAddBlockedDate = async () => {
    if (!newBlockedDate) return;
    const updated = [...blockedDates, newBlockedDate].sort();
    try {
      await adminFetch("/api/admin/delivery/settings", {
        method: "PUT",
        body: JSON.stringify({ blockedDates: updated }),
      });
      setBlockedDates(updated);
      setNewBlockedDate("");
      toast.success("Tanggal diblokir");
      fetchAll();
    } catch (err: any) {
      toast.error(err.message || "Gagal blokir tanggal");
    }
  };

  const handleRemoveBlockedDate = async (date: string) => {
    const updated = blockedDates.filter((d) => d !== date);
    try {
      await adminFetch("/api/admin/delivery/settings", {
        method: "PUT",
        body: JSON.stringify({ blockedDates: updated }),
      });
      setBlockedDates(updated);
      toast.success("Tanggal dibuka kembali");
      fetchAll();
    } catch (err: any) {
      toast.error(err.message || "Gagal hapus");
    }
  };

  const handleSlotToggle = async (slotId: string, closed: boolean) => {
    try {
      await adminFetch(`/api/admin/delivery/slots/${slotId}`, {
        method: "PUT",
        body: JSON.stringify({ closed }),
      });
      setSlots((prev) =>
        prev.map((s) => (s.id === slotId ? { ...s, closed, available: !closed && s.available } : s))
      );
      toast.success(closed ? "Slot ditutup" : "Slot dibuka");
    } catch (err: any) {
      toast.error(err.message || "Gagal update slot");
    }
  };

  const handleMaxOrdersChange = async (slotId: string, maxOrders: number) => {
    try {
      await adminFetch(`/api/admin/delivery/slots/${slotId}`, {
        method: "PUT",
        body: JSON.stringify({ maxOrders }),
      });
      setSlots((prev) =>
        prev.map((s) => (s.id === slotId ? { ...s, maxOrders } : s))
      );
    } catch (err: any) {
      toast.error(err.message || "Gagal update max orders");
    }
  };

  // Group slots by dateLabel
  const grouped = slots.reduce((acc, slot) => {
    if (!acc[slot.dateLabel]) acc[slot.dateLabel] = [];
    acc[slot.dateLabel].push(slot);
    return acc;
  }, {} as Record<string, SlotInfo[]>);

  return (
    <div>
      <AdminSectionHeading
        title="Delivery Scheduling"
        description="Atur slot pengiriman (Pagi/Siang/Sore). Customer pilih slot saat checkout."
      />

      {/* Master toggle + blocked dates */}
      <AdminCard>
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-600 dark:text-cyan-400">
                <Truck className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  Scheduling
                  {enabled ? (
                    <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-xs">Aktif</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">Nonaktif</Badge>
                  )}
                </h3>
                <p className="text-[11px] text-muted-foreground">Saat aktif, checkout menampilkan slot picker</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Enable</Label>
              <Switch
                checked={enabled}
                onCheckedChange={handleToggle}
                disabled={savingToggle || loading}
                aria-label="Aktifkan scheduling"
              />
            </div>
          </div>

          {/* Blocked dates */}
          <div className="border-t border-border/60 pt-3">
            <Label className="text-xs font-medium flex items-center gap-1.5 mb-2">
              <AlertCircle className="h-3.5 w-3.5" />
              Tanggal Diblokir (libur/Minggu)
            </Label>
            <div className="flex gap-2 mb-2">
              <Input
                type="date"
                value={newBlockedDate}
                onChange={(e) => setNewBlockedDate(e.target.value)}
                disabled={!enabled}
                className="h-9 text-xs"
              />
              <Button
                onClick={handleAddBlockedDate}
                disabled={!enabled || !newBlockedDate}
                size="sm"
                variant="outline"
                className="h-9 shrink-0"
              >
                Blokir
              </Button>
            </div>
            {blockedDates.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {blockedDates.map((date) => (
                  <Badge
                    key={date}
                    variant="secondary"
                    className="text-xs gap-1 pr-1"
                  >
                    {new Date(date + "T00:00:00").toLocaleDateString("id-ID", {
                      day: "numeric", month: "short", year: "numeric",
                    })}
                    <button
                      onClick={() => handleRemoveBlockedDate(date)}
                      className="ml-0.5 hover:text-destructive"
                      aria-label="Hapus"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Belum ada tanggal diblokir</p>
            )}
          </div>
        </div>
      </AdminCard>

      {/* Custom slot templates */}
      <SlotTemplateEditor />

      {/* Slots list */}
      <AdminCard>
        <div className="p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-primary" />
            Slot Pengiriman (7 Hari Ke Depan)
          </h3>

          {loading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Memuat slot...
            </div>
          ) : !enabled ? (
            <AdminEmptyState
              icon={<Power className="h-6 w-6" />}
              title="Scheduling nonaktif"
              description="Aktifkan toggle di atas untuk generate slot pengiriman."
            />
          ) : slots.length === 0 ? (
            <AdminEmptyState
              icon={<Calendar className="h-6 w-6" />}
              title="Tidak ada slot"
              description="Semua tanggal 7 hari ke depan diblokir atau sudah lewat cutoff same-day."
            />
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto scrollbar-grocery pr-1">
              <AnimatePresence>
                {Object.entries(grouped).map(([dateLabel, dateSlots]) => (
                  <motion.div
                    key={dateLabel}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-1.5"
                  >
                    <p className="text-[11px] font-bold text-foreground sticky top-0 bg-card py-0.5">
                      {dateLabel}
                    </p>
                    {dateSlots.map((slot) => (
                      <div
                        key={slot.id}
                        className={cn(
                          "flex items-center gap-2 rounded-lg border p-2 text-xs",
                          slot.closed ? "border-rose-500/30 bg-rose-500/5" : "border-border bg-card"
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold">{slot.label} · {slot.timeLabel}</p>
                          <p className="text-xs text-muted-foreground">
                            {slot.currentOrders} / {slot.maxOrders || "∞"} terpesan
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Input
                            type="number"
                            value={slot.maxOrders}
                            onChange={(e) => {
                              // Debounce — only update on blur or enter
                            }}
                            onBlur={(e) => {
                              const v = parseInt(e.target.value, 10);
                              if (!isNaN(v) && v !== slot.maxOrders) {
                                handleMaxOrdersChange(slot.id, v);
                              }
                            }}
                            className="h-7 w-14 text-xs text-center"
                            min={0}
                            title="Max orders"
                          />
                          <Switch
                            checked={!slot.closed}
                            onCheckedChange={(v) => handleSlotToggle(slot.id, !v)}
                            aria-label="Buka/tutup slot"
                          />
                          {slot.closed ? (
                            <X className="h-3.5 w-3.5 text-rose-500" />
                          ) : (
                            <Check className="h-3.5 w-3.5 text-emerald-500" />
                          )}
                        </div>
                      </div>
                    ))}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </AdminCard>

      <div className="rounded-lg bg-secondary/50 p-3 text-xs text-muted-foreground space-y-1">
        <p><strong className="text-foreground">Slot default:</strong> Pagi (09-12), Siang (12-15), Sore (15-18)</p>
        <p><strong className="text-foreground">Same-day cutoff:</strong> Pesanan sebelum jam 13:00 bisa pilih slot hari ini</p>
        <p><strong className="text-foreground">Generate otomatis:</strong> Slot dibuat untuk 7 hari ke depan saat customer buka checkout</p>
        <p><strong className="text-foreground">Kapasitas penuh:</strong> Slot otomatis tidak bisa dipilih customer saat currentOrders ≥ maxOrders</p>
      </div>

      {/* Zone management */}
      <DeliveryZoneEditor />

      {/* Google Maps settings for Gojek */}
      <MapsSettingsEditor />

      {/* Biteship settings (multi-courier) */}
      <BiteshipSettingsEditor />
    </div>
  );
}
