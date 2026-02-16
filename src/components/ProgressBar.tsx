"use client";

import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useProgress } from "@bprogress/react";

export default function ProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { start, stop } = useProgress();

  const [isVisible, setIsVisible] = useState(false);
  const [percent, setPercent] = useState(0);
  const intervalRef = useRef<number | null>(null);
  const finishTimeoutRef = useRef<number | null>(null);

  const safeClearTimers = () => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (finishTimeoutRef.current !== null) {
      window.clearTimeout(finishTimeoutRef.current);
      finishTimeoutRef.current = null;
    }
  };

  const begin = () => {
    safeClearTimers();
    setIsVisible(true);
    setPercent((p) => (p > 0 && p < 95 ? p : 10));
    start();

    intervalRef.current = window.setInterval(() => {
      setPercent((p) => {
        const next = p + Math.max(1, Math.round((95 - p) * 0.08));
        return Math.min(next, 95);
      });
    }, 120);
  };

  const end = () => {
    safeClearTimers();
    setPercent(100);
    stop();
    finishTimeoutRef.current = window.setTimeout(() => {
      setIsVisible(false);
      setPercent(0);
    }, 250);
  };

  const barStyle = useMemo(() => {
    return {
      transform: `scaleX(${Math.min(Math.max(percent, 0), 100) / 100})`,
    } as React.CSSProperties;
  }, [percent]);

  useEffect(() => {
    // Start progress on route change
    begin();

    // Stop progress after a short delay to allow page to render
    const timer = setTimeout(() => {
      end();
    }, 300);

    return () => {
      clearTimeout(timer);
      end();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  useEffect(() => {
    const onStart = () => begin();
    const onStop = () => end();
    window.addEventListener("global-progress-start", onStart);
    window.addEventListener("global-progress-stop", onStop);
    return () => {
      window.removeEventListener("global-progress-start", onStart);
      window.removeEventListener("global-progress-stop", onStop);
      safeClearTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isVisible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[1000000] pointer-events-none">
      <div className="relative h-[3px] bg-transparent">
        <div
          className="absolute left-0 top-0 h-full w-full origin-left bg-[#183D32]"
          style={barStyle}
        />
      </div>
      <div className="absolute right-2 top-1.5 rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold text-[#183D32] shadow-sm border border-gray-200/70">
        Loading… {percent}%
      </div>
    </div>
  );
}

