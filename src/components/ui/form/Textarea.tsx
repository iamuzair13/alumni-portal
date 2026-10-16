import React from "react";
import { twMerge } from "tailwind-merge";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, rows = 3, ...props }, ref) => (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={error || undefined}
      className={twMerge(
        "field-input h-auto py-2.5",
        error && "field-input-error",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

export default Textarea;
