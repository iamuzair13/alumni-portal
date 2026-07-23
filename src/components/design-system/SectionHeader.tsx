"use client";

import React, { type ReactNode } from "react";
import { twMerge } from "tailwind-merge";

interface SectionHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function SectionHeader({
  title,
  description,
  actions,
  className,
}: SectionHeaderProps) {
  return (
    <div className={twMerge("flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="min-w-0">
        {typeof title === "string" ? (
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            {title}
          </h2>
        ) : (
          title
        )}
        {description ? (
          <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
