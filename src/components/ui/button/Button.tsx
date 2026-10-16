import React, { ReactNode } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { twMerge } from "tailwind-merge";

interface ButtonProps {
  children: ReactNode; // Button text or content
  size?: "sm" | "md" | "lg"; // Button size
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger"; // Button variant
  startIcon?: ReactNode; // Icon before the text
  endIcon?: ReactNode; // Icon after the text
  onClick?: () => void; // Click handler
  disabled?: boolean; // Disabled state
  loading?: boolean; // Show spinner + disable
  fullWidth?: boolean;
  href?: string; // Render as a Next.js link
  className?: string; // Additional className
  type?: "button" | "submit" | "reset"; // Button type
  ariaLabel?: string;
}

const sizeClasses: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "h-9 px-3.5 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-sm",
};

const variantClasses: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-brand-600 text-white shadow-xs hover:bg-brand-700 disabled:bg-brand-300 dark:bg-brand-600 dark:hover:bg-brand-500",
  secondary:
    "bg-brand-50 text-brand-700 hover:bg-brand-100 disabled:text-brand-300 dark:bg-brand-500/15 dark:text-brand-300 dark:hover:bg-brand-500/25",
  outline:
    "bg-white text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:text-gray-400 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-600 dark:hover:bg-white/[0.05]",
  ghost:
    "text-gray-600 hover:bg-gray-100 hover:text-gray-800 disabled:text-gray-400 dark:text-gray-300 dark:hover:bg-white/5 dark:hover:text-gray-100",
  danger:
    "bg-error-600 text-white shadow-xs hover:bg-error-700 disabled:bg-error-300 dark:hover:bg-error-500",
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      size = "md",
      variant = "primary",
      startIcon,
      endIcon,
      onClick,
      className = "",
      disabled = false,
      loading = false,
      fullWidth = false,
      href,
      type = "button",
      ariaLabel,
    },
    ref,
  ) => {
    const classes = twMerge(
      "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
      sizeClasses[size],
      variantClasses[variant],
      fullWidth && "w-full",
      (disabled || loading) && "cursor-not-allowed opacity-60",
      className,
    );

    const content = (
      <>
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          startIcon && <span className="flex items-center">{startIcon}</span>
        )}
        {children}
        {endIcon && !loading && (
          <span className="flex items-center">{endIcon}</span>
        )}
      </>
    );

    if (href && !disabled && !loading) {
      return (
        <Link href={href} className={classes} aria-label={ariaLabel} onClick={onClick}>
          {content}
        </Link>
      );
    }

    return (
      <button
        ref={ref}
        type={type}
        className={classes}
        onClick={onClick}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        aria-label={ariaLabel}
      >
        {content}
      </button>
    );
  },
);
Button.displayName = "Button";

export default Button;
