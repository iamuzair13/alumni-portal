"use client";

import React from "react";
import { useReducedMotion } from "./useReducedMotion";

type EmptyStateIdleProps = {
  children: React.ReactNode;
  className?: string;
};

export function EmptyStateIdle({ children, className = "" }: EmptyStateIdleProps) {
  const reduced = useReducedMotion();

  return (
    <span
      className={`inline-block tabular-nums ${reduced ? "" : "cc-empty-breathe"} ${className}`}
    >
      {children}
    </span>
  );
}
