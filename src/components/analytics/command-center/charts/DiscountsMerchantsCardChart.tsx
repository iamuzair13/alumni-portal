"use client";

import React from "react";
import { motion } from "motion/react";
import { ChartEmpty } from "./ChartEmpty";

const CHIP_COLORS = [
  "bg-emerald-100 text-emerald-700",
  "bg-sky-100 text-sky-700",
  "bg-amber-100 text-amber-700",
  "bg-indigo-100 text-indigo-700",
  "bg-purple-100 text-purple-700",
  "bg-rose-100 text-rose-700",
];

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function DiscountsMerchantsCardChart({
  categories,
  total,
  merchantCount,
  merchants = [],
}: {
  categories: Array<{ key: string; label: string; value: number }>;
  total: number;
  merchantCount: number;
  merchants?: Array<{ merchant: string; discount?: string; reference?: string }>;
}) {
  const hasData = total > 0 || merchants.length > 0;

  if (!hasData) {
    return <ChartEmpty height={100} variant="premium" message="No discounts or merchants yet" />;
  }

  const visibleMerchants = merchants.filter((m) => m.merchant?.trim()).slice(0, 4);

  return (
    <div className="flex h-full w-full flex-col justify-center gap-2.5">
      {/* Applications progress bar */}
      {total > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              Applications
            </span>
            <span className="text-[11px] font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              {total} / {total}
            </span>
          </div>
          <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: "100%" }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500"
            />
          </div>
        </div>
      )}

      {/* Merchant chips */}
      {visibleMerchants.length > 0 && (
        <div className="grid grid-cols-2 gap-1.5">
          {visibleMerchants.map((m, i) => {
            const name = m.merchant.trim();
            const chipColor = CHIP_COLORS[i % CHIP_COLORS.length];
            return (
              <div
                key={name + i}
                className="flex items-center gap-1.5 overflow-hidden rounded-lg border border-slate-100 bg-slate-50 px-2 py-1 dark:border-slate-700 dark:bg-slate-800"
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[9px] font-bold ${chipColor}`}
                  aria-hidden="true"
                >
                  {initials(name)}
                </span>
                <span className="min-w-0 flex-1 truncate text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                  {name}
                </span>
                <span className="shrink-0 text-[10px] font-bold tabular-nums text-slate-500 dark:text-slate-400">
                  1
                </span>
              </div>
            );
          })}
          {merchantCount > visibleMerchants.length && (
            <div className="flex items-center justify-center rounded-lg border border-dashed border-slate-200 px-2 py-1 dark:border-slate-700">
              <span className="text-[10px] text-slate-400">
                +{merchantCount - visibleMerchants.length} more
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
