"use client";

import React from "react";

export type AnalyticsTableColumn = { key: string; label: string; align?: "left" | "right" | "center" };
export type AnalyticsTableRow = Record<string, string | number>;

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-gray-200 dark:bg-gray-800 ${className}`} />;
}

export default function AnalyticsDataTable({
  columns,
  rows,
  isLoading,
}: {
  columns: AnalyticsTableColumn[];
  rows: AnalyticsTableRow[];
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-4">
            {columns.map((_, j) => (
              <Skeleton key={j} className="h-10 flex-1" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200/80 dark:border-gray-800">
      <div className="max-h-80 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-gray-50/80 backdrop-blur-sm dark:bg-gray-900/80">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={`px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 ${
                    c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left"
                  }`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {rows.map((row, idx) => {
              const isTotal =
                row.faculty === "Total" ||
                row.faculty === "Total (distinct users)" ||
                row.metric === "Total" ||
                row.bucket === "Total";
              return (
                <tr
                  key={idx}
                  className={`transition-colors duration-150 ${
                    isTotal
                      ? "bg-gray-50/80 font-semibold dark:bg-gray-800/50"
                      : "hover:bg-gray-50/50 dark:hover:bg-white/[0.02]"
                  }`}
                >
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={`px-4 py-3.5 text-gray-700 dark:text-gray-300 ${
                        c.align === "right" ? "text-right tabular-nums" : c.align === "center" ? "text-center" : "text-left"
                      } ${isTotal ? "text-gray-900 dark:text-white" : ""}`}
                    >
                      {row[c.key]}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
