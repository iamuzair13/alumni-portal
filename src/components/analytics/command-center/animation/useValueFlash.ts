"use client";

import { useEffect, useRef, useState } from "react";
import { FLASH } from "./config";

export function useValueFlash(value: number, enabled = true): boolean {
  const [isFlashing, setIsFlashing] = useState(false);
  const prev = useRef(value);
  const mounted = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    if (!mounted.current) {
      mounted.current = true;
      prev.current = value;
      return;
    }

    if (prev.current !== value) {
      prev.current = value;
      setIsFlashing(true);
      const id = window.setTimeout(() => setIsFlashing(false), FLASH.durationMs);
      return () => window.clearTimeout(id);
    }
  }, [value, enabled]);

  return isFlashing;
}
