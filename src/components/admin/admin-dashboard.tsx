"use client";

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useAdminStore } from "@/lib/store/admin";
import { adminFetch } from "@/lib/api";
import { CouponList } from "./coupon-list";
import { GenerateCouponDialog } from "./generate-coupon-dialog";
import { CouponStats } from "./coupon-stats";
import { IntegrationEditor } from "./integration-editor";
import { Ticket, Plus, LogOut, RefreshCw, Loader2, Plug } from "lucide-react";
import { toast } from "sonner";
import type { Coupon } from "@/types";

interface AdminDashboardProps {
  onClose: () => void;
}

export function AdminDashboard({ onClose }: AdminDashboardProps) {
  const logout = useAdminStore((s) => s.logout);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [generateOpen, setGenerateOpen] = useState(false);

  const fetchCoupons = async () => {
    setLoading(true);
    try {
      const data = await adminFetch<{ success: boolean; coupons: Coupon[] }>(
        "/api/admin/coupons"
      );
      setCoupons(data.coupons);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memuat kupon");
      if (err instanceof Error && err.message.includes("Unauthorized")) {
        logout();
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoupons();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus kupon ini? Tindakan tidak bisa dibatalkan.")) return;
    try {
      await adminFetch(`/api/admin/coupons/${id}`, { method: "DELETE" });
      setCoupons((prev) => prev.filter((c) => c.id !== id));
      toast.success("Kupon dihapus");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal hapus");
    }
  };

  const handleToggleActive = async (coupon: Coupon) => {
    try {
      const data = await adminFetch<{ coupon: Coupon }>(
        `/api/admin/coupons/${coupon.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ active: !coupon.active }),
        }
      );
      setCoupons((prev) =>
        prev.map((c) => (c.id === coupon.id ? data.coupon : c))
      );
      toast.success(`Kupon ${data.coupon.active ? "diaktifkan" : "dinonaktifkan"}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal update");
    }
  };

  const handleShare = async (coupon: Coupon) => {
    try {
      const data = await adminFetch<{
        shareUrl: string;
        whatsappUrl: string;
      }>(`/api/admin/coupons/${coupon.id}/share`, {
        method: "POST",
        body: JSON.stringify({ baseUrl: window.location.origin }),
      });
      // Copy to clipboard
      await navigator.clipboard.writeText(data.shareUrl);
      toast.success("Link disalin!", {
        description: "Membuka WhatsApp untuk share...",
        duration: 2000,
      });
      // Open WhatsApp share
      window.open(data.whatsappUrl, "_blank");
      // Refresh coupons to update shareCount
      fetchCoupons();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal share");
    }
  };

  const handlePdf = async (coupon: Coupon) => {
    try {
      const res = await fetch(`/api/admin/coupons/${coupon.id}/pdf`, {
        method: "POST",
        headers: {
          "x-admin-token": useAdminStore.getState().token || "",
        },
      });
      if (!res.ok) throw new Error("Gagal generate PDF");
      const html = await res.text();
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      toast.success("PDF dibuka di tab baru");
      fetchCoupons();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal export PDF");
    }
  };

  const handleBatchPdf = async (ids: string[]) => {
    if (ids.length === 0) {
      toast.error("Pilih kupon dulu");
      return;
    }
    try {
      const res = await fetch("/api/admin/coupons/export-pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": useAdminStore.getState().token || "",
        },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error("Gagal generate PDF");
      const html = await res.text();
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      toast.success(`PDF ${ids.length} kupon dibuka`);
      fetchCoupons();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal export PDF");
    }
  };

  return (
    <>
      <Sheet open onOpenChange={(o) => !o && onClose()}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0">
          <SheetHeader className="px-4 py-3 border-b sticky top-0 bg-background z-10">
            <div className="flex items-center justify-between">
              <div>
                <SheetTitle className="flex items-center gap-2">
                  <Ticket className="h-4 w-4" /> Admin Dashboard
                </SheetTitle>
                <SheetDescription className="text-xs">
                  Kelola kupon, share via WA, export PDF
                </SheetDescription>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={fetchCoupons}
                  title="Refresh"
                >
                  {loading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    logout();
                    onClose();
                  }}
                  title="Logout"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </SheetHeader>

          <Tabs defaultValue="coupons" className="px-4 py-3">
            <div className="flex items-center justify-between mb-3">
              <TabsList>
                <TabsTrigger value="coupons">🎫 Kupon</TabsTrigger>
                <TabsTrigger value="stats">📊 Statistik</TabsTrigger>
                <TabsTrigger value="integration" className="gap-1">
                  <Plug className="h-3 w-3" /> ERPNext
                </TabsTrigger>
              </TabsList>
              <Button size="sm" onClick={() => setGenerateOpen(true)} className="h-8">
                <Plus className="h-3.5 w-3.5 mr-1" /> Generate
              </Button>
            </div>

            <TabsContent value="coupons" className="mt-0">
              <CouponList
                coupons={coupons}
                loading={loading}
                onDelete={handleDelete}
                onToggleActive={handleToggleActive}
                onShare={handleShare}
                onPdf={handlePdf}
                onBatchPdf={handleBatchPdf}
              />
            </TabsContent>

            <TabsContent value="stats" className="mt-0">
              <CouponStats coupons={coupons} />
            </TabsContent>

            <TabsContent value="integration" className="mt-0">
              <IntegrationEditor />
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      <GenerateCouponDialog
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        onCreated={fetchCoupons}
      />
    </>
  );
}
