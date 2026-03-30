"use client";

import React from "react";

function formatPercent(v: number) {
  if (!Number.isFinite(v)) return "0%";
  const rounded = Math.round(v * 10) / 10;
  return `${rounded}%`;
}

function formatNumber(v: number) {
  return new Intl.NumberFormat("en").format(Number.isFinite(v) ? v : 0);
}

export default function SummaryCards(props: {
  total: number;
  growth: number;
  topModule?: { label: string; total: number; growth: number } | null;
}) {
  const growth = Number.isFinite(props.growth) ? props.growth : 0;
  const isUp = growth >= 0;
  const growthClass = isUp ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400";

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
        <p className="text-sm text-gray-600 dark:text-gray-400">Total</p>
        <p className="mt-2 text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white/90">
          {formatNumber(props.total)}
        </p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
        <p className="text-sm text-gray-600 dark:text-gray-400">Growth</p>
        <p className={`mt-2 text-3xl font-extrabold tracking-tight ${growthClass}`}>
          {formatPercent(growth)}
        </p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Compared to previous period</p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
        <p className="text-sm text-gray-600 dark:text-gray-400">Top-performing module</p>
        {props.topModule ? (
          <>
            <p className="mt-2 text-lg font-semibold text-gray-900 dark:text-white/90">{props.topModule.label}</p>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {formatNumber(props.topModule.total)} · <span className={props.topModule.growth >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>{formatPercent(props.topModule.growth)}</span>
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">—</p>
        )}
      </div>
    </div>
  );
}

