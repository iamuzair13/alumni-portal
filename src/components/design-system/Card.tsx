"use client";

import React, { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { twMerge } from "tailwind-merge";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: "default" | "neutral" | "accent" | "outline";
  size?: "sm" | "md" | "lg";
  hover?: boolean;
  active?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      children,
      className,
      variant = "default",
      size = "md",
      hover = false,
      active = false,
      ...props
    },
    ref
  ) => {
    const base =
      "relative flex flex-col overflow-hidden rounded-xl border transition-all duration-200";

    const variants = {
      default: "bg-white border-gray-200/80 shadow-theme-sm dark:bg-gray-900 dark:border-gray-800",
      neutral:
        "bg-gray-50/60 border-gray-200/60 dark:bg-gray-900/60 dark:border-gray-800/60",
      accent:
        "bg-accent-500 border-accent-600 text-white shadow-theme-sm dark:bg-accent-600 dark:border-accent-500",
      outline:
        "bg-transparent border-gray-200 dark:border-gray-800",
    };

    const sizes = {
      sm: "p-4",
      md: "p-5",
      lg: "p-6",
    };

    const states = hover
      ? "hover:border-accent-300 hover:shadow-theme-md dark:hover:border-accent-700/60"
      : "";
    const activeState = active
      ? "ring-2 ring-accent-500/40 bg-accent-50/70 border-accent-300 shadow-theme-md dark:ring-accent-400/40 dark:bg-accent-900/20 dark:border-accent-700"
      : "";

    return (
      <div
        ref={ref}
        className={twMerge(base, variants[variant], sizes[size], states, activeState, className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Card.displayName = "Card";
