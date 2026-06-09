"use client";

import React, { useEffect, useRef, useState } from "react";

/** Measures available space and passes pixel height to chart children. */
export function FillChart({
  children,
  minHeight = 48,
}: {
  children: (height: number) => React.ReactNode;
  minHeight?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(minHeight);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      const next = Math.floor(el.getBoundingClientRect().height);
      if (next > 0) setHeight(Math.max(minHeight, next));
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [minHeight]);

  return (
    <div ref={ref} className="h-full min-h-0 w-full overflow-hidden">
      {children(height)}
    </div>
  );
}
