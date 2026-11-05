"use client";

import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Ticket, MousePointerClick, Share2, Printer, Target } from "lucide-react";
import type { Coupon } from "@/types";

interface CouponStatsProps {
  coupons: Coupon[];
}

export function CouponStats({ coupons }: CouponStatsProps) {
  const total = coupons.length;
  const active = coupons.filter((c) => c.active).length;
  const totalClicks = coupons.reduce((s, c) => s + c.clickCount, 0);
  const totalShares = coupons.reduce((s, c) => s + c.shareCount, 0);
  const totalUsed = coupons.reduce((s, c) => s + c.usedCount, 0);
  const totalPrinted = coupons.reduce((s, c) => s + c.printedCount, 0);
  const conversionRate = totalClicks > 0 ? (totalUsed / totalClicks) * 100 : 0;

  // Top performing coupons by usage
  const topCoupons = [...coupons]
    .sort((a, b) => b.usedCount - a.usedCount)
    .slice(0, 5);

  const cards = [
    {
      label: "Total Kupon",
      value: total,
      sub: `${active} aktif`,
      icon: Ticket,
      color: "text-green-600 bg-green-50",
    },
    {
      label: "Total Klik Link",
      value: totalClicks,
      sub: "marketing reach",
      icon: MousePointerClick,
      color: "text-blue-600 bg-blue-50",
    },
    {
      label: "Total Share",
      value: totalShares,
      sub: "via WA/copy",
      icon: Share2,
      color: "text-purple-600 bg-purple-50",
    },
    {
      label: "Total Redeem",
      value: totalUsed,
      sub: `konversi ${conversionRate.toFixed(1)}%`,
      icon: Target,
      color: "text-amber-600 bg-amber-50",
    },
    {
      label: "Total Cetak PDF",
      value: totalPrinted,
      sub: "distribusi offline",
      icon: Printer,
      color: "text-rose-600 bg-rose-50",
    },
  ];

  const maxUsage = Math.max(...topCoupons.map((c) => c.usedCount), 1);

  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label} className="p-3">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    {card.label}
                  </p>
                  <p className="text-xl font-bold mt-0.5">{card.value.toLocaleString("id-ID")}</p>
                  <p className="text-[10px] text-muted-foreground">{card.sub}</p>
                </div>
                <div className={`p-1.5 rounded-md ${card.color}`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Top performing coupons */}
      <Card className="p-3">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
          <Target className="h-3.5 w-3.5" /> Top 5 Kupon (by Redeem)
        </h3>
        {topCoupons.length === 0 || topCoupons.every((c) => c.usedCount === 0) ? (
          <p className="text-xs text-muted-foreground py-4 text-center">
            Belum ada redeem. Share kupon via WA untuk mulai tracking.
          </p>
        ) : (
          <div className="space-y-2">
            {topCoupons.map((c) => (
              <div key={c.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-green-700">{c.code}</span>
                    <span className="text-muted-foreground">
                      {c.type === "percent"
                        ? `${c.value}%`
                        : c.type === "fixed"
                          ? `Rp${c.value.toLocaleString("id-ID")}`
                          : "Gratis Ongkir"}
                    </span>
                  </div>
                  <span className="text-muted-foreground">
                    {c.usedCount} redeem · {c.clickCount} klik · {c.shareCount} share
                  </span>
                </div>
                <Progress value={(c.usedCount / maxUsage) * 100} className="h-1.5" />
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Funnel */}
      <Card className="p-3">
        <h3 className="text-sm font-semibold mb-3">Funnel Konversi</h3>
        <div className="space-y-2">
          <FunnelBar
            label="Link Dibagikan (share)"
            value={totalShares}
            max={Math.max(totalShares, 1)}
            color="bg-purple-500"
          />
          <FunnelBar
            label="Link Diklik (click)"
            value={totalClicks}
            max={Math.max(totalClicks, 1)}
            color="bg-blue-500"
          />
          <FunnelBar
            label="Kupon Dipakai (redeem)"
            value={totalUsed}
            max={Math.max(totalClicks, 1)}
            color="bg-green-500"
          />
        </div>
        {totalShares > 0 && (
          <p className="text-[10px] text-muted-foreground mt-2">
            Konversi share→click: {((totalClicks / totalShares) * 100).toFixed(1)}% ·
            click→redeem: {totalClicks > 0 ? ((totalUsed / totalClicks) * 100).toFixed(1) : "0"}%
          </p>
        )}
      </Card>
    </div>
  );
}

function FunnelBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = (value / max) * 100;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span>{label}</span>
        <span className="font-semibold">{value}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full ${color} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
