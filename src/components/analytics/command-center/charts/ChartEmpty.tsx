"use client";

import React from "react";
import { Inbox } from "lucide-react";

export function ChartEmpty({
  height = 48,
  message = "No data",
  compact = false,
  variant = "default",
}: {
  height?: number;
  message?: string;
  compact?: boolean;
  variant?: "default" | "premium";
}) {
  if (compact && variant !== "premium") {
    return (
      <p className="w-full min-w-0 truncate text-right text-[9px] italic leading-tight text-slate-400 dark:text-slate-500">
        {message}
      </p>
    );
  }

  if (variant === "premium") {
    return (
      <div
        className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-3 py-4 dark:border-slate-700 dark:bg-slate-800/30"
        style={{ minHeight: height }}
      >
        <Inbox className="h-5 w-5 text-slate-300 dark:text-slate-600" aria-hidden />
        <p className="text-center text-sm italic text-slate-400 dark:text-slate-500">{message}</p>
      </div>
    );
  }

  return (
    <div
      className="flex w-full items-center justify-center rounded-md bg-gray-50 text-[10px] text-gray-400 dark:bg-gray-800/40 dark:text-gray-500"
      style={{ height }}
    >
      {message}
    </div>
  );
}
