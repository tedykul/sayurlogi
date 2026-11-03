"use client";

import { Check, Loader2, Package } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export type CheckoutStep = "form" | "loading" | "success";

interface CheckoutStepsProps {
  current: CheckoutStep;
}

const STEPS: { id: CheckoutStep; label: string }[] = [
  { id: "form", label: "Data Pengiriman" },
  { id: "loading", label: "Memproses" },
  { id: "success", label: "Selesai" },
];

/**
 * Visual step indicator for checkout flow (3 steps).
 * Shows current step highlighted, completed steps with checkmark,
 * future steps dimmed. Animated connector line between steps.
 *
 * Pure presentational component driven by `current` prop.
 */
export function CheckoutSteps({ current }: CheckoutStepsProps) {
  const currentIndex = STEPS.findIndex((s) => s.id === current);

  return (
    <ol
      className="flex items-center justify-between gap-1 mb-5"
      aria-label="Progress checkout"
    >
      {STEPS.map((step, i) => {
        // In success state, all steps are completed (show checkmarks)
        const isCompleted = current === "success" ? true : i < currentIndex;
        const isCurrent = current !== "success" && i === currentIndex;
        const isFuture = i > currentIndex;
        return (
          <li key={step.id} className="flex flex-1 items-center last:flex-none">
            {/* Circle + label */}
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <motion.div
                initial={false}
                animate={{
                  scale: isCurrent ? 1.1 : 1,
                  backgroundColor: isCurrent
                    ? "rgb(var(--primary))"
                    : isCompleted
                    ? "rgb(var(--primary))"
                    : "rgb(var(--muted))",
                }}
                transition={{ duration: 0.2 }}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold shrink-0",
                  isCurrent && "text-primary-foreground ring-4 ring-primary/20",
                  isCompleted && "text-primary-foreground",
                  isFuture && "text-muted-foreground bg-muted"
                )}
                aria-current={isCurrent ? "step" : undefined}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4" />
                ) : isCurrent && current === "loading" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span>{i + 1}</span>
                )}
              </motion.div>
              <span
                className={cn(
                  "text-[10px] font-medium leading-tight text-center max-w-[80px]",
                  isCurrent ? "text-primary" : isFuture ? "text-muted-foreground" : "text-foreground"
                )}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line (not after last step) */}
            {i < STEPS.length - 1 && (
              <div className="flex-1 h-0.5 mx-2 rounded-full bg-muted overflow-hidden">
                <motion.div
                  initial={false}
                  animate={{
                    width:
                      current === "success" || i < currentIndex ? "100%" : "0%",
                  }}
                  transition={{ duration: 0.3 }}
                  className="h-full bg-primary"
                />
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
