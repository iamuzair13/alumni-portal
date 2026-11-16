"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Animates a number from 0 to `target` with an ease-out cubic curve.
 * Respects prefers-reduced-motion by snapping straight to the target.
 * Use sparingly — only for small "headline" numbers, never inside list items.
 */
export function useCountUp(target: number, duration = 700): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef(0);

  useEffect(() => {
    if (!Number.isFinite(target) || target <= 0) {
      setValue(0);
      return;
    }
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setValue(target);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      setValue(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return value;
}

export function CountUp({ value, duration }: { value: number; duration?: number }): React.ReactNode {
  return useCountUp(value, duration);
}
