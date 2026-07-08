"use client";

import React from "react";
import { motion } from "motion/react";
import { ChartEmpty } from "./ChartEmpty";

const NATIONAL_COLOR = "#6366F1";
const INTL_COLOR = "#14B8A6";

export function ChaptersCardChart({
  nationalCount,
  internationalCount,
  nationalMembers,
  internationalMembers,
}: {
  nationalCount: number;
  internationalCount: number;
  nationalMembers: number;
  internationalMembers: number;
}) {
  const hasData =
    nationalCount > 0 ||
    internationalCount > 0 ||
    nationalMembers > 0 ||
    internationalMembers > 0;

  if (!hasData) {
    return <ChartEmpty height={96} variant="premium" message="No chapter activity yet" />;
  }

  const total = nationalCount + internationalCount;
  const nationalPct = total > 0 ? (nationalCount / total) * 100 : 50;
  const intlPct = total > 0 ? (internationalCount / total) * 100 : 50;

  return (
    <div className="flex h-full min-h-0 w-full flex-col justify-center gap-2">
      {/* Stacked bar */}
      <div className="relative h-7 w-full overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${nationalPct}%` }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-y-0 left-0 flex items-center justify-center"
          style={{ background: `linear-gradient(90deg, ${NATIONAL_COLOR}, #818CF8)` }}
        >
          {nationalPct > 18 && (
            <span className="whitespace-nowrap px-2 text-[10px] font-bold text-white">
              {nationalCount}
            </span>
          )}
        </motion.div>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${intlPct}%` }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-y-0 right-0 flex items-center justify-center"
          style={{ background: `linear-gradient(90deg, #2DD4BF, ${INTL_COLOR})` }}
        >
          {intlPct > 18 && (
            <span className="whitespace-nowrap px-2 text-[10px] font-bold text-white">
              {internationalCount}
            </span>
          )}
        </motion.div>
      </div>

      {/* Breakdown rows */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: NATIONAL_COLOR }} />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">National</p>
            <p className="text-[12px] text-slate-800">
               {nationalMembers.toLocaleString()} Members
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: INTL_COLOR }} />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">International</p>
            <p className="text-[12px] text-slate-800">
             {internationalMembers.toLocaleString()} Members
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
