"use client";

import React, { useEffect, useRef, useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  CATEGORY_SEGMENT_COLORS,
  CATEGORY_SEGMENTS,
  type CategorySegmentConfig,
  type DashboardTabKey,
} from "./dashboard-stats-config";

function useAnimatedCounter(target: number, duration = 500) {
  const [count, setCount] = useState(0);
  const prevRef = useRef(0);

  useEffect(() => {
    const start = prevRef.current;
    const diff = target - start;
    if (diff === 0) return;

    let startTime: number | null = null;
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(start + diff * easeOut));
      if (progress < 1) requestAnimationFrame(animate);
      else prevRef.current = target;
    };

    requestAnimationFrame(animate);
  }, [target, duration]);

  return count;
}

function CategorySegment({
  config,
  value,
  isLoading,
  isSelected,
  onSelect,
}: {
  config: CategorySegmentConfig;
  value: number;
  isLoading: boolean;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const animated = useAnimatedCounter(isLoading ? 0 : value);
  const colors = CATEGORY_SEGMENT_COLORS[config.key];

  const button = (
    <button
      type="button"
      role="tab"
      aria-selected={isSelected}
      onClick={onSelect}
      className={`
        flex h-full w-[100px] flex-1 flex-col items-center justify-center gap-0.5 px-2 py-3
        last:border-r-0
        transition-colors duration-200
        focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-400/40
        ${isSelected ? colors.active : ""}
        ${(() => {
          // Apply a colored background and border based on status key
          switch (config.key) {
            case "aPlus":
              return "bg-gradient-to-br from-yellow-200 via-yellow-100 to-white border-yellow-200 dark:border-yellow-400 hover:bg-yellow-100/80 dark:hover:bg-yellow-700/40";
            case "a":
              return "bg-gradient-to-br from-green-200 via-green-100 to-white border-green-200 dark:border-green-400 hover:bg-green-100/80 dark:hover:bg-green-700/40";
            case "b":
              return "bg-gradient-to-br from-blue-200 via-blue-100 to-white border-blue-200 dark:border-blue-400 hover:bg-blue-100/80 dark:hover:bg-blue-700/40";
            case "c":
              return "bg-gradient-to-br from-pink-100 via-pink-50 to-white border-pink-200 dark:border-pink-400 hover:bg-pink-100/70 dark:hover:bg-pink-700/40";
            case "d":
              return "bg-gradient-to-br from-gray-200 via-gray-100 to-white border-gray-200 dark:border-gray-400 hover:bg-gray-100/80 dark:hover:bg-gray-700/40";
            default:
              return "border-slate-200/80 dark:border-slate-700/80 hover:bg-slate-50/80 dark:hover:bg-slate-800/40";
          }
        })()}
      `}
    >
      <span
        className={`text-xs font-bold uppercase tracking-wider ${
          isSelected
            ? colors.text
            : (() => {
                switch (config.key) {
                  case "aPlus":
                    return "text-yellow-700 dark:text-yellow-200";
                  case "a":
                    return "text-green-700 dark:text-green-200";
                  case "b":
                    return "text-blue-700 dark:text-blue-200";
                  case "c":
                    return "text-pink-700 dark:text-pink-200";
                  case "d":
                    return "text-gray-700 dark:text-gray-200";
                  default:
                    return "text-slate-500 dark:text-slate-400";
                }
              })()
        }`}
      >
        {config.label}
      </span>
      {isLoading ? (
        <span className="mt-1 inline-flex h-7 w-12 items-center justify-center">
          <span
            className={`
              h-1.5 w-1.5 animate-pulse rounded-full
              ${(() => {
                switch (config.key) {
                  case "aPlus":
                    return "bg-yellow-400";
                  case "a":
                    return "bg-green-400";
                  case "b":
                    return "bg-blue-400";
                  case "c":
                    return "bg-pink-400";
                  case "d":
                    return "bg-gray-400";
                  default:
                    return "bg-slate-400";
                }
              })()}
            `}
          />
        </span>
      ) : (
        <span
          className={`
            text-2xl font-bold tabular-nums tracking-tight sm:text-3xl
            ${
              isSelected
                ? (() => {
                    switch (config.key) {
                      case "aPlus":
                        return "text-yellow-800 dark:text-yellow-100";
                      case "a":
                        return "text-green-800 dark:text-green-100";
                      case "b":
                        return "text-blue-800 dark:text-blue-100";
                      case "c":
                        return "text-pink-800 dark:text-pink-100";
                      case "d":
                        return "text-gray-800 dark:text-gray-100";
                      default:
                        return "text-slate-900 dark:text-white";
                    }
                  })()
                : (() => {
                    switch (config.key) {
                      case "aPlus":
                        return "text-yellow-700 dark:text-yellow-200";
                      case "a":
                        return "text-green-700 dark:text-green-200";
                      case "b":
                        return "text-blue-700 dark:text-blue-200";
                      case "c":
                        return "text-pink-700 dark:text-pink-200";
                      case "d":
                        return "text-gray-700 dark:text-gray-200";
                      default:
                        return "text-slate-800 dark:text-slate-100";
                    }
                  })()
            }
          `}
        >
          {animated.toLocaleString()}
        </span>
      )}
    </button>
  );

  if (config.tooltip) {
    return (
      <div className="flex min-w-0 flex-1">
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent>
            <p>{config.tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return <div className="flex min-w-0 flex-1">{button}</div>;
}

export type AlumniCategoryCardProps = {
  selected: DashboardTabKey;
  onSelect: (key: DashboardTabKey) => void;
  counts: {
    aPlus: number;
    a: number;
    b: number;
    c: number;
    d: number;
  };
  isLoading?: boolean;
};

export function AlumniCategoryCard({
  selected,
  onSelect,
  counts,
  isLoading = false,
}: AlumniCategoryCardProps) {
  const valueByKey: Record<string, number> = {
    aPlus: counts.aPlus,
    a: counts.a,
    b: counts.b,
    c: counts.c,
    d: counts.d,
  };

  return (
    <div
      className="
        overflow-hidden rounded-[20px] border border-white/60 bg-white/70 backdrop-blur-md
        shadow-[0_4px_20px_rgba(0,0,0,0.05)] transition-all duration-300
        dark:border-gray-700/60 dark:bg-gray-900/60 dark:shadow-[0_4px_20px_rgba(0,0,0,0.25)]
      "
      role="tablist"
      aria-label="Alumni categories"
    >
      <div className="border-b border-slate-200/80 px-4 py-2.5 dark:border-slate-700/80">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Alumni Categories
        </h3>
      </div>
      <div className="flex w-1/2 divide-x-0">
        {CATEGORY_SEGMENTS.map((segment) => (
          <CategorySegment
            key={segment.key}
            config={segment}
            value={valueByKey[segment.key] ?? 0}
            isLoading={isLoading}
            isSelected={selected === segment.key}
            onSelect={() => onSelect(segment.key)}
          />
        ))}
      </div>
    </div>
  );
}
