"use client";

import React from "react";
import { motion } from "motion/react";
import { Maximize2, UserCog } from "lucide-react";
import type { ManagementDashboardPayload } from "@/lib/analytics/management-dashboard";
import AnalyticsDataTable from "@/components/analytics/management/AnalyticsDataTable";
import { ExpandDrawer } from "../ExpandDrawer";
import { useExpandable } from "../hooks/useExpandable";
import { mapTrainedAdmins } from "../data/mapPayloadToCards";
import { TRAINED_ADMINS_METHODOLOGY } from "../data/systemFieldMethodology";
import { ccAccent, ccCard, ccCardTitle, ccCardValueMd } from "../theme";

const CARD_ID = "trained-admins";

function MethodologyPanel({
  summary,
  source,
  items,
  footer,
}: {
  summary: string;
  source: string;
  items: ReadonlyArray<{ label: string; detail: string }>;
  footer?: React.ReactNode;
}) {
  return (
    <div className="mt-4 rounded-xl border border-amber-100/80 bg-amber-50/40 p-3 dark:border-amber-500/15 dark:bg-amber-500/5">
      <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        How it&apos;s calculated &amp; exposed
      </p>
      <p className="mt-1.5 text-[11px] leading-relaxed text-gray-600 dark:text-gray-400">{summary}</p>
      <p className="mt-1 text-[10px] text-gray-500 dark:text-gray-500">
        <span className="font-semibold text-gray-600 dark:text-gray-300">Source:</span> {source}
      </p>
      <ul className="mt-2 space-y-1.5">
        {items.map((item) => (
          <li key={item.label} className="text-[10px] leading-snug text-gray-500 dark:text-gray-400">
            <span className="font-semibold text-gray-700 dark:text-gray-300">{item.label}:</span> {item.detail}
          </li>
        ))}
      </ul>
      {footer ? <div className="mt-2">{footer}</div> : null}
    </div>
  );
}

export function SectionTrainedAdmins({
  data,
  isLoading,
}: {
  data: ManagementDashboardPayload | undefined;
  isLoading: boolean;
}) {
  const { activeId, open, close } = useExpandable();
  const admins = mapTrainedAdmins(data);
  const amber = ccAccent.amber;
  const visibleFaculties = admins.byFaculty.slice(0, 12);
  const hiddenFacultyCount = Math.max(0, admins.byFaculty.length - visibleFaculties.length);
  const isOpen = activeId === CARD_ID;

  return (
    <>
      <motion.button
        type="button"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        onClick={() => open(CARD_ID)}
        className={`group flex w-full min-h-[104px] flex-col overflow-hidden text-left transition-shadow hover:shadow-md ${ccCard} ${amber.border}`}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-amber-100/80 px-3 py-2 dark:border-amber-500/10">
          <UserCog className={`h-4 w-4 shrink-0 ${amber.icon}`} />
          <span className={ccCardTitle}>Trained Faculty Admins</span>
          <span className={`ml-auto ${ccCardValueMd}`}>{admins.total}</span>
          <Maximize2 className="h-3.5 w-3.5 shrink-0 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100 dark:text-gray-500" />
        </div>
        <div className="relative flex flex-1 items-center px-3 py-2.5">
          <div className="flex w-full flex-wrap items-center gap-2">
            {visibleFaculties.length > 0 ? (
              visibleFaculties.map((f) => (
                <div
                  key={f.faculty}
                  title={`${f.faculty}: ${f.count} admin${f.count === 1 ? "" : "s"}`}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-200/80 bg-gray-50/90 px-2.5 py-2 dark:border-gray-700/60 dark:bg-gray-800/60"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[11px] font-bold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                    {f.faculty.charAt(0).toUpperCase()}
                  </div>
                  <span className="max-w-[100px] truncate text-[11px] font-medium text-gray-600 dark:text-gray-300">
                    {f.faculty}
                  </span>
                  <span className="text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100">
                    {f.count}
                  </span>
                </div>
              ))
            ) : (
              <span className="text-[11px] text-gray-400 dark:text-gray-500">
                {isLoading ? "Loading…" : "No faculty-scoped admins"}
              </span>
            )}
            {hiddenFacultyCount > 0 ? (
              <span className="shrink-0 rounded-lg border border-dashed border-amber-200/80 bg-amber-50/50 px-2.5 py-2 text-[11px] font-semibold text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
                +{hiddenFacultyCount} more
              </span>
            ) : null}
          </div>
        </div>
      </motion.button>

      <ExpandDrawer open={isOpen} title="Trained Faculty Admins" onClose={close} accent="amber">
        <AnalyticsDataTable
          isLoading={isLoading}
          columns={[
            { key: "faculty", label: "Faculty" },
            { key: "count", label: "Admins", align: "right" },
          ]}
          rows={admins.byFaculty.map((r) => ({
            faculty: r.faculty,
            count: r.count.toLocaleString(),
          }))}
        />
        <MethodologyPanel
          summary={TRAINED_ADMINS_METHODOLOGY.summary}
          source={TRAINED_ADMINS_METHODOLOGY.source}
          items={TRAINED_ADMINS_METHODOLOGY.calculations}
          footer={
            <p className="text-[10px] text-gray-500 dark:text-gray-400">
              <span className="font-semibold text-gray-600 dark:text-gray-300">Refresh:</span>{" "}
              {TRAINED_ADMINS_METHODOLOGY.refresh}
            </p>
          }
        />
      </ExpandDrawer>
    </>
  );
}
