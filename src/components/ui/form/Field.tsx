import React from "react";
import { CircleAlert } from "lucide-react";
import { twMerge } from "tailwind-merge";

interface FieldProps {
  label?: React.ReactNode;
  htmlFor?: string;
  required?: boolean;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

function useFieldIds(htmlFor?: string) {
  const auto = React.useId();
  const id = htmlFor ?? auto;
  return { id, hintId: `${id}-hint`, errorId: `${id}-error` };
}

export default function Field({
  label,
  htmlFor,
  required,
  hint,
  error,
  className,
  children,
}: FieldProps) {
  const { id, hintId, errorId } = useFieldIds(htmlFor);
  const describedBy = [error ? errorId : null, hint ? hintId : null]
    .filter(Boolean)
    .join(" ");

  const child = React.isValidElement(children)
    ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
        id: (children.props as { id?: string }).id ?? id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy || undefined,
      })
    : children;

  return (
    <div className={twMerge("w-full", className)}>
      {label != null && (
        <label htmlFor={id} className="field-label">
          {label}
          {required && <span className="text-error-500 ml-0.5">*</span>}
        </label>
      )}
      {child}
      {error ? (
        <p id={errorId} className="field-error" role="alert">
          <CircleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p id={hintId} className="field-hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
