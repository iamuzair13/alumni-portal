"use client";

import React, { useMemo, useState } from "react";
import { FaStar } from "react-icons/fa";

export const PROFICIENCY_LABELS: Record<number, string> = {
  1: "Very Poor",
  2: "Poor",
  3: "Fair",
  4: "Good",
  5: "Excellent",
};

export function proficiencyLabel(value: number | null | undefined): string {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return "";
  return PROFICIENCY_LABELS[Math.min(5, Math.max(1, Math.round(n)))] || "";
}

type Props = {
  value: number;
  onChange?: (value: number) => void;
  readOnly?: boolean;
  sizeClassName?: string;
  className?: string;
  ariaLabel?: string;
};

export default function StarRating({
  value,
  onChange,
  readOnly = false,
  sizeClassName = "text-lg",
  className,
  ariaLabel,
}: Props) {
  const [hovered, setHovered] = useState<number | null>(null);

  const activeValue = hovered ?? value;

  const label = useMemo(() => {
    return proficiencyLabel(value);
  }, [value]);

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <div className="inline-flex items-center gap-1" aria-label={ariaLabel || "Proficiency rating"}>
          {Array.from({ length: 5 }).map((_, idx) => {
            const starValue = idx + 1;
            const isActive = starValue <= activeValue;
            return (
              <button
                key={starValue}
                type="button"
                disabled={readOnly}
                onMouseEnter={() => {
                  if (!readOnly) setHovered(starValue);
                }}
                onMouseLeave={() => {
                  if (!readOnly) setHovered(null);
                }}
                onFocus={() => {
                  if (!readOnly) setHovered(starValue);
                }}
                onBlur={() => {
                  if (!readOnly) setHovered(null);
                }}
                onClick={() => {
                  if (!readOnly) onChange?.(starValue);
                }}
                className={`rounded-md p-1 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${readOnly ? "cursor-default" : "cursor-pointer"}`}
                aria-label={`Rate ${starValue} star${starValue === 1 ? "" : "s"}`}
              >
                <FaStar
                  className={`${sizeClassName} transition-colors ${isActive ? "text-amber-400" : "text-slate-300"}`}
                />
              </button>
            );
          })}
        </div>
        <div className="text-sm font-semibold text-slate-700 min-w-[86px]">{label}</div>
      </div>
    </div>
  );
}
