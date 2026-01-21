"use client";

import React, { useEffect, useMemo, useRef } from "react";

type Props = {
  children: React.ReactNode;
  /**
   * Minimum width for the table content wrapper. Can be a number (px) or any CSS width string.
   * This is the "fixed width" baseline that prevents column overlap on smaller screens.
   */
  minWidth?: number | string;
  /** Optional max width for the outer container, e.g. 1200 or "90vw". */
  maxWidth?: number | string;
  /**
   * Optional max height for the scroll area, e.g. "750px" or "70vh".
   * When provided, vertical scrolling happens inside the table container.
   */
  maxHeight?: number | string;
  /** Optional additional classes for the outer card section (not including borders). */
  className?: string;
};

function toCssSize(v: number | string | undefined, fallbackPx: number): string {
  if (v === undefined) return `${fallbackPx}px`;
  if (typeof v === "number") return `${v}px`;
  return v;
}

export default function SyncedTableScroll({ children, minWidth = 800, maxWidth, maxHeight, className }: Props) {
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const topScrollbarRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);

  const minWidthCss = useMemo(() => toCssSize(minWidth, 800), [minWidth]);
  const maxWidthCss = useMemo(() => (maxWidth === undefined ? null : toCssSize(maxWidth, 1200)), [maxWidth]);
  const maxHeightCss = useMemo(() => (maxHeight === undefined ? null : toCssSize(maxHeight, 700)), [maxHeight]);

  useEffect(() => {
    const tableContainer = tableContainerRef.current;
    const topScrollbar = topScrollbarRef.current;
    if (!tableContainer || !topScrollbar) return;

    const syncScrollbarWidth = () => {
      const tableContent = tableContainer.querySelector(".table-content-wrapper") as HTMLElement | null;
      if (!tableContent) return;
      const scrollbarContent = topScrollbar.querySelector(".table-scrollbar-content") as HTMLElement | null;
      if (!scrollbarContent) return;
      scrollbarContent.style.minWidth = `${tableContent.scrollWidth}px`;
    };

    const handleTableScroll = () => {
      if (isScrollingRef.current) return;
      isScrollingRef.current = true;
      topScrollbar.scrollLeft = tableContainer.scrollLeft;
      setTimeout(() => {
        isScrollingRef.current = false;
      }, 10);
    };

    const handleTopScroll = () => {
      if (isScrollingRef.current) return;
      isScrollingRef.current = true;
      tableContainer.scrollLeft = topScrollbar.scrollLeft;
      setTimeout(() => {
        isScrollingRef.current = false;
      }, 10);
    };

    syncScrollbarWidth();

    const resizeObserver = new ResizeObserver(() => {
      syncScrollbarWidth();
    });

    const tableContent = tableContainer.querySelector(".table-content-wrapper");
    if (tableContent) resizeObserver.observe(tableContent);

    tableContainer.addEventListener("scroll", handleTableScroll);
    topScrollbar.addEventListener("scroll", handleTopScroll);

    // Also resync on window resize (helps when sidebars collapse/expand)
    const onWindowResize = () => syncScrollbarWidth();
    window.addEventListener("resize", onWindowResize);

    return () => {
      window.removeEventListener("resize", onWindowResize);
      resizeObserver.disconnect();
      tableContainer.removeEventListener("scroll", handleTableScroll);
      topScrollbar.removeEventListener("scroll", handleTopScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={`min-w-0 max-w-full ${className ?? ""}`}
      style={maxWidthCss ? { maxWidth: maxWidthCss } : undefined}
    >
      {/* Top Horizontal Scrollbar */}
      <div
        ref={topScrollbarRef}
        className="top-horizontal-scrollbar w-full overflow-x-scroll overflow-y-hidden border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50"
        style={{
          height: "24px",
          scrollbarWidth: "auto",
          scrollbarColor: "#3b82f6 #e5e7eb",
        }}
      >
        <div className="table-scrollbar-content h-full" style={{ minWidth: minWidthCss }} />
      </div>

      {/* Table container (horizontal scrolling controlled by top scrollbar) */}
      <div
        ref={tableContainerRef}
        className={`max-w-full overflow-x-hidden custom-scrollbar relative ${maxHeightCss ? "overflow-y-auto" : "overflow-y-visible"}`}
        style={{
          ...(maxHeightCss ? { maxHeight: maxHeightCss } : {}),
        }}
      >
        <div className="table-content-wrapper" style={{ minWidth: minWidthCss }}>
          {children}
        </div>
      </div>
    </div>
  );
}


