"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Phone, Mail, MapPin, Clock, Send, Loader2, CheckCircle2, AlertCircle, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatIDR } from "@/lib/mock-data";

type Status = "idle" | "loading" | "success";

interface ContactSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content?: {
    contactPhone: string | null;
    contactEmail: string | null;
    contactAddress: string | null;
    contactHours: string | null;
  };
}

export function ContactSheet({ open, onOpenChange, content }: ContactSheetProps) {
  const phone = content?.contactPhone ?? "0800-1234-5678";
  const email = content?.contactEmail ?? "halo@sayurlogi.id";
  const address = content?.contactAddress ?? "Jl. Petani Sejahtera No. 88, Jakarta Selatan";
  const hours = content?.contactHours ?? "Setiap hari, 08.00 - 21.00 WIB";

  const [status, setStatus] = useState<Status>("idle");
  const [form, setForm] = useState({ name: "", email: "", phone: "", subject: "", message: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const contactInfos = [
    { icon: Phone, label: "Telepon", value: phone, href: `tel:${phone.replace(/[^0-9+]/g, "")}`, accent: "bg-primary", iconBg: "bg-primary/10 text-primary ring-primary/10" },
    { icon: Mail, label: "Email", value: email, href: `mailto:${email}`, accent: "bg-cyan-500", iconBg: "bg-cyan-500/10 text-cyan-600 ring-cyan-500/10" },
    { icon: MapPin, label: "Alamat", value: address, accent: "bg-amber-500", iconBg: "bg-amber-500/10 text-amber-600 ring-amber-500/10" },
    { icon: Clock, label: "Jam Operasional", value: hours, accent: "bg-violet-500", iconBg: "bg-violet-500/10 text-violet-600 ring-violet-500/10" },
  ];

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!form.name || form.name.trim().length < 2) next.name = "Nama minimal 2 karakter";
    if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = "Email tidak valid";
    if (!form.subject || form.subject.trim().length < 3) next.subject = "Subjek minimal 3 karakter";
    if (!form.message || form.message.trim().length < 10) next.message = "Pesan minimal 10 karakter";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) { toast.error("Periksa kembali isian form"); return; }
    setStatus("loading");
    try {
      const res = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json();
      if (data.success) {
        setStatus("success");
        toast.success("Pesan terkirim! 🎉");
        setForm({ name: "", email: "", phone: "", subject: "", message: "" });
      } else {
        setStatus("idle");
        toast.error(data.message || "Gagal mengirim pesan");
      }
    } catch {
      setStatus("idle");
      toast.error("Koneksi gagal. Coba lagi.");
    }
  };

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm({ ...form, [field]: value });
    if (errors[field]) setErrors({ ...errors, [field]: "" });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md overflow-y-auto" side="right">
        <SheetHeader className="relative overflow-hidden bg-gradient-to-br from-primary/8 via-primary/5 to-card px-5 py-4">
          <div className="absolute inset-x-0 top-0 h-1 bg-primary" />
          <SheetTitle className="flex items-center gap-2.5 pt-1">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-inset ring-primary/20">
              <Phone className="h-5 w-5" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-base font-bold">Hubungi Kami</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Tim CS siap bantu</span>
            </div>
          </SheetTitle>
          <SheetDescription className="sr-only">Hubungi customer service SayurLogi</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto scrollbar-grocery px-5 py-4 space-y-4">
          {/* Contact info cards */}
          <div className="space-y-2.5">
            {contactInfos.map((info) => {
              const Icon = info.icon;
              const isInteractive = !!info.href;
              return (
                <a
                  key={info.label}
                  href={info.href || undefined}
                  className={cn(
                    "group relative flex items-center gap-3 overflow-hidden rounded-xl bg-gradient-to-br from-card via-card to-muted/50 p-3 ring-1 ring-border shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all",
                    isInteractive && "hover:ring-primary/30 active:scale-[0.99] cursor-pointer"
                  )}
                >
                  <div className={cn("absolute inset-y-0 left-0 w-1", info.accent)} />
                  <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ml-1", info.iconBg)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{info.label}</p>
                    <p className={cn("text-sm font-semibold break-words", isInteractive ? "text-foreground group-hover:text-primary" : "text-foreground")}>
                      {info.value}
                    </p>
                  </div>
                  {isInteractive && <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-50 group-hover:opacity-100 group-hover:text-primary" />}
                </a>
              );
            })}
          </div>

          {/* Form or success state */}
          {status === "success" ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 ring-4 ring-primary/10">
                <CheckCircle2 className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-base font-bold">Pesan Terkirim! 🎉</h3>
              <p className="text-xs text-muted-foreground max-w-xs">
                Tim CS akan membalas dalam 1×24 jam via email.
              </p>
              <Button variant="outline" size="sm" className="mt-1 rounded-full" onClick={() => setStatus("idle")}>
                Kirim Pesan Lain
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3" noValidate>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Kirim Pesan</p>
              <FormField label="Nama Lengkap" required error={errors.name}>
                <Input value={form.name} onChange={(e) => handleChange("name", e.target.value)} placeholder="Budi Santoso" required className="h-10" disabled={status === "loading"} />
              </FormField>
              <div className="grid grid-cols-2 gap-2.5">
                <FormField label="No. Telepon" error={errors.phone}>
                  <Input type="tel" value={form.phone} onChange={(e) => handleChange("phone", e.target.value)} placeholder="0812xxx" className="h-10" disabled={status === "loading"} />
                </FormField>
                <FormField label="Email" required error={errors.email}>
                  <Input type="email" value={form.email} onChange={(e) => handleChange("email", e.target.value)} placeholder="budi@email.com" required className="h-10" disabled={status === "loading"} />
                </FormField>
              </div>
              <FormField label="Subjek" required error={errors.subject}>
                <Input value={form.subject} onChange={(e) => handleChange("subject", e.target.value)} placeholder="Pertanyaan tentang pesanan" required className="h-10" disabled={status === "loading"} />
              </FormField>
              <FormField label="Pesan" required error={errors.message}>
                <Textarea value={form.message} onChange={(e) => handleChange("message", e.target.value)} placeholder="Tulis pesan..." rows={3} required className="resize-none" disabled={status === "loading"} maxLength={2000} />
                <div className="mt-1 text-right text-[10px] text-muted-foreground">{form.message.length}/2000</div>
              </FormField>
              <Button type="submit" disabled={status === "loading"} className="w-full h-11 rounded-xl text-sm font-bold shadow-md">
                {status === "loading" ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Mengirim...</>) : (<><Send className="mr-2 h-4 w-4" />Kirim Pesan</>)}
              </Button>
            </form>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function FormField({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium text-muted-foreground">{label} {required && <span className="text-destructive">*</span>}</Label>
      {children}
      {error && <p className="flex items-center gap-1 text-xs text-destructive"><AlertCircle className="h-3 w-3" />{error}</p>}
    </div>
  );
}
