"use client";

import { ShieldCheck, Lock, Truck, RefreshCw, Leaf, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Reusable trust badge strip for checkout & product pages.
 * Conveys: secure payment, garansi segar, easy refund, fast delivery.
 * Pure presentational component — no props required.
 */
interface TrustBadgesProps {
  /** Layout variant. "compact" = single row small icons; "grid" = 2x2 grid. */
  variant?: "compact" | "grid";
  className?: string;
}

const BADGES = [
  {
    icon: Lock,
    title: "Pembayaran Aman",
    desc: "SSL 256-bit encrypted",
  },
  {
    icon: ShieldCheck,
    title: "Garansi Segar",
    desc: "Uang kembali 100%",
  },
  {
    icon: RefreshCw,
    title: "Refund Mudah",
    desc: "24 jam setelah terima",
  },
  {
    icon: Truck,
    title: "Antar Cepat",
    desc: "2 jam sampai rumah",
  },
];

const PAYMENT_METHODS = [
  { emoji: "💵", label: "COD" },
  { emoji: "🏦", label: "BCA" },
  { emoji: "🏦", label: "Mandiri" },
  { emoji: "📱", label: "GoPay" },
  { emoji: "📱", label: "OVO" },
  { emoji: "📱", label: "DANA" },
];

export function TrustBadges({ variant = "compact", className }: TrustBadgesProps) {
  if (variant === "grid") {
    return (
      <div className={cn("grid grid-cols-2 gap-2", className)}>
        {BADGES.map((b) => (
          <div
            key={b.title}
            className="flex items-start gap-2 rounded-lg border border-border/60 bg-secondary/30 p-2.5"
          >
            <b.icon className="h-4 w-4 shrink-0 text-primary mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs font-semibold leading-tight">{b.title}</p>
              <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{b.desc}</p>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("space-y-2.5", className)}>
      {/* Trust badges row */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {BADGES.map((b) => (
          <div
            key={b.title}
            className="flex flex-col items-center gap-1 rounded-lg border border-border/40 bg-secondary/20 p-2 text-center"
          >
            <b.icon className="h-4 w-4 text-primary" />
            <span className="text-[10px] font-semibold leading-tight">{b.title}</span>
          </div>
        ))}
      </div>

      {/* Payment methods — single row, no wrap, always aligned */}
      <div className="flex items-center justify-center gap-1.5 pt-1">
        <span className="text-[10px] text-muted-foreground whitespace-nowrap mr-0.5">Metode pembayaran:</span>
        {PAYMENT_METHODS.map((m) => (
          <span
            key={m.label}
            className="inline-flex items-center gap-0.5 rounded-md border border-border/40 bg-background px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap"
            title={m.label}
          >
            <span aria-hidden="true">{m.emoji}</span>
            <span>{m.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
