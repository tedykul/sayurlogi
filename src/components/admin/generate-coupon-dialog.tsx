"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { adminFetch } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import type { Coupon, CouponType } from "@/types";

interface GenerateCouponDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

interface GenerateResponse {
  success: boolean;
  batchId: string;
  coupons: Coupon[];
}

export function GenerateCouponDialog({
  open,
  onOpenChange,
  onCreated,
}: GenerateCouponDialogProps) {
  const [form, setForm] = useState({
    count: "5",
    prefix: "",
    type: "percent" as CouponType,
    value: "10",
    minOrder: "0",
    maxUsage: "100",
    maxPerUser: "1",
    expiresAt: "",
    description: "",
  });
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<Coupon[] | null>(null);

  const handleGenerate = async () => {
    const count = parseInt(form.count, 10);
    if (isNaN(count) || count < 1 || count > 200) {
      toast.error("Jumlah harus 1-200");
      return;
    }

    const value = parseInt(form.value, 10);
    if (form.type === "percent" && (isNaN(value) || value < 1 || value > 100)) {
      toast.error("Persen harus 1-100");
      return;
    }

    setLoading(true);
    try {
      const body = {
        count,
        prefix: form.prefix.trim(),
        type: form.type,
        value: form.type === "free_shipping" ? 0 : value,
        minOrder: parseInt(form.minOrder, 10) || 0,
        maxUsage: parseInt(form.maxUsage, 10) || 0,
        maxPerUser: parseInt(form.maxPerUser, 10) || 0,
        expiresAt: form.expiresAt || null,
        description: form.description.trim() || null,
      };
      const data = await adminFetch<GenerateResponse>(
        "/api/admin/coupons/generate",
        {
          method: "POST",
          body: JSON.stringify(body),
        }
      );
      setCreated(data.coupons);
      toast.success(`${data.coupons.length} kupon dibuat!`);
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal generate");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    if (created) {
      setCreated(null);
      setForm({
        count: "5",
        prefix: "",
        type: "percent",
        value: "10",
        minOrder: "0",
        maxUsage: "100",
        maxPerUser: "1",
        expiresAt: "",
        description: "",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-green-700">
                <Sparkles className="h-5 w-5" /> {created.length} Kupon Dibuat!
              </DialogTitle>
              <DialogDescription>
                Batch ID: <code className="font-mono text-xs">{created[0]?.batchId}</code>
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-60 overflow-y-auto rounded border p-2 space-y-1 bg-muted/30">
              {created.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between text-xs py-1 px-2 bg-background rounded"
                >
                  <span className="font-mono font-bold text-green-700">{c.code}</span>
                  <span className="text-muted-foreground">
                    {c.type === "percent"
                      ? `${c.value}%`
                      : c.type === "fixed"
                        ? `Rp${c.value.toLocaleString("id-ID")}`
                        : "Gratis Ongkir"}
                  </span>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Tutup
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-green-600" /> Generate Kupon Batch
              </DialogTitle>
              <DialogDescription>
                Buat beberapa kupon sekaligus dengan kode acak.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="count">Jumlah Kupon *</Label>
                  <Input
                    id="count"
                    type="number"
                    min={1}
                    max={200}
                    value={form.count}
                    onChange={(e) => setForm({ ...form, count: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="prefix">Prefix (opsional)</Label>
                  <Input
                    id="prefix"
                    value={form.prefix}
                    onChange={(e) => setForm({ ...form, prefix: e.target.value })}
                    placeholder="cth: PROMO"
                    maxLength={6}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Tipe Diskon</Label>
                <RadioGroup
                  value={form.type}
                  onValueChange={(v) => setForm({ ...form, type: v as CouponType })}
                  className="flex gap-4"
                >
                  <div className="flex items-center gap-1.5">
                    <RadioGroupItem value="percent" id="t-percent" />
                    <Label htmlFor="t-percent" className="text-sm font-normal cursor-pointer">
                      Persen (%)
                    </Label>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <RadioGroupItem value="fixed" id="t-fixed" />
                    <Label htmlFor="t-fixed" className="text-sm font-normal cursor-pointer">
                      Nominal (Rp)
                    </Label>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <RadioGroupItem value="free_shipping" id="t-fs" />
                    <Label htmlFor="t-fs" className="text-sm font-normal cursor-pointer">
                      Gratis Ongkir
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {form.type !== "free_shipping" && (
                <div className="space-y-1.5">
                  <Label htmlFor="value">
                    Nilai {form.type === "percent" ? "(%)" : "(Rp)"}
                  </Label>
                  <Input
                    id="value"
                    type="number"
                    min={1}
                    value={form.value}
                    onChange={(e) => setForm({ ...form, value: e.target.value })}
                  />
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="minOrder">Min. Belanja</Label>
                  <Input
                    id="minOrder"
                    type="number"
                    min={0}
                    value={form.minOrder}
                    onChange={(e) => setForm({ ...form, minOrder: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="maxUsage">Max Total</Label>
                  <Input
                    id="maxUsage"
                    type="number"
                    min={0}
                    value={form.maxUsage}
                    onChange={(e) => setForm({ ...form, maxUsage: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="maxPerUser">Max/User</Label>
                  <Input
                    id="maxPerUser"
                    type="number"
                    min={0}
                    value={form.maxPerUser}
                    onChange={(e) => setForm({ ...form, maxPerUser: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="expiresAt">Berlaku Hingga</Label>
                <Input
                  id="expiresAt"
                  type="date"
                  value={form.expiresAt}
                  onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description">Deskripsi (opsional)</Label>
                <Input
                  id="description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="cth: Promo akhir pekan"
                  maxLength={100}
                />
              </div>

              <p className="text-[10px] text-muted-foreground">
                💡 Kode akan digenerate otomatis dengan format: {form.prefix || "(tanpa prefix)"}
                + 6 karakter alfanumerik. Setelah dibuat, bisa langsung share via WA atau export PDF.
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose} disabled={loading}>
                Batal
              </Button>
              <Button onClick={handleGenerate} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Generate...
                  </>
                ) : (
                  "Generate"
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
