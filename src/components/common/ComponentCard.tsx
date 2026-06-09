import React, { forwardRef, type ReactNode, type HTMLAttributes } from "react";
import { twMerge } from "tailwind-merge";

type CardVariant = "default" | "elevated" | "flat" | "gradient" | "outline";
type CardSize = "sm" | "md" | "lg" | "xl";

export interface ComponentCardProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  divider?: boolean;
  loading?: boolean;
  compact?: boolean;
  noPadding?: boolean;
  variant?: CardVariant;
  size?: CardSize;
}

const cardBaseClasses =
  "relative flex flex-col overflow-hidden rounded-2xl transition-all duration-300 border will-change-transform";

const cardVariantClasses: Record<CardVariant, string> = {
  default: [
    "bg-white dark:bg-slate-950",
    "border-slate-200/80 dark:border-slate-800",
    "shadow-sm shadow-slate-200/30 dark:shadow-none",
    "hover:shadow-md hover:shadow-slate-200/40 dark:hover:shadow-slate-950/20",
  ].join(" "),
  elevated: [
    "bg-white dark:bg-slate-950",
    "border-slate-200/60 dark:border-slate-800",
    "shadow-lg shadow-slate-200/50 dark:shadow-slate-950/40",
    "hover:shadow-xl hover:shadow-slate-200/60 dark:hover:shadow-slate-950/50",
    "hover:-translate-y-0.5",
  ].join(" "),
  flat: [
    "bg-slate-50/80 dark:bg-slate-900/40",
    "border-slate-200/40 dark:border-slate-800/60",
    "hover:bg-slate-50 dark:hover:bg-slate-900/60",
  ].join(" "),
  gradient: [
    "bg-gradient-to-br from-white via-slate-50/60 to-white",
    "dark:from-slate-950 dark:via-slate-900/90 dark:to-slate-900/70",
    "border-slate-200/60 dark:border-slate-800",
    "shadow-md shadow-slate-200/30 dark:shadow-none",
  ].join(" "),
  outline: [
    "bg-transparent dark:bg-transparent",
    "border-slate-200 dark:border-slate-800",
    "hover:border-slate-300 dark:hover:border-slate-700",
  ].join(" "),
};

const cardSizeGapClasses: Record<CardSize, string> = {
  sm: "gap-3",
  md: "gap-4",
  lg: "gap-5",
  xl: "gap-6",
};

const paddingClasses: Record<CardSize, string> = {
  sm: "p-4 sm:p-5",
  md: "p-5 sm:p-6",
  lg: "p-6 sm:p-8",
  xl: "p-8 sm:p-10",
};

const titleClasses: Record<CardSize, string> = {
  sm: "text-base sm:text-lg",
  md: "text-lg sm:text-xl",
  lg: "text-xl sm:text-2xl",
  xl: "text-2xl sm:text-3xl",
};

const descriptionClasses: Record<CardSize, string> = {
  sm: "text-xs sm:text-sm",
  md: "text-sm sm:text-base",
  lg: "text-base sm:text-lg",
  xl: "text-lg sm:text-xl",
};

const iconSizeClasses: Record<CardSize, string> = {
  sm: "h-9 w-9",
  md: "h-10 w-10",
  lg: "h-11 w-11",
  xl: "h-12 w-12",
};

const iconScaleClasses: Record<CardSize, string> = {
  sm: "scale-90",
  md: "",
  lg: "scale-110",
  xl: "scale-125",
};

const ComponentCard = forwardRef<HTMLDivElement, ComponentCardProps>(
  (
    {
      title,
      description,
      children,
      icon,
      actions,
      footer,
      className,
      variant = "default",
      size = "md",
      divider = true,
      loading = false,
      compact = false,
      noPadding = false,
      ...props
    },
    ref
  ) => {
    const hasHeader = !!(title || description || icon || actions);
    const hasFooter = !!footer;
    const showDivider = divider && hasHeader;

    return (
      <div
        ref={ref}
        className={twMerge(
          cardBaseClasses,
          cardVariantClasses[variant],
          cardSizeGapClasses[size],
          className
        )}
        {...props}
      >
        {variant === "gradient" && (
          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 opacity-80" />
        )}

        {loading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-white/60 backdrop-blur-[2px] dark:bg-slate-950/60">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600 dark:border-slate-700 dark:border-t-blue-400" />
          </div>
        )}

        {hasHeader && (
          <div
            className={twMerge(
              "flex items-start justify-between gap-4",
              !noPadding && paddingClasses[size],
              !noPadding && compact && "pb-0",
              showDivider && "border-b border-slate-100 dark:border-slate-800/80 pb-4 sm:pb-5",
              !showDivider && !compact && "pb-0"
            )}
          >
            <div className="flex min-w-0 flex-1 items-start gap-3 sm:gap-4">
              {icon && (
                <div
                  className={twMerge(
                    "flex flex-shrink-0 items-center justify-center rounded-xl",
                    "bg-slate-100 dark:bg-slate-800/60",
                    "text-slate-600 dark:text-slate-300",
                    "ring-1 ring-slate-200/60 dark:ring-slate-700/50",
                    iconSizeClasses[size]
                  )}
                >
                  <span className={iconScaleClasses[size]}>{icon}</span>
                </div>
              )}

              <div className="flex min-w-0 flex-1 flex-col">
                {title && (
                  <h2
                    className={twMerge(
                      "font-semibold tracking-tight text-slate-900 dark:text-slate-100",
                      titleClasses[size]
                    )}
                  >
                    {title}
                  </h2>
                )}
                {description && (
                  <p
                    className={twMerge(
                      "leading-relaxed text-slate-500 dark:text-slate-400",
                      descriptionClasses[size],
                      title ? "mt-1" : "mt-0"
                    )}
                  >
                    {description}
                  </p>
                )}
              </div>
            </div>

            {actions && <div className="flex flex-shrink-0 items-center gap-2">{actions}</div>}
          </div>
        )}

        <div
          className={twMerge(
            "flex-1",
            !noPadding && paddingClasses[size],
            hasHeader && !compact && "pt-0",
            hasFooter && "pb-0"
          )}
        >
          {children}
        </div>

        {hasFooter && (
          <div
            className={twMerge(
              "flex items-center justify-between gap-4",
              !noPadding && paddingClasses[size],
              "border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/30"
            )}
          >
            {footer}
          </div>
        )}
      </div>
    );
  }
);

ComponentCard.displayName = "ComponentCard";

export default ComponentCard;
