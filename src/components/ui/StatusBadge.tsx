import React from "react";
import { twMerge } from "tailwind-merge";

type StatusTone = "green" | "amber" | "red" | "gray" | "blue";

const STATUS_TONE: Record<string, StatusTone> = {
  pending: "amber",
  "in review": "amber",
  under_review: "amber",
  review: "amber",
  withdrawn: "amber",
  approved: "green",
  verified: "green",
  active: "green",
  accepted: "green",
  completed: "green",
  success: "green",
  rejected: "red",
  "not-approved": "red",
  "not approved": "red",
  declined: "red",
  failed: "red",
  cancelled: "red",
  canceled: "red",
  "not-applicable": "gray",
  "not applicable": "gray",
  inactive: "gray",
  expired: "gray",
  draft: "gray",
  info: "blue",
  yes: "green",
  true: "green",
  no: "gray",
  false: "gray",
};

const TONE_CLASSES: Record<StatusTone, string> = {
  green:
    "bg-success-50 text-success-700 ring-success-200 dark:bg-success-500/10 dark:text-success-400 dark:ring-success-500/30",
  amber:
    "bg-warning-50 text-warning-700 ring-warning-200 dark:bg-warning-500/10 dark:text-warning-400 dark:ring-warning-500/30",
  red: "bg-error-50 text-error-700 ring-error-200 dark:bg-error-500/10 dark:text-error-400 dark:ring-error-500/30",
  gray: "bg-gray-100 text-gray-600 ring-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-600",
  blue: "bg-blue-light-50 text-blue-light-700 ring-blue-light-200 dark:bg-blue-light-500/10 dark:text-blue-light-400 dark:ring-blue-light-500/30",
};

const DOT_CLASSES: Record<StatusTone, string> = {
  green: "bg-success-500",
  amber: "bg-warning-500",
  red: "bg-error-500",
  gray: "bg-gray-400",
  blue: "bg-blue-light-500",
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const key = String(status || "").trim().toLowerCase();
  const tone = STATUS_TONE[key] ?? "gray";
  const label = key ? key.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Unknown";
  return (
    <span
      className={twMerge(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
        TONE_CLASSES[tone],
        className,
      )}
    >
      <span className={twMerge("h-1.5 w-1.5 rounded-full", DOT_CLASSES[tone])} aria-hidden />
      {label}
    </span>
  );
}
