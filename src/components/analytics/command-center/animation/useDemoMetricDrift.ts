"use client";

import { useEffect, useRef, useState } from "react";
import { DEMO_DRIFT } from "./config";

export function useDemoMetricDrift(realValue: number, demoMode: boolean): number {
  const [drifted, setDrifted] = useState(realValue);
  const realRef = useRef(realValue);

  useEffect(() => {
    realRef.current = realValue;
    if (!demoMode) {
      setDrifted(realValue);
    }
  }, [realValue, demoMode]);

  useEffect(() => {
    if (!demoMode) return;

    const applyDrift = () => {
      const base = realRef.current;
      if (base === 0) return;
      const pct = DEMO_DRIFT.minPct + Math.random() * (DEMO_DRIFT.maxPct - DEMO_DRIFT.minPct);
      const sign = Math.random() > 0.5 ? 1 : -1;
      const delta = Math.max(1, Math.round(base * pct * sign));
      setDrifted((prev) => Math.max(0, prev + delta));
    };

    applyDrift();
    const id = window.setInterval(applyDrift, DEMO_DRIFT.intervalMs);
    return () => window.clearInterval(id);
  }, [demoMode]);

  return demoMode ? drifted : realValue;
}
