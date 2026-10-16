import React from "react";
import { twMerge } from "tailwind-merge";

export interface DescriptionItem {
  label: React.ReactNode;
  value: React.ReactNode;
  /** Span the full row width (use for long text like declarations/addresses). */
  full?: boolean;
}

interface DescriptionListProps {
  items: DescriptionItem[];
  className?: string;
}

export default function DescriptionList({ items, className }: DescriptionListProps) {
  return (
    <dl
      className={twMerge(
        "grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2",
        className,
      )}
    >
      {items.map((item, i) => (
        <div key={i} className={item.full ? "sm:col-span-2" : undefined}>
          <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {item.label}
          </dt>
          <dd className="mt-1 text-sm leading-6 text-gray-900 dark:text-gray-100">
            {item.value == null || item.value === "" ? "—" : item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
