"use client";

import React from "react";
import { twMerge } from "tailwind-merge";

export type StatusVariant = "success" | "warning" | "danger" | "info" | "neutral";

interface StatusBadgeProps {
  children: React.ReactNode;
  variant?: StatusVariant;
  size?: "sm" | "md";
  className?: string;
}

export function StatusBadge({
  children,
  variant = "neutral",
  size = "sm",
  className,
}: StatusBadgeProps) {
  const variants: Record<StatusVariant, string> = {
    success:
      "bg-success-50 text-success-700 ring-success-500/20 dark:bg-success-900/20 dark:text-success-300 dark:ring-success-500/20",
    warning:
      "bg-warning-50 text-warning-700 ring-warning-500/20 dark:bg-warning-900/20 dark:text-warning-300 dark:ring-warning-500/20",
    danger:
      "bg-error-50 text-error-700 ring-error-500/20 dark:bg-error-900/20 dark:text-error-300 dark:ring-error-500/20",
    info: "bg-accent-50 text-accent-700 ring-accent-500/20 dark:bg-accent-900/20 dark:text-accent-300 dark:ring-accent-500/20",
    neutral:
      "bg-gray-100 text-gray-700 ring-gray-500/10 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-500/10",
  };

  const sizes = {
    sm: "px-1.5 py-0.5 text-[10px] font-medium",
    md: "px-2 py-0.5 text-xs font-medium",
  };

  return (
    <span
      className={twMerge(
        "inline-flex items-center rounded-full ring-1",
        variants[variant],
        sizes[size],
        className
      )}
    >
      {children}
    </span>
  );
}
