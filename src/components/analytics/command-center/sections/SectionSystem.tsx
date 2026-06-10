"use client";

import React from "react";
import { motion } from "motion/react";
import { Activity, Database, FileText, HardDrive, Maximize2, Server, Shield, UserCog } from "lucide-react";
import type { ManagementDashboardPayload } from "@/lib/analytics/management-dashboard";
import AnalyticsDataTable from "@/components/analytics/management/AnalyticsDataTable";
import { ExpandDrawer } from "../ExpandDrawer";
import { useExpandable } from "../hooks/useExpandable";
import { mapTrainedAdmins } from "../data/mapPayloadToCards";
import { MOCK_SYSTEM_HEALTH, MOCK_SYSTEM_LOGS } from "../data/mockAnalyticsData";
import { ccAccent, ccCard, ccCardSub, ccCardTitle, ccCardValueMd } from "../theme";

const CARD_IDS = {
  admins: "trained-admins",
  health: "system-health",
  other: "other-system",
} as const;

const statusColor = {
  healthy: "bg-emerald-500 dark:bg-emerald-400",
  warning: "bg-amber-500 dark:bg-amber-400",
  critical: "bg-rose-500 dark:bg-rose-400",
};

const statusBg = {
  healthy: "bg-emerald-50/80 dark:bg-emerald-500/10",
  warning: "bg-amber-50/80 dark:bg-amber-500/10",
  critical: "bg-rose-50/80 dark:bg-rose-500/10",
};

const healthIcons: Record<string, React.ElementType> = {
  api: Activity,
  db: Database,
  storage: HardDrive,
  errors: Server,
};

export function SectionSystem({
  data,
  scopeNotes,
  isLoading,
}: {
  data: ManagementDashboardPayload | undefined;
  scopeNotes?: readonly string[];
  isLoading: boolean;
}) {
  const { activeId, open, close } = useExpandable();
  const admins = mapTrainedAdmins(data);
  const amber = ccAccent.amber;
  const scopeCount = scopeNotes?.length ?? 0;

  const drawers: Record<string, { title: string; content: React.ReactNode }> = {
    [CARD_IDS.admins]: {
      title: "Trained Faculty Admins",
      content: (
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
      ),
    },
    [CARD_IDS.health]: {
      title: "System Health",
      content: (
        <div className="space-y-4">
          {/* TODO: Replace with actual API data */}
          <div className="grid grid-cols-2 gap-2">
            {MOCK_SYSTEM_HEALTH.map((m) => (
              <div
                key={m.id}
                className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50"
              >
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${statusColor[m.status]}`} />
                  <span className="text-sm text-gray-500 dark:text-gray-400">{m.label}</span>
                </div>
                <p className="mt-1 text-xl font-bold text-gray-900 dark:text-gray-100">
                  {m.value}
                  {m.unit ? <span className="text-sm text-gray-500">{m.unit}</span> : null}
                </p>
              </div>
            ))}
          </div>
          <AnalyticsDataTable
            columns={[
              { key: "time", label: "Time" },
              { key: "level", label: "Level" },
              { key: "message", label: "Message" },
            ]}
            rows={MOCK_SYSTEM_LOGS}
          />
        </div>
      ),
    },
    [CARD_IDS.other]: {
      title: "System Data & Configuration",
      content: (
        <div className="space-y-4 text-sm text-gray-600 dark:text-gray-300">
          {data?.meta ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50">
              <p className="mb-2 font-semibold text-gray-900 dark:text-gray-200">Period metadata</p>
              <dl className="grid grid-cols-2 gap-1">
                <dt className="text-gray-500">Time range</dt>
                <dd>{data.meta.timeRange}</dd>
                <dt className="text-gray-500">Faculty filter</dt>
                <dd>{data.meta.facultyId ?? "All"}</dd>
                <dt className="text-gray-500">Period type</dt>
                <dd>{data.meta.periodType ?? "all"}</dd>
              </dl>
            </div>
          ) : null}
          {scopeNotes && scopeNotes.length > 0 ? (
            <div>
              <p className="mb-2 font-semibold text-gray-900 dark:text-gray-200">Data scope notes</p>
              <ul className="list-inside list-disc space-y-1 text-gray-500 dark:text-gray-400">
                {scopeNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ),
    },
  };

  const active = activeId ? drawers[activeId] : null;
  const visibleFaculties = admins.byFaculty.slice(0, 10);
  const hiddenFacultyCount = Math.max(0, admins.byFaculty.length - visibleFaculties.length);

  return (
    <>
      <div className="grid h-full min-h-[132px] grid-cols-12 gap-2">
        {/* Trained Faculty Admins */}
        <motion.button
          type="button"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65 }}
          onClick={() => open(CARD_IDS.admins)}
          className={`group col-span-5 flex min-h-0 flex-col overflow-hidden text-left transition-shadow hover:shadow-md ${ccCard} ${amber.border}`}
        >
          <div className="flex shrink-0 items-center gap-2 border-b border-amber-100/80 px-3 py-2 dark:border-amber-500/10">
            <UserCog className={`h-4 w-4 shrink-0 ${amber.icon}`} />
            <span className={ccCardTitle}>Trained Faculty Admins</span>
            <span className={`ml-auto ${ccCardValueMd}`}>{admins.total}</span>
            <Maximize2 className="h-3.5 w-3.5 shrink-0 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100 dark:text-gray-500" />
          </div>
          <div className="relative flex min-h-0 flex-1 items-center px-3 py-2">
            <div className="flex w-full items-center gap-1.5 overflow-x-auto no-scrollbar">
              {visibleFaculties.length > 0 ? (
                visibleFaculties.map((f) => (
                  <div
                    key={f.faculty}
                    title={`${f.faculty}: ${f.count} admin${f.count === 1 ? "" : "s"}`}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-200/80 bg-gray-50/90 px-2 py-1.5 dark:border-gray-700/60 dark:bg-gray-800/60"
                  >
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[10px] font-bold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                      {f.faculty.charAt(0).toUpperCase()}
                    </div>
                    <span className="max-w-[72px] truncate text-[10px] font-medium text-gray-600 dark:text-gray-300">
                      {f.faculty}
                    </span>
                    <span className="text-xs font-bold tabular-nums text-gray-900 dark:text-gray-100">
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
                <span className="shrink-0 rounded-lg border border-dashed border-amber-200/80 bg-amber-50/50 px-2 py-1.5 text-[10px] font-semibold text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
                  +{hiddenFacultyCount} more
                </span>
              ) : null}
            </div>
            {hiddenFacultyCount > 0 || visibleFaculties.length > 4 ? (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white/95 to-transparent dark:from-gray-900/80"
              />
            ) : null}
          </div>
        </motion.button>

        {/* System Health Metrics */}
        <div className="col-span-4 grid h-full min-h-0 grid-cols-4 gap-1.5">
          {MOCK_SYSTEM_HEALTH.map((m, i) => {
            const MetricIcon = healthIcons[m.id] ?? Server;
            return (
              <motion.button
                key={m.id}
                type="button"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 + i * 0.03 }}
                onClick={() => open(CARD_IDS.health)}
                className={`group flex min-h-0 flex-col justify-between rounded-xl p-2.5 text-left transition-shadow hover:shadow-md ${ccCard} ${amber.border} ${statusBg[m.status]}`}
              >
                <div className="flex items-center justify-between gap-1">
                  <MetricIcon className={`h-3.5 w-3.5 shrink-0 ${amber.icon}`} />
                  <span className={`h-2 w-2 shrink-0 rounded-full ${statusColor[m.status]}`} />
                </div>
                <div className="mt-auto pt-2">
                  <span className="block truncate text-[10px] font-medium text-gray-500 dark:text-gray-400">
                    {m.label}
                  </span>
                  <span className="mt-0.5 block text-sm font-bold tabular-nums leading-tight text-gray-900 dark:text-gray-100">
                    {m.value}
                    {m.unit ? (
                      <span className="ml-0.5 text-[10px] font-medium text-gray-500 dark:text-gray-400">
                        {m.unit}
                      </span>
                    ) : null}
                  </span>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Other System */}
        <motion.button
          type="button"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.75 }}
          onClick={() => open(CARD_IDS.other)}
          className={`group col-span-3 flex min-h-0 flex-col overflow-hidden text-left transition-shadow hover:shadow-md ${ccCard} ${amber.border}`}
        >
          <div className="flex shrink-0 items-center gap-2 border-b border-amber-100/80 px-3 py-2 dark:border-amber-500/10">
            <FileText className={`h-4 w-4 shrink-0 ${amber.icon}`} />
            <span className={ccCardTitle}>Other System</span>
            <Maximize2 className="ml-auto h-3.5 w-3.5 shrink-0 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100 dark:text-gray-500" />
          </div>
          <div className="flex min-h-0 flex-1 flex-col justify-center gap-1 px-3 py-2">
            <div className="flex items-baseline gap-2">
              <span className={ccCardValueMd}>{scopeCount}</span>
              <span className={ccCardSub}>Scope notes &amp; config</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-gray-500 dark:text-gray-400">
              <span className="inline-flex items-center gap-1">
                <Database className={`h-3 w-3 ${amber.icon}`} />
                Logs
              </span>
              <span className="text-gray-300 dark:text-gray-600">·</span>
              <span className="inline-flex items-center gap-1">
                <Shield className={`h-3 w-3 ${amber.icon}`} />
                Backups
              </span>
              <span className="text-gray-300 dark:text-gray-600">·</span>
              <span className="inline-flex items-center gap-1">
                <Server className={`h-3 w-3 ${amber.icon}`} />
                Config
              </span>
            </div>
          </div>
        </motion.button>
      </div>

      <ExpandDrawer open={!!active} title={active?.title ?? ""} onClose={close} accent="amber">
        {active?.content}
      </ExpandDrawer>
    </>
  );
}
