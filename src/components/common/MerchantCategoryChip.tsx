"use client";

import React from "react";
import { twMerge } from "tailwind-merge";
import type { MerchantCategoryRef } from "@/app/api/merchants/route";

/** Fixed palette — must stay in sync with CATEGORY_COLORS in
 * src/app/api/merchant-categories/route.ts */
export const MERCHANT_CATEGORY_PALETTE: { hex: string; label: string }[] = [
  { hex: "#EA580C", label: "Ember" },
  { hex: "#7C3AED", label: "Violet" },
  { hex: "#0D9488", label: "Teal" },
  { hex: "#059669", label: "Green" },
  { hex: "#2563EB", label: "Blue" },
  { hex: "#DB2777", label: "Magenta" },
  { hex: "#CA8A04", label: "Amber" },
  { hex: "#DC2626", label: "Red" },
  { hex: "#4F46E5", label: "Indigo" },
  { hex: "#64748B", label: "Slate" },
];

export const DEFAULT_CATEGORY_COLOR = "#64748B";

/**
 * Small tinted label for a merchant category. Color comes from the admin's
 * palette choice, rendered as a soft tinted chip readable in light/dark.
 */
export function MerchantCategoryChip({
  category,
  size = "md",
  className,
}: {
  category: Pick<MerchantCategoryRef, "name" | "color">;
  size?: "sm" | "md";
  className?: string;
}) {
  const color = /^#[0-9a-fA-F]{6}$/.test(category.color)
    ? category.color.toUpperCase()
    : DEFAULT_CATEGORY_COLOR;
  return (
    <span
      className={twMerge(
        "inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        className
      )}
      style={{
        color,
        backgroundColor: `${color}14`,
        borderColor: `${color}40`,
      }}
    >
      <span
        className={twMerge("rounded-full", size === "sm" ? "h-1 w-1" : "h-1.5 w-1.5")}
        style={{ backgroundColor: color }}
      />
      {category.name}
    </span>
  );
}

export function MerchantCategoryChipList({
  categories,
  size = "md",
  empty = "—",
  className,
}: {
  categories: MerchantCategoryRef[];
  size?: "sm" | "md";
  empty?: React.ReactNode;
  className?: string;
}) {
  if (!categories || categories.length === 0) {
    return <span className="text-gray-400 dark:text-gray-500">{empty}</span>;
  }
  return (
    <span className={twMerge("inline-flex flex-wrap items-center gap-1.5", className)}>
      {categories.map((c) => (
        <MerchantCategoryChip key={c.id} category={c} size={size} />
      ))}
    </span>
  );
}
