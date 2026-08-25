"use client";

import React, { useRef, useCallback, useEffect, useState } from "react";
import { twMerge } from "tailwind-merge";

export interface TabItem {
  key: string;
  label: string;
  count?: number;
}

interface TabBarProps {
  items: TabItem[];
  selected: string;
  onSelect: (key: string) => void;
  className?: string;
}

export function TabBar({ items, selected, onSelect, className }: TabBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  // Auto-scroll the active tab into view when selection changes
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const activeBtn = container.querySelector('[aria-selected="true"]') as HTMLElement | null;
    if (!activeBtn) return;

    const containerRect = container.getBoundingClientRect();
    const btnRect = activeBtn.getBoundingClientRect();
    const margin = 8;

    if (btnRect.left < containerRect.left + margin) {
      container.scrollBy({ left: btnRect.left - containerRect.left - margin, behavior: "smooth" });
    } else if (btnRect.right > containerRect.right - margin) {
      container.scrollBy({ left: btnRect.right - containerRect.right + margin, behavior: "smooth" });
    }
  }, [selected]);

  // Track whether scroll buttons should be shown
  useEffect(() => {
    updateScrollState();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [updateScrollState, items]);

  const scrollByAmount = useCallback((dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.6;
    el.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, idx: number) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        const next = (idx + 1) % items.length;
        onSelect(items[next].key);
        const btns = scrollRef.current?.querySelectorAll('[role="tab"]');
        (btns?.[next] as HTMLElement)?.focus();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        const prev = (idx - 1 + items.length) % items.length;
        onSelect(items[prev].key);
        const btns = scrollRef.current?.querySelectorAll('[role="tab"]');
        (btns?.[prev] as HTMLElement)?.focus();
      }
    },
    [items, onSelect]
  );

  const showScrollButtons = canScrollLeft || canScrollRight;

  return (
    <div className={twMerge("flex items-center gap-1", className)}>
      {showScrollButtons && (
        <button
          type="button"
          onClick={() => scrollByAmount("left")}
          disabled={!canScrollLeft}
          aria-label="Scroll tabs left"
          className={twMerge(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all",
            canScrollLeft
              ? "text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              : "text-gray-300 dark:text-gray-700 cursor-default"
          )}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      )}
      <div
        ref={scrollRef}
        role="tablist"
        aria-label="Sections"
        className="no-scrollbar flex min-w-0 flex-1 items-center gap-1 overflow-x-auto scroll-smooth"
        onScroll={updateScrollState}
      >
        {items.map((tab, idx) => {
          const isSelected = selected === tab.key;
          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={isSelected}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => onSelect(tab.key)}
              onKeyDown={(e) => handleKeyDown(e, idx)}
              className={twMerge(
                "relative inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-all duration-200",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/20 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900",
                isSelected
                  ? "bg-accent-500 text-white shadow-theme-md ring-1 ring-accent-600/30 dark:bg-accent-600 dark:text-white dark:shadow-black/30 dark:ring-accent-400/30"
                  : "border border-transparent text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              )}
            >
              <span className="whitespace-nowrap font-semibold">{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={twMerge(
                    "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                    isSelected
                      ? "bg-white/25 text-white"
                      : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                  )}
                >
                  {tab.count.toLocaleString()}
                </span>
              )}
              {isSelected && (
                <span className="absolute -bottom-px left-2 right-2 h-0.5 rounded-full bg-accent-600 dark:bg-accent-400" aria-hidden />
              )}
            </button>
          );
        })}
      </div>
      {showScrollButtons && (
        <button
          type="button"
          onClick={() => scrollByAmount("right")}
          disabled={!canScrollRight}
          aria-label="Scroll tabs right"
          className={twMerge(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all",
            canScrollRight
              ? "text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              : "text-gray-300 dark:text-gray-700 cursor-default"
          )}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      )}
    </div>
  );
}
