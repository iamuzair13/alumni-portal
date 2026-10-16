import React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { twMerge } from "tailwind-merge";

export interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  actions?: React.ReactNode;
  className?: string;
}

export default function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={twMerge("w-full border-b border-gray-200 dark:border-gray-700", className)}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-2">
            <ol className="flex flex-wrap items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              {breadcrumbs.map((crumb, i) => (
                <li key={i} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="h-3.5 w-3.5" aria-hidden />}
                  {crumb.href ? (
                    <Link href={crumb.href} className="hover:text-gray-700 dark:hover:text-gray-200">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span aria-current={i === breadcrumbs.length - 1 ? "page" : undefined}>
                      {crumb.label}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        )}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
              {title}
            </h1>
            {description && (
              <p className="mt-1.5 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
                {description}
              </p>
            )}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      </div>
    </div>
  );
}
