"use client";

import { useEffect, useState } from "react";

function formatRelative(ms: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export function useRelativeTime(timestamp: number | undefined) {
  const [label, setLabel] = useState("—");

  useEffect(() => {
    if (!timestamp) {
      setLabel("—");
      return;
    }
    const tick = () => setLabel(formatRelative(timestamp));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [timestamp]);

  return label;
}
