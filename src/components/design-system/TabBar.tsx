"use client";

import React, { useRef, useCallback } from "react";
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

  return (
    <div
      ref={scrollRef}
      role="tablist"
      aria-label="Sections"
      className={twMerge(
        "no-scrollbar flex items-center gap-1 overflow-x-auto",
        className
      )}
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
              "relative inline-flex shrink-0 items-center border-l-2   border-gray-300 gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/20 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900",
              isSelected
                ? "bg-accent-500 text-white dark:bg-accent-600 dark:text-white"
                : "text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            )}
          >
            <span className="whitespace-nowrap">{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={twMerge(
                  "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                  isSelected
                    ? "bg-white/20 text-white"
                    : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                )}
              >
                {tab.count.toLocaleString()}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
