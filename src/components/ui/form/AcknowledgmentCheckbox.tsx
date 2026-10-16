import React from "react";
import { CircleAlert } from "lucide-react";
import { twMerge } from "tailwind-merge";

interface AcknowledgmentCheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "children"> {
  /** Optional body copy shown above the checkbox (declaration/terms text). */
  children?: React.ReactNode;
  /** Checkbox label — when omitted, `children` become the label text. */
  checkboxLabel?: React.ReactNode;
  error?: React.ReactNode;
}

const AcknowledgmentCheckbox = React.forwardRef<
  HTMLInputElement,
  AcknowledgmentCheckboxProps
>(({ children, checkboxLabel, error, className, id, ...props }, ref) => {
  const autoId = React.useId();
  const inputId = id ?? autoId;
  return (
    <div
      className={twMerge(
        "rounded-xl border border-gray-200 bg-gray-50/60 p-4 dark:border-gray-700 dark:bg-gray-900",
        !!error && "border-error-400 dark:border-error-500",
        className,
      )}
    >
      {checkboxLabel != null ? (
        <>
          {children && (
            <div className="mb-3 text-sm leading-6 text-gray-800 dark:text-gray-200">
              {children}
            </div>
          )}
          <label
            htmlFor={inputId}
            className="flex cursor-pointer items-start gap-3 text-sm font-medium text-gray-900 dark:text-gray-100"
          >
            <input
              ref={ref}
              id={inputId}
              type="checkbox"
              aria-invalid={!!error || undefined}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-brand-600 accent-brand-600 focus:ring-2 focus:ring-brand-500/30 focus:ring-offset-0 dark:border-gray-600 dark:bg-gray-800"
              {...props}
            />
            <span>{checkboxLabel}</span>
          </label>
        </>
      ) : (
        <label
          htmlFor={inputId}
          className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-gray-800 dark:text-gray-200"
        >
          <input
            ref={ref}
            id={inputId}
            type="checkbox"
            aria-invalid={!!error || undefined}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-brand-600 accent-brand-600 focus:ring-2 focus:ring-brand-500/30 focus:ring-offset-0 dark:border-gray-600 dark:bg-gray-800"
            {...props}
          />
          <span>
            {children}
            {props.required && <span className="text-error-500 ml-1">*</span>}
          </span>
        </label>
      )}
      {error && (
        <p className="field-error" role="alert">
          <CircleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
});
AcknowledgmentCheckbox.displayName = "AcknowledgmentCheckbox";

export default AcknowledgmentCheckbox;
