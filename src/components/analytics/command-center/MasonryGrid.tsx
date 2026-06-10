"use client";

import React from "react";
import { twMerge } from "tailwind-merge";

type MasonryColumns = "narrow" | "default" | "wide";
type LayoutMode = "masonry" | "uniform";

const masonryColumnClasses: Record<MasonryColumns, string> = {
  narrow: "columns-1 sm:columns-2",
  default: "columns-1 sm:columns-2 lg:columns-2 xl:columns-2 2xl:columns-3",
  wide: "columns-1 md:columns-2 lg:columns-3",
};

const uniformGridClasses: Record<MasonryColumns, string> = {
  narrow: "grid grid-cols-1 sm:grid-cols-2",
  default: "grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3",
  wide: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
};

export function MasonryGrid({
  children,
  columns = "default",
  layout = "masonry",
  className,
}: {
  children: React.ReactNode;
  columns?: MasonryColumns;
  layout?: LayoutMode;
  className?: string;
}) {
  const isUniform = layout === "uniform";

  return (
    <div
      className={twMerge(
        isUniform ? uniformGridClasses[columns] : masonryColumnClasses[columns],
        isUniform ? "gap-2 [&>*]:h-full" : "[&>*]:mb-2 [&>*]:break-inside-avoid",
        className,
      )}
    >
      {children}
    </div>
  );
}
