"use client";

import React from "react";

export function ChartEmpty({ height = 48, message = "No data" }: { height?: number; message?: string }) {
  return (
    <div
      className="flex w-full items-center justify-center rounded-md bg-gray-50 text-[10px] text-gray-400 dark:bg-gray-800/40 dark:text-gray-500"
      style={{ height }}
    >
      {message}
    </div>
  );
}
