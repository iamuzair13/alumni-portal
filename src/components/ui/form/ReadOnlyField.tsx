import React from "react";
import { Lock } from "lucide-react";
import { twMerge } from "tailwind-merge";

interface ReadOnlyFieldProps {
  label: React.ReactNode;
  value?: React.ReactNode;
  /** Caption under the value; defaults to the auto-fetched note. */
  hint?: React.ReactNode;
  required?: boolean;
  className?: string;
}

export default function ReadOnlyField({
  label,
  value,
  hint = "Auto-fetched from your profile",
  required,
  className,
}: ReadOnlyFieldProps) {
  const text =
    value == null || value === "" ? (
      <span className="text-gray-400 dark:text-gray-500">—</span>
    ) : (
      value
    );
  return (
    <div className={twMerge("w-full", className)}>
      <span className="field-label">
        {label}
        {required && <span className="text-error-500 ml-0.5">*</span>}
      </span>
      <div className="field-input flex items-center justify-between gap-2 bg-gray-50 text-gray-700 dark:bg-gray-950 dark:text-gray-200">
        <span className="truncate">{text}</span>
        <Lock className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
      </div>
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}
