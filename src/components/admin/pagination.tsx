"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ============================================================
// Pagination — reusable numbered pagination control.
// ============================================================
// Props:
//   page        — current page (1-based)
//   totalPages  — total number of pages
//   total       — total items count
//   limit       — items per page
//   onPageChange — callback when page changes
//
// Shows: "Menampilkan X-Y dari Z" + numbered buttons
// Smart range: shows max 5 page buttons with ellipsis
// ============================================================

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
}

export function Pagination({
  page,
  totalPages,
  total,
  limit,
  onPageChange,
}: PaginationProps) {
  if (total === 0) return null;

  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  // Generate page numbers to display (max 5 visible)
  function getPageNumbers(): (number | "...")[] {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: (number | "...")[] = [];
    const showLeftEllipsis = page > 3;
    const showRightEllipsis = page < totalPages - 2;

    if (!showLeftEllipsis) {
      // Show 1, 2, 3, 4, ..., last
      for (let i = 1; i <= 4; i++) pages.push(i);
      pages.push("...");
      pages.push(totalPages);
    } else if (!showRightEllipsis) {
      // Show 1, ..., last-3, last-2, last-1, last
      pages.push(1);
      pages.push("...");
      for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
    } else {
      // Show 1, ..., current-1, current, current+1, ..., last
      pages.push(1);
      pages.push("...");
      pages.push(page - 1);
      pages.push(page);
      pages.push(page + 1);
      pages.push("...");
      pages.push(totalPages);
    }

    return pages;
  }

  const pageNumbers = getPageNumbers();

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 mt-3 pt-3 border-t border-border/60">
      <p className="text-xs text-muted-foreground">
        Menampilkan <span className="font-medium text-foreground">{start}</span>–
        <span className="font-medium text-foreground">{end}</span> dari{" "}
        <span className="font-medium text-foreground">{total}</span> item
      </p>

      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            aria-label="Halaman sebelumnya"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>

          {pageNumbers.map((p, i) =>
            p === "..." ? (
              <span
                key={`ellipsis-${i}`}
                className="px-1 text-xs text-muted-foreground"
              >
                …
              </span>
            ) : (
              <Button
                key={p}
                variant={p === page ? "default" : "outline"}
                size="sm"
                className={cn("h-7 min-w-7 px-2 text-xs", p === page && "font-bold")}
                onClick={() => onPageChange(p)}
              >
                {p}
              </Button>
            )
          )}

          <Button
            variant="outline"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            aria-label="Halaman berikutnya"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
