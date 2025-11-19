"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useProgress } from "@bprogress/react";

export default function ProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { start, stop } = useProgress();

  useEffect(() => {
    // Start progress on route change
    start();

    // Stop progress after a short delay to allow page to render
    const timer = setTimeout(() => {
      stop();
    }, 300);

    return () => {
      clearTimeout(timer);
      stop();
    };
  }, [pathname, searchParams, start, stop]);

  return null;
}

