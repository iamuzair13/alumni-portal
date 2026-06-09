"use client";

import React from "react";
import { motion } from "motion/react";
import { Database, FileText, Server, Shield, UserCog } from "lucide-react";
import type { ManagementDashboardPayload } from "@/lib/analytics/management-dashboard";
import AnalyticsDataTable from "@/components/analytics/management/AnalyticsDataTable";
import { AnalyticsCard } from "../AnalyticsCard";
import { ExpandDrawer } from "../ExpandDrawer";
import { useExpandable } from "../hooks/useExpandable";
import { mapTrainedAdmins } from "../data/mapPayloadToCards";
import { MOCK_SYSTEM_HEALTH, MOCK_SYSTEM_LOGS } from "../data/mockAnalyticsData";
import { ccAccent, ccCard, ccCardTitle } from "../theme";

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

  return (
    <>
      <div className="grid h-full min-h-0 grid-cols-12 gap-2">
        <motion.button
          type="button"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65 }}
          onClick={() => open(CARD_IDS.admins)}
          className={`col-span-5 flex min-h-0 flex-col overflow-hidden text-left transition-shadow hover:shadow-md ${ccCard} ${amber.border}`}
        >
          <div className="mb-1.5 flex items-center gap-2 px-2.5 pt-2.5">
            <UserCog className={`h-4 w-4 ${amber.icon}`} />
            <span className={ccCardTitle}>Trained Faculty Admins</span>
            <span className="ml-auto text-lg font-bold text-gray-900 dark:text-gray-100">{admins.total}</span>
          </div>
          <div className="flex min-h-0 flex-1 gap-2 overflow-x-auto px-2.5 pb-2.5">
            {admins.byFaculty.slice(0, 8).map((f) => (
              <div
                key={f.faculty}
                className="flex shrink-0 flex-col items-center rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 dark:border-gray-700/60 dark:bg-gray-800/60"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                  {f.faculty.charAt(0)}
                </div>
                <span className="mt-1 max-w-[72px] truncate text-[10px] text-gray-500 dark:text-gray-400">
                  {f.faculty}
                </span>
                <span className="text-xs font-semibold text-gray-900 dark:text-gray-200">{f.count}</span>
              </div>
            ))}
          </div>
        </motion.button>

        <div className="col-span-4 grid grid-cols-4 gap-1.5">
          {MOCK_SYSTEM_HEALTH.map((m, i) => (
            <motion.button
              key={m.id}
              type="button"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 + i * 0.03 }}
              onClick={() => open(CARD_IDS.health)}
              className={`flex flex-col rounded-lg p-2 text-left transition-shadow hover:shadow-md ${ccCard} ${amber.border}`}
            >
              <div className="flex items-center gap-1">
                <Server className={`h-3.5 w-3.5 ${amber.icon}`} />
                <span className={`h-2 w-2 rounded-full ${statusColor[m.status]}`} />
              </div>
              <span className="mt-1 truncate text-[10px] text-gray-500 dark:text-gray-400">{m.label}</span>
              <span className="text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100">
                {m.value}
                {m.unit ? <span className="text-[10px] text-gray-500">{m.unit}</span> : null}
              </span>
            </motion.button>
          ))}
        </div>

        <AnalyticsCard
          id={CARD_IDS.other}
          title="Other System"
          icon={FileText}
          accent="amber"
          primaryValue={scopeNotes?.length ?? 0}
          secondaryLabel="Scope notes & config"
          colSpan="col-span-3"
          delay={0.75}
          compact
          onExpand={open}
          chart={
            <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
              <Database className={`h-3.5 w-3.5 ${amber.icon}`} />
              <Shield className={`h-3.5 w-3.5 ${amber.icon}`} />
              <span>Logs · Backups · Config</span>
            </div>
          }
        />
      </div>

      <ExpandDrawer open={!!active} title={active?.title ?? ""} onClose={close} accent="amber">
        {active?.content}
      </ExpandDrawer>
    </>
  );
}
