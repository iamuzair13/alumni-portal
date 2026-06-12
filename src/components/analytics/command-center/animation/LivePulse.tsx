"use client";

import { useReducedMotion } from "./useReducedMotion";

export function LivePulse() {
  const reduced = useReducedMotion();

  return (
    <span
      className={`h-2 w-2 rounded-full bg-emerald-500 ${
        reduced ? "" : "cc-live-pulse shadow-[0_0_6px_rgba(16,185,129,0.5)]"
      }`}
      aria-hidden
    />
  );
}
