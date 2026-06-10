"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { Maximize2 } from "lucide-react";
import type { PerformanceResult } from "../utils/derivePerformanceScore";
import { PerformanceScoreBreakdown } from "./PerformanceScoreBreakdown";

type PerformanceScoreProps = {
  result: PerformanceResult;
  compact?: boolean;
  /** Command center header styling and dropdown breakdown */
  variant?: "default" | "command";
};

type DropdownPosition = {
  top: number;
  left: number;
  width: number;
};

function gaugeStrokeClass(label: PerformanceResult["label"]) {
  if (label === "Strong") return "text-emerald-500 dark:text-emerald-400";
  if (label === "Stable") return "text-amber-500 dark:text-amber-400";
  return "text-rose-500 dark:text-rose-400";
}

export function PerformanceScore({
  result,
  compact = false,
  variant = "default",
}: PerformanceScoreProps) {
  const [expanded, setExpanded] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<DropdownPosition | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { score, label } = result;
  const isCommand = variant === "command";

  const size = isCommand ? 52 : compact ? 64 : 88;
  const radius = isCommand ? 21 : compact ? 26 : 36;
  const stroke = isCommand ? 4 : compact ? 5 : 6;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const center = size / 2;

  const labelColor =
    label === "Strong"
      ? "text-emerald-600 dark:text-emerald-400"
      : label === "Stable"
        ? "text-amber-600 dark:text-amber-400"
        : "text-rose-600 dark:text-rose-400";

  const updateDropdownPosition = () => {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = Math.min(400, window.innerWidth - 16);
    const left = Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8);
    setDropdownPos({
      top: rect.bottom + 8,
      left,
      width,
    });
  };

  useEffect(() => {
    if (!isCommand || !expanded) {
      setDropdownPos(null);
      return;
    }

    updateDropdownPosition();
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || dropdownRef.current?.contains(target)) return;
      setExpanded(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("resize", updateDropdownPosition);
    window.addEventListener("scroll", updateDropdownPosition, true);
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", updateDropdownPosition);
      window.removeEventListener("scroll", updateDropdownPosition, true);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [isCommand, expanded]);

  const gauge = (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg className="-rotate-90" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-gray-200 dark:text-gray-700"
        />
        <motion.circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className={isCommand ? gaugeStrokeClass(label) : "text-violet-500 dark:text-violet-400"}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className={`font-bold tabular-nums text-gray-900 dark:text-white ${
            isCommand ? "text-base" : compact ? "text-lg" : "text-xl"
          }`}
        >
          {score}
        </span>
      </div>
    </div>
  );

  const titleClass = isCommand
    ? "text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400"
    : compact
      ? "text-[9px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400"
      : "text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400";

  const hintClass = isCommand
    ? "text-[10px] text-gray-400 dark:text-gray-500"
    : compact
      ? "mt-0.5 text-[9px] text-gray-400 dark:text-gray-500"
      : "mt-0.5 text-[10px] text-gray-400 dark:text-gray-500";

  const expandIcon = isCommand ? (
    <Maximize2
      className={`h-3.5 w-3.5 shrink-0 text-gray-400 transition-opacity group-hover:opacity-100 dark:text-gray-500 ${
        expanded ? "opacity-100" : "opacity-60"
      }`}
    />
  ) : (
    <svg
      className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );

  const cardBody = (
    <>
      {gauge}
      <div className="min-w-0 flex-1 text-left">
        <p className={titleClass}>Portal Performance</p>
        <p className={`text-sm font-bold leading-tight ${labelColor}`}>{label}</p>
        {!isCommand ? (
          <p className={hintClass}>
            {compact ? (
              <>{expanded ? "Tap to hide breakdown" : "Tap for score breakdown"}</>
            ) : (
              <>
                Composite index from verification, engagement, placement & chapters ·{" "}
                {expanded ? "click to hide" : "click for breakdown"}
              </>
            )}
          </p>
        ) : (
          <p className={hintClass}>{expanded ? "Click to close" : "Score breakdown"}</p>
        )}
      </div>
      {expandIcon}
    </>
  );

  const buttonClass = isCommand
    ? `group flex w-full items-center gap-2 rounded-xl border bg-white/95 px-2 py-1.5 text-left shadow-sm backdrop-blur-sm transition-all hover:shadow-md dark:bg-gray-900/80 ${
        label === "Strong"
          ? "border-emerald-200/80 hover:border-emerald-300 dark:border-emerald-500/20 dark:hover:border-emerald-400/40"
          : label === "Stable"
            ? "border-amber-200/80 hover:border-amber-300 dark:border-amber-500/20 dark:hover:border-amber-400/40"
            : "border-rose-200/80 hover:border-rose-300 dark:border-rose-500/20 dark:hover:border-rose-400/40"
      } ${expanded ? "ring-2 ring-cyan-500/20 dark:ring-cyan-400/20" : ""}`
    : `flex w-full items-center gap-2.5 rounded-xl border border-gray-200/60 bg-white/80 text-left shadow-sm backdrop-blur-sm transition-colors hover:border-indigo-300/60 hover:bg-white dark:border-gray-800 dark:bg-gray-900/50 dark:hover:border-indigo-500/40 dark:hover:bg-gray-900/70 ${
        compact ? "px-2.5 py-2" : "gap-3 p-3"
      } ${expanded ? "ring-2 ring-indigo-500/20 dark:ring-indigo-400/20" : ""}`;

  const commandDropdown =
    isCommand && expanded && dropdownPos && typeof document !== "undefined"
      ? createPortal(
          <AnimatePresence>
            <motion.div
              ref={dropdownRef}
              id="performance-score-breakdown"
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="fixed z-[500] shadow-2xl"
              style={{
                top: dropdownPos.top,
                left: dropdownPos.left,
                width: dropdownPos.width,
              }}
            >
              <PerformanceScoreBreakdown result={result} variant="command" />
            </motion.div>
          </AnimatePresence>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className={`relative ${isCommand ? "z-30" : "flex flex-col gap-2"}`}>
      <button
        type="button"
        onClick={() => setExpanded((open) => !open)}
        aria-expanded={expanded}
        aria-controls="performance-score-breakdown"
        className={buttonClass}
      >
        {cardBody}
      </button>

      {commandDropdown}

      {!isCommand && expanded ? (
        <div id="performance-score-breakdown">
          <PerformanceScoreBreakdown result={result} />
        </div>
      ) : null}
    </div>
  );
}
