import React from "react";
import { Loader2 } from "lucide-react";
import { twMerge } from "tailwind-merge";

interface FormActionsProps {
  submitLabel?: React.ReactNode;
  submittingLabel?: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  cancel?: React.ReactNode;
  className?: string;
}

export default function FormActions({
  submitLabel = "Submit",
  submittingLabel,
  loading,
  disabled,
  cancel,
  className,
}: FormActionsProps) {
  return (
    <div
      className={twMerge(
        "mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end",
        className,
      )}
    >
      {cancel}
      <button
        type="submit"
        disabled={disabled || loading}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand-600 px-6 text-sm font-medium text-white shadow-xs transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-brand-600 dark:hover:bg-brand-500"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {loading ? (submittingLabel ?? submitLabel) : submitLabel}
      </button>
    </div>
  );
}
