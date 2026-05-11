"use client";

import React, { useEffect, useState } from "react";

export type ChartTableView = "table" | "chart";

type ChartTableToggleProps = {
  widgetId: string;
  defaultView?: ChartTableView;
  remember?: boolean;
  className?: string;
  table: React.ReactNode;
  chart: React.ReactNode;
};

function readStored(id: string): ChartTableView | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(`analytics-view-${id}`);
    if (v === "table" || v === "chart") return v;
  } catch {
    /* ignore */
  }
  return null;
}

export default function ChartTableToggle({
  widgetId,
  defaultView = "chart",
  remember = true,
  className = "",
  table,
  chart,
}: ChartTableToggleProps) {
  const [view, setView] = useState<ChartTableView>(defaultView);

  useEffect(() => {
    if (!remember) return;
    const stored = readStored(widgetId);
    if (stored) setView(stored);
  }, [widgetId, remember]);

  const setAndStore = (next: ChartTableView) => {
    setView(next);
    if (remember && typeof window !== "undefined") {
      try {
        window.localStorage.setItem(`analytics-view-${widgetId}`, next);
      } catch {
        /* ignore */
      }
    }
  };

  return (
    <div className={className}>
      <div className="mb-3 flex justify-end">
        <div
          className="inline-flex rounded-lg border border-gray-200 bg-gray-50/80 p-0.5 dark:border-gray-700 dark:bg-gray-900/60"
          role="group"
          aria-label="View mode"
        >
          <button
            type="button"
            aria-pressed={view === "table"}
            onClick={() => setAndStore("table")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              view === "table"
                ? "bg-white text-indigo-700 shadow-sm dark:bg-gray-800 dark:text-indigo-300"
                : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            Table
          </button>
          <button
            type="button"
            aria-pressed={view === "chart"}
            onClick={() => setAndStore("chart")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              view === "chart"
                ? "bg-white text-indigo-700 shadow-sm dark:bg-gray-800 dark:text-indigo-300"
                : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            Graph
          </button>
        </div>
      </div>
      {view === "table" ? table : chart}
    </div>
  );
}
