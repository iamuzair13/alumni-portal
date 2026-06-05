"use client";

import React from "react";

type Span = 2 | 3 | 4 | 6 | 8 | 9 | 12;

const SPAN_CLASSES: Record<Span, string> = {
  2: "col-span-6 sm:col-span-4 lg:col-span-2",
  3: "col-span-12 sm:col-span-6 lg:col-span-3",
  4: "col-span-12 sm:col-span-6 lg:col-span-4",
  6: "col-span-12 lg:col-span-6",
  8: "col-span-12 lg:col-span-8",
  9: "col-span-12 lg:col-span-9",
  12: "col-span-12",
};

export function AnalyticsGrid({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`grid grid-cols-12 gap-3 ${className}`}>{children}</div>;
}

export function AnalyticsGridItem({
  span = 12,
  className = "",
  children,
}: {
  span?: Span;
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={`${SPAN_CLASSES[span]} ${className}`}>{children}</div>;
}
