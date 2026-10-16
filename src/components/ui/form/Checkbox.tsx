import React from "react";
import { twMerge } from "tailwind-merge";

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: React.ReactNode;
  error?: boolean;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const input = (
      <input
        ref={ref}
        id={id}
        type="checkbox"
        aria-invalid={error || undefined}
        className={twMerge(
          "mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-brand-600 accent-brand-600 transition focus:ring-2 focus:ring-brand-500/30 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800",
          className,
        )}
        {...props}
      />
    );
    if (label == null) return input;
    return (
      <label
        htmlFor={id}
        className="flex cursor-pointer items-start gap-3 text-sm text-gray-800 dark:text-gray-200"
      >
        {input}
        <span>{label}</span>
      </label>
    );
  },
);
Checkbox.displayName = "Checkbox";

export default Checkbox;
