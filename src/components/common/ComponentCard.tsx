import React from "react";

interface ComponentCardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
  desc?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  variant?: "default" | "elevated" | "flat" | "gradient";
  size?: "sm" | "md" | "lg" | "xl";
  divider?: boolean;
}

const ComponentCard: React.FC<ComponentCardProps> = ({
  title,
  children,
  className = "",
  desc = "",
  icon,
  actions,
  variant = "default",
  size = "md",
  divider = true,
}) => {
  const hasNoPadding = className.includes("p-0");

  // ─── Size Configurations ───
  const sizeConfig = {
    sm: { padding: "p-4", gap: "gap-3", titleSize: "text-lg", descSize: "text-xs" },
    md: { padding: "p-6", gap: "gap-4", titleSize: "text-xl", descSize: "text-sm" },
    lg: { padding: "p-8", gap: "gap-5", titleSize: "text-2xl", descSize: "text-base" },
    xl: { padding: "p-10", gap: "gap-6", titleSize: "text-3xl", descSize: "text-lg" },
  };

  const { padding, gap, titleSize, descSize } = sizeConfig[size];

  // ─── Variant Configurations ───
  const variantStyles = {
    default: "bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 shadow-sm shadow-gray-200/50 dark:shadow-none",
    elevated: "bg-white dark:bg-gray-900 border border-gray-200/60 dark:border-gray-800 shadow-lg shadow-gray-200/60 dark:shadow-gray-950/50",
    flat: "bg-gray-50/80 dark:bg-gray-900/30 border border-gray-200/40 dark:border-gray-800/60",
    gradient: "bg-gradient-to-br from-white via-gray-50/50 to-white dark:from-gray-900 dark:via-gray-900/80 dark:to-gray-800/30 border border-gray-200/60 dark:border-gray-800 shadow-md shadow-gray-200/40 dark:shadow-none",
  };

  return (
    <div
      className={`
        relative overflow-hidden rounded-2xl
        ${variantStyles[variant]}
        ${hasNoPadding ? "" : padding}
        transition-all duration-300
        ${className}
      `}
    >
      {/* ─── Decorative Top Gradient Line ─── */}
      {variant === "gradient" && (
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
      )}

      {/* ─── Header Section ─── */}
      {(title || desc || icon || actions) && (
        <div className={`${hasNoPadding ? "" : "pb-5"} ${divider && (title || desc) ? "border-b border-gray-100 dark:border-gray-800/80" : ""}`}>
          <div className={`flex items-start ${actions ? "justify-between" : ""} ${gap}`}>
            <div className="flex items-start gap-3 flex-1 min-w-0">
              {/* Icon */}
              {icon && (
                <div className="flex-shrink-0 h-10 w-10 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 flex items-center justify-center border border-blue-100/50 dark:border-blue-800/30">
                  <span className="text-blue-600 dark:text-blue-400">{icon}</span>
                </div>
              )}
              
              {/* Text Content */}
              <div className="flex-1 min-w-0">
                {title && (
                  <h2 className={`${titleSize} font-bold text-gray-900 dark:text-white tracking-tight leading-tight`}>
                    {title}
                  </h2>
                )}
                {desc && (
                  <p className={`${descSize} text-gray-500 dark:text-gray-400 mt-1 leading-relaxed ${!title ? "mt-0" : ""}`}>
                    {desc}
                  </p>
                )}
              </div>
            </div>

            {/* Actions */}
            {actions && (
              <div className="flex-shrink-0 flex items-center gap-2">
                {actions}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Body Content ─── */}
      <div className={`${hasNoPadding ? "" : "pt-5"} ${gap}`}>
        {children}
      </div>
    </div>
  );
};

export default ComponentCard;