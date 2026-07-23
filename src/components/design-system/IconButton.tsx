"use client";

import React, { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { twMerge } from "tailwind-merge";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "default" | "accent" | "ghost";
  size?: "sm" | "md";
  active?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      children,
      className,
      variant = "default",
      size = "md",
      active = false,
      ...props
    },
    ref
  ) => {
    const base =
      "inline-flex items-center justify-center rounded-lg transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/30 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900";

    const variants = {
      default:
        "border border-gray-200 bg-white text-gray-600 shadow-theme-xs hover:bg-gray-50 hover:text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100",
      accent:
        "bg-accent-500 text-white shadow-theme-sm hover:bg-accent-600 dark:bg-accent-600 dark:hover:bg-accent-500",
      ghost:
        "text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100",
    };

    const sizes = {
      sm: "h-8 w-8",
      md: "h-10 w-10",
    };

    const activeState = active
      ? "bg-accent-50 text-accent-700 border-accent-200 dark:bg-accent-900/20 dark:text-accent-300 dark:border-accent-800"
      : "";

    return (
      <button
        ref={ref}
        className={twMerge(base, variants[variant], sizes[size], activeState, className)}
        {...props}
      >
        {children}
      </button>
    );
  }
);
IconButton.displayName = "IconButton";
