"use client";

import { Clock } from "lucide-react";
import { estimateDelivery, type DeliveryEstimate } from "@/lib/delivery";
import { cn } from "@/lib/utils";

interface DeliveryEstimateDisplayProps {
  method: "delivery" | "pickup";
  /** Variant: "compact" (inline) or "card" (boxed). Default "compact". */
  variant?: "compact" | "card";
  className?: string;
}

/**
 * Display the estimated delivery/pickup time for the current order.
 * Recomputes on every render (cheap pure function) — no state needed.
 */
export function DeliveryEstimateDisplay({
  method,
  variant = "compact",
  className,
}: DeliveryEstimateDisplayProps) {
  const estimate = estimateDelivery(method);

  if (variant === "card") {
    return (
      <div
        className={cn(
          "flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3",
          className
        )}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <estimate.icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="text-xs font-semibold text-primary">
              Estimasi {estimate.methodLabel}
            </span>
            {estimate.sameDay && (
              <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 dark:text-emerald-400">
                SAME DAY
              </span>
            )}
          </div>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {estimate.dateLabel}
          </p>
          <p className="text-xs text-muted-foreground">{estimate.timeWindow}</p>
        </div>
      </div>
    );
  }

  // Compact: inline pill
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary",
        className
      )}
      title={`Estimasi ${estimate.methodLabel}: ${estimate.dateLabel} ${estimate.timeWindow}`}
    >
      <Clock className="h-3 w-3 shrink-0" />
      <span className="font-medium">
        {estimate.dateLabel}, {estimate.timeWindow}
      </span>
      {estimate.sameDay && (
        <span className="rounded-full bg-emerald-500/30 px-1.5 py-0.5 text-[9px] font-bold">
          SAME DAY
        </span>
      )}
    </div>
  );
}
