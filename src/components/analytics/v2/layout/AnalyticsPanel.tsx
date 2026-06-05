"use client";

import React from "react";

export function AnalyticsPanel({
  title,
  subtitle,
  icon,
  id,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  id?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={`scroll-mt-20 rounded-xl border border-gray-200/60 bg-white/80 shadow-sm backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/50 ${className}`}
    >
      <div className="border-b border-gray-100 px-3 py-2.5 dark:border-gray-800 md:px-4">
        <div className="flex items-center gap-2">
          {icon && (
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold tracking-tight text-gray-900 dark:text-white">{title}</h2>
            {subtitle ? <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">{subtitle}</p> : null}
          </div>
        </div>
      </div>
      <div className="p-3 md:p-4">{children}</div>
    </section>
  );
}

export function AnalyticsSubheading({
  children,
  dotColor = "bg-indigo-500",
}: {
  children: React.ReactNode;
  dotColor?: string;
}) {
  return (
    <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-900 dark:text-white">
      <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
      {children}
    </h3>
  );
}

export function ChartInsight({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-[11px] font-medium text-gray-500 dark:text-gray-400">{children}</p>
  );
}
