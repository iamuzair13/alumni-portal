"use client";

import React from "react";
import { ChartEmpty } from "./ChartEmpty";

const AVATAR_COLORS = [
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

type MerchantRow = {
  id: number;
  business_name: string;
  discount_type: string;
  start_date: string;
  end_date: string;
  discount_pct: number;
  status: "active" | "expired";
};

export function DiscountsMerchantsCardChart({
  categories,
  total,
  merchantCount,
  merchants = [],
}: {
  categories: Array<{ key: string; label: string; value: number }>;
  total: number;
  merchantCount: number;
  merchants?: MerchantRow[];
}) {
  if (merchantCount === 0) {
    return <ChartEmpty height={100} variant="premium" message="No merchants added yet" />;
  }

  const visible = merchants.slice(0, 4);
  const remaining = merchantCount - visible.length;

  return (
    <div className="flex h-full w-full flex-col justify-center gap-1.5">
      {visible.map((m, i) => {
        const avatarColor = AVATAR_COLORS[i % AVATAR_COLORS.length];
        const isActive = m.status === "active";
        return (
          <div
            key={m.id}
            className="flex items-center gap-2 overflow-hidden rounded-lg border border-slate-100 bg-slate-50 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800"
          >
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[9px] font-bold ${avatarColor}`}
              aria-hidden="true"
            >
              {initials(m.business_name)}
            </span>

            <span className="min-w-0 flex-1 truncate text-[10px] font-semibold text-slate-700 dark:text-slate-300">
              {m.business_name}
            </span>

            <span className="shrink-0 text-[10px] font-bold tabular-nums text-violet-600 dark:text-violet-400">
              {m.discount_pct}%
            </span>

            <span
              className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
                isActive
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : "bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400"
              }`}
            >
              {isActive ? "Active" : "Expired"}
            </span>
          </div>
        );
      })}

      {remaining > 0 && (
        <div className="flex items-center justify-center rounded-lg border border-dashed border-slate-200 px-2 py-1 dark:border-slate-700">
          <span className="text-[10px] text-slate-400">+{remaining} more</span>
        </div>
      )}
    </div>
  );
}
