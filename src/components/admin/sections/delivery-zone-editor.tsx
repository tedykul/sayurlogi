"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, MapPin, Plus, Trash2, Edit2, Check, X, Bike } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { motion, AnimatePresence } from "framer-motion";
import { adminFetch } from "@/lib/admin-client";
import { toast } from "sonner";
import { AdminCard } from "../admin-ui";
import { cn } from "@/lib/utils";

// ============================================================
// DeliveryZoneEditor — manage internal shipping zones.
// ============================================================

interface Zone {
  id: string;
  name: string;
  fee: number;
  freeShippingMin: number;
  order: number;
  active: boolean;
}

export function DeliveryZoneEditor() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newZone, setNewZone] = useState({ name: "", fee: 0, freeShippingMin: 0 });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Zone | null>(null);

  const fetchZones = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch<{ success: boolean; zones: Zone[] }>("/api/admin/delivery/zones");
      setZones(res.zones || []);
    } catch (err: any) {
      toast.error(err.message || "Gagal memuat zona");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchZones();
  }, [fetchZones]);

  const handleCreate = async () => {
    if (!newZone.name.trim()) {
      toast.error("Nama zona wajib diisi");
      return;
    }
    try {
      await adminFetch("/api/admin/delivery/zones", {
        method: "POST",
        body: JSON.stringify(newZone),
      });
      toast.success("Zona ditambahkan");
      setNewZone({ name: "", fee: 0, freeShippingMin: 0 });
      setCreating(false);
      fetchZones();
    } catch (err: any) {
      toast.error(err.message || "Gagal menambah zona");
    }
  };

  const handleUpdate = async (id: string, data: Partial<Zone>) => {
    try {
      await adminFetch(`/api/admin/delivery/zones/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
      setZones((prev) => prev.map((z) => (z.id === id ? { ...z, ...data } as Zone : z)));
      setEditingId(null);
      setEditForm(null);
      toast.success("Zona diupdate");
    } catch (err: any) {
      toast.error(err.message || "Gagal update");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Hapus zona "${name}"?`)) return;
    try {
      await adminFetch(`/api/admin/delivery/zones/${id}`, { method: "DELETE" });
      setZones((prev) => prev.filter((z) => z.id !== id));
      toast.success("Zona dihapus");
    } catch (err: any) {
      toast.error(err.message || "Gagal hapus");
    }
  };

  const formatIDR = (n: number) => "Rp " + n.toLocaleString("id-ID");

  return (
    <AdminCard>
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-600 dark:text-cyan-400">
              <MapPin className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2">
                Zona Pengiriman Internal
                {zones.length > 0 && (
                  <Badge variant="secondary" className="text-[10px]">{zones.length} zona</Badge>
                )}
              </h3>
              <p className="text-[11px] text-muted-foreground">Area antar dengan ongkir flat rate</p>
            </div>
          </div>
          {!creating && (
            <Button onClick={() => setCreating(true)} size="sm" variant="outline" className="h-8 text-xs">
              <Plus className="h-3.5 w-3.5 mr-1" /> Tambah Zona
            </Button>
          )}
        </div>

        {/* Create form */}
        {creating && (
          <div className="rounded-lg border border-border/60 bg-secondary/30 p-3 space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-3 sm:col-span-1">
                <Label className="text-[10px] text-muted-foreground">Nama Zona</Label>
                <Input
                  value={newZone.name}
                  onChange={(e) => setNewZone({ ...newZone, name: e.target.value })}
                  placeholder="BTP, Telkomas..."
                  className="h-8 text-xs"
                  autoFocus
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Ongkir (Rp)</Label>
                <Input
                  type="number"
                  value={newZone.fee}
                  onChange={(e) => setNewZone({ ...newZone, fee: Number(e.target.value) })}
                  className="h-8 text-xs"
                  placeholder="0"
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Min Gratis (Rp)</Label>
                <Input
                  type="number"
                  value={newZone.freeShippingMin}
                  onChange={(e) => setNewZone({ ...newZone, freeShippingMin: Number(e.target.value) })}
                  className="h-8 text-xs"
                  placeholder="0"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreate} size="sm" className="h-7 text-xs">Simpan</Button>
              <Button onClick={() => setCreating(false)} size="sm" variant="outline" className="h-7 text-xs">Batal</Button>
            </div>
          </div>
        )}

        {/* Zone list */}
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Memuat zona...
          </div>
        ) : zones.length === 0 ? (
          <div className="text-center py-6">
            <MapPin className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">Belum ada zona pengiriman</p>
            <p className="text-[10px] text-muted-foreground/70 mt-1">Tambah zona untuk mengaktifkan ongkir berbasis area</p>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {zones.map((zone) => (
                <motion.div
                  key={zone.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border p-2.5 text-xs",
                    zone.active ? "border-border/60 bg-card" : "border-border/30 bg-muted/30 opacity-60"
                  )}
                >
                  {editingId === zone.id && editForm ? (
                    <div className="flex-1 grid grid-cols-3 gap-2">
                      <Input
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="h-7 text-xs"
                      />
                      <Input
                        type="number"
                        value={editForm.fee}
                        onChange={(e) => setEditForm({ ...editForm, fee: Number(e.target.value) })}
                        className="h-7 text-xs"
                      />
                      <div className="flex gap-1">
                        <Input
                          type="number"
                          value={editForm.freeShippingMin}
                          onChange={(e) => setEditForm({ ...editForm, freeShippingMin: Number(e.target.value) })}
                          className="h-7 text-xs"
                        />
                        <Button onClick={() => handleUpdate(zone.id, editForm)} size="icon" className="h-7 w-7 shrink-0">
                          <Check className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{zone.name}</span>
                          {!zone.active && <Badge variant="secondary" className="text-[9px]">Nonaktif</Badge>}
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          Ongkir: {zone.fee === 0 ? "Gratis" : formatIDR(zone.fee)}
                          {zone.freeShippingMin > 0 ? ` · Gratis ≥ ${formatIDR(zone.freeShippingMin)}` : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Switch
                          checked={zone.active}
                          onCheckedChange={(v) => handleUpdate(zone.id, { active: v })}
                          aria-label="Aktif/nonaktif"
                        />
                        <Button
                          onClick={() => { setEditingId(zone.id); setEditForm(zone); }}
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button
                          onClick={() => handleDelete(zone.id, zone.name)}
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Info */}
        <div className="rounded-lg bg-secondary/50 p-2.5 text-[10px] text-muted-foreground space-y-1">
          <p><strong className="text-foreground">Zona Internal:</strong> Area yang dilayani kurir sendiri (flat rate per zona)</p>
          <p><strong className="text-foreground">Gojek:</strong> Customer pilih opsi Gojek di checkout → bayar ongkir ke kurir langsung</p>
          <p><strong className="text-foreground">Gratis ongkir:</strong> Set min belanja (freeShippingMin) → kalau subtotal ≥ min, ongkir = 0</p>
        </div>
      </div>
    </AdminCard>
  );
}
