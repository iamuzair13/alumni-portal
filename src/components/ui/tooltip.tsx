"use client";

import React from "react";

type TooltipProps = {
  children: React.ReactNode;
};

type TooltipTriggerProps = {
  children: React.ReactNode;
  asChild?: boolean;
};

type TooltipContentProps = {
  children: React.ReactNode;
};

export function Tooltip({ children }: TooltipProps) {
  return <div className="relative inline-block group">{children}</div>;
}

export function TooltipTrigger({ children }: TooltipTriggerProps) {
  return <div className="inline-block">{children}</div>;
}

export function TooltipContent({ children }: TooltipContentProps) {
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 hidden w-72 -translate-x-1/2 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 shadow-lg group-hover:block group-focus-within:block dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
    >
      {children}
    </div>
  );
}

