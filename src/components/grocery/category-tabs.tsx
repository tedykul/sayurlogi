"use client";

import { motion } from "framer-motion";
import type { Category } from "@/types/grocery";
import { cn } from "@/lib/utils";

interface CategoryTabsProps {
  categories: Category[];
  active: string | null;
  onChange: (id: string | null) => void;
}

export function CategoryTabs({ categories, active, onChange }: CategoryTabsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1 -mx-1 px-1">
      <CategoryPill
        active={active === null}
        onClick={() => onChange(null)}
        emoji="🛒"
        label="Semua"
      />
      {categories.map((c) => (
        <CategoryPill
          key={c.id}
          active={active === c.id}
          onClick={() => onChange(c.id)}
          emoji={c.emoji}
          label={c.name}
        />
      ))}
    </div>
  );
}

function CategoryPill({
  active,
  onClick,
  emoji,
  label,
}: {
  active: boolean;
  onClick: () => void;
  emoji: string;
  label: string;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2.5 text-[13px] font-medium transition-all whitespace-nowrap min-h-[44px]",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "bg-secondary/60 text-foreground ring-1 ring-border/50 hover:bg-accent hover:ring-border"
      )}
    >
      <span className="text-sm">{emoji}</span>
      {label}
    </motion.button>
  );
}
