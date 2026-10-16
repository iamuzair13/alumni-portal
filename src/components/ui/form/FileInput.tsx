import React from "react";
import { twMerge } from "tailwind-merge";

export interface FileInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  error?: boolean;
}

const FileInput = React.forwardRef<HTMLInputElement, FileInputProps>(
  ({ className, error, ...props }, ref) => (
    <input
      ref={ref}
      type="file"
      aria-invalid={error || undefined}
      className={twMerge(
        "field-input h-auto cursor-pointer py-2.5 text-gray-600 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-brand-700 hover:file:bg-brand-100 dark:text-gray-300 dark:file:bg-brand-500/15 dark:file:text-brand-300",
        error && "field-input-error",
        className,
      )}
      {...props}
    />
  ),
);
FileInput.displayName = "FileInput";

export default FileInput;
