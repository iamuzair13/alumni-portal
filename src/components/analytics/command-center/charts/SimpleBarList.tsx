"use client";

import React from "react";
import { motion } from "motion/react";
import { CHART } from "../animation/config";
import { useReducedMotion } from "../animation/useReducedMotion";

export type SimpleBarItem = {
  label: string;
  value: number;
  color: string;
  detail?: string;
};

function SimpleBarRow({
  item,
  maxValue,
  reduced,
  index,
  compact = false,
}: {
  item: SimpleBarItem;
  maxValue: number;
  reduced: boolean;
  index: number;
  compact?: boolean;
}) {
  const width = item.value === 0 ? 0 : Math.max(8, (item.value / maxValue) * 100);
  const stagger = index * (CHART.progress.staggerMs / 1000);

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium leading-5 text-slate-700 dark:text-slate-200">{item.label}</p>
          {item.detail ? (
            <p className="text-xs leading-4 text-slate-500 dark:text-slate-400">{item.detail}</p>
          ) : null}
        </div>
        <span className="shrink-0 whitespace-nowrap text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
          {item.value.toLocaleString()}
        </span>
      </div>

      <div
        className={`relative min-w-0 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800/70 ${
          compact ? "h-2" : "h-2.5"
        }`}
      >
        <motion.div
          initial={{ width: reduced ? `${width}%` : 0 }}
          animate={{ width: `${width}%` }}
          transition={{
            delay: reduced ? 0 : stagger,
            duration: reduced ? 0 : CHART.progress.duration,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${width}%`,
            background: `linear-gradient(90deg, ${item.color}, ${item.color}cc)`,
          }}
        />
      </div>
    </div>
  );
}

export function SimpleBarList({
  items,
  compact = false,
  className = "",
}: {
  items: SimpleBarItem[];
  compact?: boolean;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const maxValue = Math.max(...items.map((item) => item.value), 1);

  return (
    <div className={`flex h-full min-h-0 w-full flex-col justify-center ${compact ? "gap-3" : "gap-4"} ${className}`}>
      {items.map((item, index) => (
        <SimpleBarRow
          key={`${item.label}-${index}`}
          item={item}
          maxValue={maxValue}
          reduced={reduced}
          index={index}
          compact={compact}
        />
      ))}
    </div>
  );
}
