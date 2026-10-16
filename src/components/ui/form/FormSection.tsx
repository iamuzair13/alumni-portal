import React from "react";
import { twMerge } from "tailwind-merge";

interface FormSectionProps {
  title: React.ReactNode;
  /** Optional marker shown before the title, e.g. "1" or "a". */
  step?: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export default function FormSection({
  title,
  step,
  description,
  className,
  children,
}: FormSectionProps) {
  return (
    <section className={twMerge("card p-5 sm:p-6", className)}>
      <div className="mb-5">
        <h2 className="flex items-center gap-2.5 text-base font-semibold text-gray-900 dark:text-gray-100">
          {step != null && (
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand-50 text-xs font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
              {step}
            </span>
          )}
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {description}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}
